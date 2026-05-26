-- 1. Add 'deleted' to submission status enum
ALTER TYPE video_status ADD VALUE IF NOT EXISTS 'deleted';

-- 2. Create monetization tier config table
CREATE TABLE IF NOT EXISTS public.payout_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  min_views integer NOT NULL,
  max_views integer,
  payout_brl numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(min_views, max_views)
);

ALTER TABLE public.payout_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin all on payout_tiers"
  ON public.payout_tiers
  FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Insert default tier table
INSERT INTO public.payout_tiers (min_views, max_views, payout_brl) VALUES
  (0, 0, 0),
  (1, 1000, 5),
  (1001, 5000, 10),
  (5001, 25000, 20),
  (25001, 50000, 50),
  (50001, 100000, 70),
  (100001, 250000, 100),
  (250001, 500000, 150),
  (500001, 1000000, 200),
  (1000001, NULL, 250)
ON CONFLICT DO NOTHING;

-- 3. Add wallet columns if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'profiles' AND column_name = 'balance_total') THEN
    ALTER TABLE public.profiles ADD COLUMN balance_total numeric DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'profiles' AND column_name = 'balance_available') THEN
    ALTER TABLE public.profiles ADD COLUMN balance_available numeric DEFAULT 0;
  END IF;
END $$;

-- 4. Handle normalization function for pages
CREATE OR REPLACE FUNCTION public.normalize_handle()
RETURNS TRIGGER AS $$
BEGIN
  -- Trim whitespace
  NEW.handle = TRIM(NEW.handle);
  
  -- Remove all leading @ symbols
  NEW.handle = REGEXP_REPLACE(NEW.handle, '^@+', '');
  
  -- Prepend exactly one @
  NEW.handle = '@' || NEW.handle;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER normalize_page_handle
  BEFORE INSERT OR UPDATE ON public.pages
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_handle();

-- 5. URL validation function for pages
CREATE OR REPLACE FUNCTION public.validate_page_url()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.platform = 'tiktok' AND NEW.url !~ '^https?://(www\.)?tiktok\.com/.*' THEN
    RAISE EXCEPTION 'The URL must be a TikTok link';
  END IF;
  
  IF NEW.platform = 'instagram' AND NEW.url !~ '^https?://(www\.)?instagram\.com/.*' THEN
    RAISE EXCEPTION 'The URL must be an Instagram link';
  END IF;
  
  IF NEW.platform = 'youtube' AND NEW.url !~ '^https?://(www\.)?(youtube\.com|youtu\.be)/.*' THEN
    RAISE EXCEPTION 'The URL must be a YouTube link';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_page_url_trigger
  BEFORE INSERT OR UPDATE ON public.pages
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_page_url();

-- 6. Compute payout function
CREATE OR REPLACE FUNCTION public.compute_payout(views_count integer)
RETURNS numeric AS $$
DECLARE
  payout numeric;
BEGIN
  SELECT payout_brl INTO payout
  FROM public.payout_tiers
  WHERE views_count >= min_views 
    AND (max_views IS NULL OR views_count <= max_views)
  ORDER BY min_views DESC
  LIMIT 1;
  
  RETURN COALESCE(payout, 0);
END;
$$ LANGUAGE plpgsql STABLE;

-- 7. Creator count view
CREATE OR REPLACE VIEW public.creator_count_v AS
SELECT COUNT(DISTINCT u.id) as creator_count
FROM auth.users u
LEFT JOIN public.user_roles ur ON u.id = ur.user_id AND ur.role = 'creator'
LEFT JOIN public.pages p ON u.id = p.user_id
LEFT JOIN public.profiles prof ON u.id = prof.id
WHERE (ur.id IS NOT NULL OR p.id IS NOT NULL)
  AND COALESCE(prof.id, u.id) IS NOT NULL;

-- 8. Reverse submission payout function
CREATE OR REPLACE FUNCTION public.reverse_submission_payout(submission_id uuid)
RETURNS void AS $$
DECLARE
  existing_accrual numeric;
  submission_user_id uuid;
BEGIN
  -- Get the existing accrual for this submission
  SELECT COALESCE(SUM(amount), 0), user_id
  INTO existing_accrual, submission_user_id
  FROM public.ledger
  WHERE ref_id = submission_id AND type = 'accrual'
  GROUP BY user_id;
  
  IF existing_accrual > 0 THEN
    -- Create negative ledger entry
    INSERT INTO public.ledger (user_id, amount, type, ref_id, description)
    VALUES (
      submission_user_id,
      -existing_accrual,
      'reversal',
      submission_id,
      'Payout reversal due to submission deletion'
    );
    
    -- Update wallet balances
    UPDATE public.profiles
    SET 
      balance_total = balance_total - existing_accrual,
      balance_available = balance_available - existing_accrual
    WHERE id = submission_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Finalize submission payout function
CREATE OR REPLACE FUNCTION public.finalize_submission_payout(sub_id uuid)
RETURNS void AS $$
DECLARE
  views_48h integer;
  payout_amount numeric;
  submission_user_id uuid;
  submission_status text;
BEGIN
  -- Get the 48h snapshot and submission details
  SELECT s.views_count, s.user_id, s.status
  INTO views_48h, submission_user_id, submission_status
  FROM public.submissions s
  WHERE s.id = sub_id;
  
  -- Only process if not deleted
  IF submission_status = 'deleted' THEN
    RETURN;
  END IF;
  
  -- Compute payout
  payout_amount := public.compute_payout(views_48h);
  
  IF payout_amount > 0 THEN
    -- Create ledger accrual
    INSERT INTO public.ledger (user_id, amount, type, ref_id, description)
    VALUES (
      submission_user_id,
      payout_amount,
      'accrual',
      sub_id,
      'Submission payout at 48h: ' || views_48h || ' views'
    );
    
    -- Update wallet
    UPDATE public.profiles
    SET 
      balance_total = balance_total + payout_amount,
      balance_available = balance_available + payout_amount,
      total_earnings = total_earnings + payout_amount
    WHERE id = submission_user_id;
    
    -- Update submission
    UPDATE public.submissions
    SET payment_amount = payout_amount
    WHERE id = sub_id;
    
    -- Log to audit
    INSERT INTO public.audit_logs (entity_type, action, entity_id, actor_id, metadata)
    VALUES (
      'submission',
      'payout_finalized',
      sub_id,
      submission_user_id,
      jsonb_build_object('views_48h', views_48h, 'payout', payout_amount)
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;