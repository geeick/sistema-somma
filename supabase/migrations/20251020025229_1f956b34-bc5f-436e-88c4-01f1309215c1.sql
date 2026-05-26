-- Add campaign code column
ALTER TABLE public.campaigns
ADD COLUMN code TEXT;

-- Create unique index on code to ensure uniqueness
CREATE UNIQUE INDEX campaigns_code_unique ON public.campaigns(code) WHERE code IS NOT NULL;

-- Remove description column
ALTER TABLE public.campaigns
DROP COLUMN IF EXISTS description;