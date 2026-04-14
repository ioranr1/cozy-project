
CREATE POLICY "anon_delete_device_diagnostics"
ON public.device_diagnostics
FOR DELETE
TO anon, authenticated
USING (true);
