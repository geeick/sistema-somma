-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'finance', 'creator');

-- Create user_roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles table
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Update campaigns table to add more admin fields
ALTER TABLE public.campaigns
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Add admin policies for campaigns
CREATE POLICY "Admins can create campaigns"
ON public.campaigns
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update campaigns"
ON public.campaigns
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete campaigns"
ON public.campaigns
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all campaigns"
ON public.campaigns
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Add admin policies for submissions (moderation queue)
CREATE POLICY "Admins can view all submissions"
ON public.submissions
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update submissions"
ON public.submissions
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Add finance role policies for withdrawals
CREATE POLICY "Finance can view all withdrawals"
ON public.withdrawals
FOR SELECT
USING (public.has_role(auth.uid(), 'finance') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Finance can update withdrawals"
ON public.withdrawals
FOR UPDATE
USING (public.has_role(auth.uid(), 'finance') OR public.has_role(auth.uid(), 'admin'));