-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule Instagram metrics sync to run every 6 hours
SELECT cron.schedule(
  'sync-instagram-metrics-every-6h',
  '0 */6 * * *', -- Every 6 hours at minute 0
  $$
  SELECT
    net.http_post(
        url:='https://zhjncynsyilflhrroelo.supabase.co/functions/v1/sync-instagram-metrics',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpoam5jeW5zeWlsZmxocnJvZWxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDI3MzIsImV4cCI6MjA3NDgxODczMn0.-XI0QbFW02v5jLQxUncxNJkxRfZ43NGO_0vnM7Mh8f4"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);

-- Create function to trigger Instagram sync for new submissions
CREATE OR REPLACE FUNCTION trigger_instagram_sync()
RETURNS trigger AS $$
BEGIN
  -- Only trigger sync for Instagram posts
  IF NEW.platform = 'instagram' AND NEW.post_url IS NOT NULL THEN
    PERFORM net.http_post(
      url := 'https://zhjncynsyilflhrroelo.supabase.co/functions/v1/sync-instagram-metrics',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpoam5jeW5zeWlsZmxocnJvZWxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDI3MzIsImV4cCI6MjA3NDgxODczMn0.-XI0QbFW02v5jLQxUncxNJkxRfZ43NGO_0vnM7Mh8f4"}'::jsonb,
      body := '{}'::jsonb
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically sync Instagram metrics when a submission is created
DROP TRIGGER IF EXISTS on_submission_created_sync_instagram ON public.submissions;
CREATE TRIGGER on_submission_created_sync_instagram
  AFTER INSERT ON public.submissions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_instagram_sync();