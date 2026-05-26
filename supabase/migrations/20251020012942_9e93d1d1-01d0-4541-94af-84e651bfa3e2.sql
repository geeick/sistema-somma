-- Enable pg_cron if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule finalize-payouts to run every hour (check for duplicates first)
DO $$
BEGIN
  -- Try to unschedule if it exists
  BEGIN
    PERFORM cron.unschedule('finalize-payouts-hourly');
  EXCEPTION
    WHEN OTHERS THEN
      NULL; -- Ignore if doesn't exist
  END;
END $$;

-- Schedule the job
SELECT cron.schedule(
  'finalize-payouts-hourly',
  '0 * * * *', -- Every hour
  $$
  SELECT
    net.http_post(
        url:='https://zhjncynsyilflhrroelo.supabase.co/functions/v1/finalize-payouts',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpoam5jeW5zeWlsZmxocnJvZWxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDI3MzIsImV4cCI6MjA3NDgxODczMn0.-XI0QbFW02v5jLQxUncxNJkxRfZ43NGO_0vnM7Mh8f4"}'::jsonb,
        body:='{}'::jsonb
    ) as request_id;
  $$
);