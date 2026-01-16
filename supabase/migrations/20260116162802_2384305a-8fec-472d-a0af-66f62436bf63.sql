-- Create OTP codes table for WhatsApp verification
CREATE TABLE public.otp_codes (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    phone_number TEXT NOT NULL,
    country_code TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for fast lookups
CREATE INDEX idx_otp_codes_phone ON public.otp_codes (country_code, phone_number, code);

-- Add phone_verified column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;

-- Enable RLS
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- Public insert policy (for sending OTP)
CREATE POLICY "Anyone can create OTP codes" 
ON public.otp_codes 
FOR INSERT 
WITH CHECK (true);

-- Public select policy (for verifying OTP)
CREATE POLICY "Anyone can read OTP codes" 
ON public.otp_codes 
FOR SELECT 
USING (true);

-- Public update policy (for marking as verified)
CREATE POLICY "Anyone can update OTP codes" 
ON public.otp_codes 
FOR UPDATE 
USING (true);

-- Auto-cleanup old OTP codes (optional trigger)
CREATE OR REPLACE FUNCTION public.cleanup_expired_otp_codes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.otp_codes WHERE expires_at < now() - interval '1 hour';
  RETURN NEW;
END;
$$;

CREATE TRIGGER cleanup_otp_on_insert
AFTER INSERT ON public.otp_codes
FOR EACH STATEMENT
EXECUTE FUNCTION public.cleanup_expired_otp_codes();