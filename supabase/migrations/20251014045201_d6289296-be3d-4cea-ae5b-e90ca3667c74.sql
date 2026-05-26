-- Add platform-specific audio URLs field to campaigns table
ALTER TABLE public.campaigns 
ADD COLUMN audio_urls JSONB DEFAULT '{}'::jsonb;

-- Migrate existing audio_url to audio_urls if present
UPDATE public.campaigns 
SET audio_urls = jsonb_build_object('general', audio_url)
WHERE audio_url IS NOT NULL AND audio_url != '';

-- audio_url column can be kept for backward compatibility or dropped later