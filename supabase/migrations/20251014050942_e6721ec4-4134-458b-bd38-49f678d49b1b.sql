-- Step 0: Create is_admin helper function
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id = uid AND role = 'admin'
  );
$$;

-- Create missing core tables for admin modules

-- Tags table
CREATE TABLE IF NOT EXISTS public.tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  active BOOLEAN DEFAULT true,
  synonyms TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Page-Tags join table
CREATE TABLE IF NOT EXISTS public.page_tags (
  page_id UUID REFERENCES public.pages(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES public.tags(id) ON DELETE RESTRICT,
  PRIMARY KEY (page_id, tag_id)
);

-- Strikes table
CREATE TABLE IF NOT EXISTS public.strikes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  level TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  removed_at TIMESTAMP WITH TIME ZONE,
  removed_by UUID REFERENCES auth.users(id)
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  before_state JSONB,
  after_state JSONB,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- System templates for emails
CREATE TABLE IF NOT EXISTS public.system_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  body_md TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Feature flags
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  enabled BOOLEAN DEFAULT false,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Webhooks
CREATE TABLE IF NOT EXISTS public.webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  events TEXT[] NOT NULL,
  active BOOLEAN DEFAULT true,
  secret TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.strikes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;

-- Admin-only policies for new tables
CREATE POLICY "admin all on tags" ON public.tags FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admin all on page_tags" ON public.page_tags FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admin all on strikes" ON public.strikes FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admin all on audit_logs" ON public.audit_logs FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admin all on system_templates" ON public.system_templates FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admin all on feature_flags" ON public.feature_flags FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "admin all on webhooks" ON public.webhooks FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Add admin policies to existing tables (keeping existing creator policies)
DROP POLICY IF EXISTS "admin all on campaigns" ON public.campaigns;
CREATE POLICY "admin all on campaigns" ON public.campaigns FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin all on pages" ON public.pages;
CREATE POLICY "admin all on pages" ON public.pages FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin all on ledger" ON public.ledger;
CREATE POLICY "admin all on ledger" ON public.ledger FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin all on withdrawals" ON public.withdrawals;
CREATE POLICY "admin all on withdrawals" ON public.withdrawals FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin all on snapshots" ON public.snapshots;
CREATE POLICY "admin all on snapshots" ON public.snapshots FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin all on rankings" ON public.rankings;
CREATE POLICY "admin all on rankings" ON public.rankings FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin all on campaign_participants" ON public.campaign_participants;
CREATE POLICY "admin all on campaign_participants" ON public.campaign_participants FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admin all on profiles" ON public.profiles;
CREATE POLICY "admin all on profiles" ON public.profiles FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Add triggers for updated_at
CREATE TRIGGER update_tags_updated_at BEFORE UPDATE ON public.tags FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_system_templates_updated_at BEFORE UPDATE ON public.system_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_feature_flags_updated_at BEFORE UPDATE ON public.feature_flags FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON public.webhooks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Insert initial feature flags
INSERT INTO public.feature_flags (key, enabled, description) VALUES
  ('leaderboard_enabled', true, 'Enable campaign leaderboards'),
  ('audio_fingerprint_phase2', false, 'Enable advanced audio fingerprinting'),
  ('allow_resubmission', false, 'Allow creators to resubmit rejected content'),
  ('auto_payout_on_approval', false, 'Automatically make payouts available on approval')
ON CONFLICT (key) DO NOTHING;