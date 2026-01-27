-- Expose ONLY the Auto-Away flag via a SECURITY DEFINER RPC (avoids making profiles table readable)
CREATE OR REPLACE FUNCTION public.get_profile_auto_away(_profile_id uuid)
RETURNS TABLE(profile_exists boolean, auto_away_enabled boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = _profile_id
    ) AS profile_exists,
    COALESCE(
      (
        SELECT p.auto_away_enabled
        FROM public.profiles p
        WHERE p.id = _profile_id
      ),
      false
    ) AS auto_away_enabled;
$$;

-- Allow anon/authenticated clients (Electron app uses anon key) to call it
GRANT EXECUTE ON FUNCTION public.get_profile_auto_away(uuid) TO anon, authenticated;
