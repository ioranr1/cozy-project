-- Allow anonymous INSERT into device_status (needed for initial row creation)
-- NOTE: This project uses a custom session model (user_sessions) and anon clients.

DROP POLICY IF EXISTS "anon_insert_device_status" ON public.device_status;

CREATE POLICY "anon_insert_device_status"
ON public.device_status
FOR INSERT
WITH CHECK (true);
