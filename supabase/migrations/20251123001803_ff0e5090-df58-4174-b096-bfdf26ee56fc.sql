-- Create error logs table for tracking application errors
CREATE TABLE IF NOT EXISTS public.error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  error_code TEXT NOT NULL,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  page_url TEXT,
  user_agent TEXT,
  severity TEXT DEFAULT 'error' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  metadata JSONB DEFAULT '{}'::jsonb,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Anyone can insert errors"
  ON public.error_logs
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can view their own errors"
  ON public.error_logs
  FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Admins can view all errors"
  ON public.error_logs
  FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update errors"
  ON public.error_logs
  FOR UPDATE
  USING (is_admin(auth.uid()));

-- Create index for performance
CREATE INDEX idx_error_logs_created_at ON public.error_logs(created_at DESC);
CREATE INDEX idx_error_logs_user_id ON public.error_logs(user_id);
CREATE INDEX idx_error_logs_resolved ON public.error_logs(resolved);