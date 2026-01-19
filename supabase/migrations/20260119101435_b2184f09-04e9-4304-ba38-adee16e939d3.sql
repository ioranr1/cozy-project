-- Create table to store user reports about camera/DB desync
CREATE TABLE IF NOT EXISTS public.camera_desync_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  reporter_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  issue TEXT NOT NULL,
  resolved_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_camera_desync_reports_device_created_at
  ON public.camera_desync_reports (device_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_camera_desync_reports_reporter_created_at
  ON public.camera_desync_reports (reporter_profile_id, created_at DESC);

ALTER TABLE public.camera_desync_reports ENABLE ROW LEVEL SECURITY;

-- Only the authenticated owner of the device can create a report
CREATE POLICY "Owners can create camera desync reports"
ON public.camera_desync_reports
FOR INSERT
WITH CHECK (
  reporter_profile_id IN (
    SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
  AND device_id IN (
    SELECT d.id
    FROM public.devices d
    WHERE d.profile_id IN (
      SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()
    )
  )
);

-- Only the authenticated owner can view their reports
CREATE POLICY "Owners can view camera desync reports"
ON public.camera_desync_reports
FOR SELECT
USING (
  reporter_profile_id IN (
    SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
);

-- Optional: allow owners to mark their report resolved
CREATE POLICY "Owners can resolve camera desync reports"
ON public.camera_desync_reports
FOR UPDATE
USING (
  reporter_profile_id IN (
    SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
)
WITH CHECK (
  reporter_profile_id IN (
    SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
);