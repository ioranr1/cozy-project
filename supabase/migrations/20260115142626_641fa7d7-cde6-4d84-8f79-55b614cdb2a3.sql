-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  country_code TEXT NOT NULL DEFAULT '+972',
  preferred_language TEXT NOT NULL DEFAULT 'he',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create devices table for cameras
CREATE TABLE public.devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  device_type TEXT NOT NULL CHECK (device_type IN ('camera', 'viewer')),
  is_active BOOLEAN NOT NULL DEFAULT false,
  last_seen_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles (allow public insert for registration, then user-based access)
CREATE POLICY "Anyone can create a profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (true);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (id = id);

-- RLS Policies for devices
CREATE POLICY "Users can view their own devices" 
ON public.devices 
FOR SELECT 
USING (profile_id IN (SELECT id FROM public.profiles));

CREATE POLICY "Users can create their own devices" 
ON public.devices 
FOR INSERT 
WITH CHECK (profile_id IN (SELECT id FROM public.profiles));

CREATE POLICY "Users can update their own devices" 
ON public.devices 
FOR UPDATE 
USING (profile_id IN (SELECT id FROM public.profiles));

CREATE POLICY "Users can delete their own devices" 
ON public.devices 
FOR DELETE 
USING (profile_id IN (SELECT id FROM public.profiles));

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();