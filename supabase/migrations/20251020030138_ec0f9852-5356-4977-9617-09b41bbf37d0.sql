-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule sync-instagram-metrics to run every 6 hours
SELECT cron.schedule(
  'sync-metrics-every-6h',
  '0 */6 * * *', -- Every 6 hours at minute 0
  $$
  SELECT
    net.http_post(
      url := 'https://zhjncynsyilflhrroelo.supabase.co/functions/v1/sync-instagram-metrics',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpoam5jeW5zeWlsZmxocnJvZWxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDI3MzIsImV4cCI6MjA3NDgxODczMn0.-XI0QbFW02v5jLQxUncxNJkxRfZ43NGO_0vnM7Mh8f4"}'::jsonb,
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- Create a function to calculate provisional payout based on current views
CREATE OR REPLACE FUNCTION public.calculate_provisional_payout()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Update all non-deleted submissions with provisional payment amounts
  UPDATE public.submissions s
  SET payment_amount = public.compute_payout(COALESCE(s.views_count, 0))
  WHERE s.status != 'deleted'
    AND s.payment_amount IS NULL;
END;
$$;

-- Create a view to show total campaign costs
CREATE OR REPLACE VIEW public.campaign_costs AS
SELECT 
  c.id as campaign_id,
  c.code,
  c.title,
  c.budget,
  COUNT(s.id) as total_submissions,
  SUM(COALESCE(s.payment_amount, 0)) as total_cost,
  SUM(COALESCE(s.views_count, 0)) as total_views,
  c.budget - SUM(COALESCE(s.payment_amount, 0)) as remaining_budget
FROM public.campaigns c
LEFT JOIN public.submissions s ON s.campaign_id = c.id AND s.status != 'deleted'
GROUP BY c.id, c.code, c.title, c.budget;

-- Grant access to the view
GRANT SELECT ON public.campaign_costs TO authenticated;
GRANT SELECT ON public.campaign_costs TO anon;