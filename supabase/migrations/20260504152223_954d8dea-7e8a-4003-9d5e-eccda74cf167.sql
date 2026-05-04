
DROP POLICY IF EXISTS "Admins can insert pwa versions" ON public.pwa_versions;
DROP POLICY IF EXISTS "Admins can update pwa versions" ON public.pwa_versions;
DROP POLICY IF EXISTS "Admins can delete pwa versions" ON public.pwa_versions;

CREATE POLICY "Anyone can insert pwa versions"
ON public.pwa_versions FOR INSERT
WITH CHECK (true);

CREATE POLICY "Anyone can update pwa versions"
ON public.pwa_versions FOR UPDATE
USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can delete pwa versions"
ON public.pwa_versions FOR DELETE
USING (true);
