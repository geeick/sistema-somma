-- Add KYC fields to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS legal_name TEXT,
ADD COLUMN IF NOT EXISTS cpf TEXT,
ADD COLUMN IF NOT EXISTS pix_key TEXT,
ADD COLUMN IF NOT EXISTS date_of_birth DATE,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE;

-- Add unique constraint for CPF if column was just created
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_cpf_key'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_cpf_key UNIQUE (cpf);
  END IF;
END $$;

-- Create pages table for creator pages (TikTok, IG, YouTube)
CREATE TABLE IF NOT EXISTS public.pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform platform_type NOT NULL,
  handle TEXT NOT NULL,
  url TEXT NOT NULL,
  follower_count INTEGER,
  average_views INTEGER,
  tags TEXT[] DEFAULT '{}',
  verified BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own pages" ON public.pages;
CREATE POLICY "Users can view their own pages"
ON public.pages FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own pages" ON public.pages;
CREATE POLICY "Users can insert their own pages"
ON public.pages FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own pages" ON public.pages;
CREATE POLICY "Users can update their own pages"
ON public.pages FOR UPDATE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own pages" ON public.pages;
CREATE POLICY "Users can delete their own pages"
ON public.pages FOR DELETE
USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_pages_updated_at ON public.pages;
CREATE TRIGGER update_pages_updated_at
BEFORE UPDATE ON public.pages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Create campaigns table
CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  client TEXT,
  brief TEXT,
  budget NUMERIC,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  required_tags TEXT[] DEFAULT '{}',
  recommended_tags TEXT[] DEFAULT '{}',
  platforms platform_type[] DEFAULT '{}',
  audio_url TEXT,
  audio_reference TEXT,
  rules JSONB DEFAULT '{}',
  status TEXT DEFAULT 'draft',
  min_posts_per_creator INTEGER DEFAULT 1,
  max_posts_per_creator INTEGER DEFAULT 3,
  payout_model TEXT DEFAULT 'tiered',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active campaigns" ON public.campaigns;
CREATE POLICY "Anyone can view active campaigns"
ON public.campaigns FOR SELECT
USING (status = 'active');

DROP TRIGGER IF EXISTS update_campaigns_updated_at ON public.campaigns;
CREATE TRIGGER update_campaigns_updated_at
BEFORE UPDATE ON public.campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();

-- Create campaign_participants table
CREATE TABLE IF NOT EXISTS public.campaign_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, user_id)
);

ALTER TABLE public.campaign_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own participations" ON public.campaign_participants;
CREATE POLICY "Users can view their own participations"
ON public.campaign_participants FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can join campaigns" ON public.campaign_participants;
CREATE POLICY "Users can join campaigns"
ON public.campaign_participants FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Rename videos table to submissions if not already done
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'videos'
  ) THEN
    ALTER TABLE public.videos RENAME TO submissions;
  END IF;
END $$;

-- Add new columns to submissions
ALTER TABLE public.submissions
ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS page_id UUID REFERENCES public.pages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reason_code TEXT,
ADD COLUMN IF NOT EXISTS audio_verified BOOLEAN DEFAULT false;

-- Update video_url to be nullable
ALTER TABLE public.submissions ALTER COLUMN video_url DROP NOT NULL;

-- Create snapshots table
CREATE TABLE IF NOT EXISTS public.snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0
);

ALTER TABLE public.snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view snapshots of their submissions" ON public.snapshots;
CREATE POLICY "Users can view snapshots of their submissions"
ON public.snapshots FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.submissions
    WHERE submissions.id = snapshots.submission_id
    AND submissions.user_id = auth.uid()
  )
);

-- Create rankings table
CREATE TABLE IF NOT EXISTS public.rankings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score NUMERIC DEFAULT 0,
  tier INTEGER,
  provisional_payout NUMERIC DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, user_id)
);

ALTER TABLE public.rankings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own rankings" ON public.rankings;
CREATE POLICY "Users can view their own rankings"
ON public.rankings FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view all rankings for active campaigns" ON public.rankings;
CREATE POLICY "Anyone can view all rankings for active campaigns"
ON public.rankings FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.campaigns
    WHERE campaigns.id = rankings.campaign_id
    AND campaigns.status = 'active'
  )
);

-- Create withdrawals table
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  pix_key TEXT NOT NULL,
  status TEXT DEFAULT 'requested',
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  approved_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  receipt_ref TEXT
);

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own withdrawals" ON public.withdrawals;
CREATE POLICY "Users can view their own withdrawals"
ON public.withdrawals FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can request withdrawals" ON public.withdrawals;
CREATE POLICY "Users can request withdrawals"
ON public.withdrawals FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create ledger table
CREATE TABLE IF NOT EXISTS public.ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  ref_id UUID,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own ledger entries" ON public.ledger;
CREATE POLICY "Users can view their own ledger entries"
ON public.ledger FOR SELECT
USING (auth.uid() = user_id);