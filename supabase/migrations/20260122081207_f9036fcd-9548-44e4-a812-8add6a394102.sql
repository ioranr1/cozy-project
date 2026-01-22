-- Create pairing_codes table for device pairing
CREATE TABLE public.pairing_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  used_by_device_id UUID REFERENCES public.devices(id) ON DELETE SET NULL
);

-- Create index for fast code lookup
CREATE INDEX idx_pairing_codes_code ON public.pairing_codes(code);
CREATE INDEX idx_pairing_codes_profile_id ON public.pairing_codes(profile_id);

-- Enable RLS
ALTER TABLE public.pairing_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies - users can only see their own codes
CREATE POLICY "Users can view their own pairing codes"
ON public.pairing_codes
FOR SELECT
USING (profile_id IN (
  SELECT id FROM profiles WHERE user_id = auth.uid()
));

CREATE POLICY "Users can create their own pairing codes"
ON public.pairing_codes
FOR INSERT
WITH CHECK (profile_id IN (
  SELECT id FROM profiles WHERE user_id = auth.uid()
));

-- Allow service role to update (for marking as used)
CREATE POLICY "Service role can update pairing codes"
ON public.pairing_codes
FOR UPDATE
USING (true);

-- Cleanup function to delete expired codes
CREATE OR REPLACE FUNCTION public.cleanup_expired_pairing_codes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.pairing_codes WHERE expires_at < now() - interval '1 hour';
  RETURN NEW;
END;
$$;

-- Trigger to cleanup on new inserts
CREATE TRIGGER cleanup_pairing_codes_trigger
AFTER INSERT ON public.pairing_codes
FOR EACH STATEMENT
EXECUTE FUNCTION public.cleanup_expired_pairing_codes();