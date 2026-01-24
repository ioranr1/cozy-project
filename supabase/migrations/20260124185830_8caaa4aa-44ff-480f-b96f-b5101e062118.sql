-- Create feature_flags table for controlling feature rollout
CREATE TABLE public.feature_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated and anonymous users to read feature flags
CREATE POLICY "Anyone can read feature flags"
ON public.feature_flags
FOR SELECT
USING (true);

-- Insert initial feature flags with away_mode enabled
INSERT INTO public.feature_flags (name, enabled) VALUES
  ('away_mode', true),
  ('security_mode', false);

-- Add to realtime publication for instant UI updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.feature_flags;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_feature_flags_updated_at
BEFORE UPDATE ON public.feature_flags
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();