-- Function to automatically expire campaigns past their end date
CREATE OR REPLACE FUNCTION public.expire_past_campaigns()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update campaigns that are active but past their end date
  UPDATE public.campaigns
  SET status = 'closed'
  WHERE status = 'active'
    AND end_date < NOW();
END;
$$;

-- Create a cron job to run the expiration function every hour
SELECT cron.schedule(
  'expire-campaigns-hourly',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT public.expire_past_campaigns();
  $$
);