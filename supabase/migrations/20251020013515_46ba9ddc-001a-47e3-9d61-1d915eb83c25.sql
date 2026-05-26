-- Fix URL validation function to use correct platform enum value
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
  
  IF NEW.platform = 'youtube_shorts' AND NEW.url !~ '^https?://(www\.)?(youtube\.com|youtu\.be)/.*' THEN
    RAISE EXCEPTION 'The URL must be a YouTube link';
  END IF;
  
  RETURN NEW;
END;
$$;