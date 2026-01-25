-- Add policy to allow anonymous clients to view pairing codes for realtime subscription
-- This uses profile_exists which validates that the profile is valid
CREATE POLICY "Allow select pairing codes with valid profile"
ON public.pairing_codes
FOR SELECT
USING (profile_exists(profile_id));