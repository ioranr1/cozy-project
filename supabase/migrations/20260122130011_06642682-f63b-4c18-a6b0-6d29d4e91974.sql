-- Drop and recreate the INSERT policy for devices to allow anonymous device registration
-- This is needed because the Electron app doesn't use Supabase Auth

DROP POLICY IF EXISTS "Users can create their own devices" ON public.devices;

-- Create a new policy that allows inserting devices when profile_id exists
-- The Electron app registers devices via the verify-pairing-code edge function
-- but we also need to allow direct inserts for the agent
CREATE POLICY "Allow device registration with valid profile"
ON public.devices
FOR INSERT
WITH CHECK (
  profile_id IN (SELECT id FROM public.profiles)
);

-- Also add a policy for anon to update devices (for heartbeat, last_seen_at)
DROP POLICY IF EXISTS "Users can update their own devices" ON public.devices;

CREATE POLICY "Allow device updates"
ON public.devices
FOR UPDATE
USING (
  profile_id IN (SELECT id FROM public.profiles)
);