-- Step 1: Add device_auth_token to devices table
ALTER TABLE public.devices 
ADD COLUMN device_auth_token TEXT UNIQUE,
ADD COLUMN device_auth_token_created_at TIMESTAMP WITH TIME ZONE;

-- Create index for fast token lookups
CREATE INDEX idx_devices_auth_token ON public.devices(device_auth_token) WHERE device_auth_token IS NOT NULL;

-- Step 2: Create live_sessions table for tracking active video sessions
CREATE TABLE public.live_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  viewer_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ended_at TIMESTAMP WITH TIME ZONE,
  max_duration_seconds INTEGER NOT NULL DEFAULT 60,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'ended', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Ensure only one active session per device
CREATE UNIQUE INDEX idx_live_sessions_active_device 
ON public.live_sessions(device_id) 
WHERE status IN ('pending', 'active');

-- Enable RLS
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies for live_sessions
CREATE POLICY "Device owners can view their device sessions"
ON public.live_sessions FOR SELECT
USING (
  device_id IN (
    SELECT d.id FROM public.devices d
    WHERE d.profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Device owners can create sessions for their devices"
ON public.live_sessions FOR INSERT
WITH CHECK (
  device_id IN (
    SELECT d.id FROM public.devices d
    WHERE d.profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
  AND viewer_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Device owners can update their device sessions"
ON public.live_sessions FOR UPDATE
USING (
  device_id IN (
    SELECT d.id FROM public.devices d
    WHERE d.profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
);

-- Step 3: Create access_tokens table for public watch links
CREATE TABLE public.access_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  created_by_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  max_views INTEGER,
  current_views INTEGER NOT NULL DEFAULT 0,
  is_revoked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast token lookups
CREATE INDEX idx_access_tokens_token ON public.access_tokens(token) WHERE is_revoked = false;

-- Enable RLS
ALTER TABLE public.access_tokens ENABLE ROW LEVEL SECURITY;

-- RLS policies for access_tokens
CREATE POLICY "Device owners can view their access tokens"
ON public.access_tokens FOR SELECT
USING (
  created_by_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Device owners can create access tokens"
ON public.access_tokens FOR INSERT
WITH CHECK (
  device_id IN (
    SELECT d.id FROM public.devices d
    WHERE d.profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
  )
  AND created_by_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Device owners can update their access tokens"
ON public.access_tokens FOR UPDATE
USING (
  created_by_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Device owners can delete their access tokens"
ON public.access_tokens FOR DELETE
USING (
  created_by_profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- Function to check if access token is valid (for public access)
CREATE OR REPLACE FUNCTION public.validate_access_token(p_token TEXT)
RETURNS TABLE (
  device_id UUID,
  is_valid BOOLEAN,
  reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    at.device_id,
    CASE 
      WHEN at.id IS NULL THEN false
      WHEN at.is_revoked THEN false
      WHEN at.expires_at < now() THEN false
      WHEN at.max_views IS NOT NULL AND at.current_views >= at.max_views THEN false
      ELSE true
    END as is_valid,
    CASE 
      WHEN at.id IS NULL THEN 'Token not found'
      WHEN at.is_revoked THEN 'Token revoked'
      WHEN at.expires_at < now() THEN 'Token expired'
      WHEN at.max_views IS NOT NULL AND at.current_views >= at.max_views THEN 'Max views reached'
      ELSE 'Valid'
    END as reason
  FROM public.access_tokens at
  WHERE at.token = p_token;
END;
$$;