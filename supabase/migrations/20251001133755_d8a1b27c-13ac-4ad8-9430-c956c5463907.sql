-- Create profiles table for creator information
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  total_earnings DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Create enum for platform types
CREATE TYPE public.platform_type AS ENUM ('instagram', 'tiktok', 'youtube_shorts');

-- Create enum for video status
CREATE TYPE public.video_status AS ENUM ('pending', 'approved', 'rejected', 'paid');

-- Create videos table
CREATE TABLE public.videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  platform platform_type NOT NULL,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  views_count INTEGER,
  post_url TEXT,
  status video_status DEFAULT 'pending',
  payment_amount DECIMAL(10, 2),
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on videos
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- Videos policies
CREATE POLICY "Users can view their own videos"
  ON public.videos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own videos"
  ON public.videos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own videos"
  ON public.videos FOR UPDATE
  USING (auth.uid() = user_id);

-- Create storage bucket for videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('videos', 'videos', true);

-- Storage policies for videos bucket
CREATE POLICY "Users can upload their own videos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view videos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'videos');

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name'
  );
  RETURN NEW;
END;
$$;

-- Trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();