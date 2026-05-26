-- Fix security issues from previous migration

-- 1. Drop and recreate creator_count_v without exposing auth.users (without SECURITY INVOKER)
DROP VIEW IF EXISTS public.creator_count_v;

CREATE VIEW public.creator_count_v AS
SELECT COUNT(DISTINCT prof.id) as creator_count
FROM public.profiles prof
LEFT JOIN public.user_roles ur ON prof.id = ur.user_id AND ur.role = 'creator'
LEFT JOIN public.pages p ON prof.id = p.user_id
WHERE (ur.id IS NOT NULL OR p.id IS NOT NULL);

-- 2. Add search_path to all functions created in previous migration
CREATE OR REPLACE FUNCTION public.normalize_handle()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.handle = TRIM(NEW.handle);
  NEW.handle = REGEXP_REPLACE(NEW.handle, '^@+', '');
  NEW.handle = '@' || NEW.handle;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_page_url()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.compute_payout(views_count integer)
RETURNS numeric 
LANGUAGE plpgsql 
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.reverse_submission_payout(submission_id uuid)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_accrual numeric;
  submission_user_id uuid;
BEGIN
  SELECT COALESCE(SUM(amount), 0), user_id
  INTO existing_accrual, submission_user_id
  FROM public.ledger
  WHERE ref_id = submission_id AND type = 'accrual'
  GROUP BY user_id;
  
  IF existing_accrual > 0 THEN
    INSERT INTO public.ledger (user_id, amount, type, ref_id, description)
    VALUES (
      submission_user_id,
      -existing_accrual,
      'reversal',
      submission_id,
      'Payout reversal due to submission deletion'
    );
    
    UPDATE public.profiles
    SET 
      balance_total = balance_total - existing_accrual,
      balance_available = balance_available - existing_accrual
    WHERE id = submission_user_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_submission_payout(sub_id uuid)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  views_48h integer;
  payout_amount numeric;
  submission_user_id uuid;
  submission_status text;
BEGIN
  SELECT s.views_count, s.user_id, s.status
  INTO views_48h, submission_user_id, submission_status
  FROM public.submissions s
  WHERE s.id = sub_id;
  
  IF submission_status = 'deleted' THEN
    RETURN;
  END IF;
  
  payout_amount := public.compute_payout(views_48h);
  
  IF payout_amount > 0 THEN
    INSERT INTO public.ledger (user_id, amount, type, ref_id, description)
    VALUES (
      submission_user_id,
      payout_amount,
      'accrual',
      sub_id,
      'Submission payout at 48h: ' || views_48h || ' views'
    );
    
    UPDATE public.profiles
    SET 
      balance_total = balance_total + payout_amount,
      balance_available = balance_available + payout_amount,
      total_earnings = total_earnings + payout_amount
    WHERE id = submission_user_id;
    
    UPDATE public.submissions
    SET payment_amount = payout_amount
    WHERE id = sub_id;
    
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
$$;