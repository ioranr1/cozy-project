-- Fix RLS for anon device registration/updates without exposing profiles
-- Reason: policies that reference public.profiles via subquery can fail under RLS (anon cannot SELECT profiles)

-- Ensure RLS is enabled (idempotent)
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;

-- Helper function to validate that a profile exists (bypasses RLS safely)
CREATE OR REPLACE FUNCTION public.profile_exists(_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = _profile_id
  );
$$;

-- Recreate policies to use the SECURITY DEFINER function
DROP POLICY IF EXISTS "Allow device registration with valid profile" ON public.devices;
DROP POLICY IF EXISTS "Allow device updates" ON public.devices;

CREATE POLICY "Allow device registration with valid profile"
ON public.devices
FOR INSERT
WITH CHECK (
  public.profile_exists(profile_id)
);

CREATE POLICY "Allow device updates"
ON public.devices
FOR UPDATE
USING (
  public.profile_exists(profile_id)
)
WITH CHECK (
  public.profile_exists(profile_id)
);
