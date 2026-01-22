-- Fix: Update RLS policies to use the profile_exists function instead of subqueries

DROP POLICY IF EXISTS "Allow device registration with valid profile" ON public.devices;
DROP POLICY IF EXISTS "Allow device updates" ON public.devices;
DROP POLICY IF EXISTS "Users can view their own devices" ON public.devices;
DROP POLICY IF EXISTS "Users can delete their own devices" ON public.devices;

-- INSERT: allow anon and authenticated if profile_id is valid
CREATE POLICY "Allow device registration with valid profile"
ON public.devices
FOR INSERT
WITH CHECK (
  public.profile_exists(profile_id)
);

-- UPDATE: allow anon and authenticated if profile_id is valid  
CREATE POLICY "Allow device updates"
ON public.devices
FOR UPDATE
USING (
  public.profile_exists(profile_id)
)
WITH CHECK (
  public.profile_exists(profile_id)
);

-- SELECT: for authenticated users who own the profile
CREATE POLICY "Users can view their own devices"
ON public.devices
FOR SELECT
USING (
  public.profile_exists(profile_id)
);

-- DELETE: for authenticated users who own the profile
CREATE POLICY "Users can delete their own devices"
ON public.devices
FOR DELETE
USING (
  public.profile_exists(profile_id)
);