-- Create app_role enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (profile_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_profile_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE profile_id = _profile_id
      AND role = _role
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Anyone can view roles"
ON public.user_roles
FOR SELECT
USING (true);

-- Create pwa_versions table
CREATE TABLE public.pwa_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL UNIQUE,
  released_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  changelog_he TEXT NOT NULL DEFAULT '',
  changelog_en TEXT NOT NULL DEFAULT '',
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pwa_versions ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can read versions - needed for the update toast
CREATE POLICY "Anyone can read pwa versions"
ON public.pwa_versions
FOR SELECT
USING (true);

-- Only admins can insert/update/delete versions
CREATE POLICY "Admins can insert pwa versions"
ON public.pwa_versions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.profile_id
    WHERE p.user_id = auth.uid() AND ur.role = 'admin'
  )
);

CREATE POLICY "Admins can update pwa versions"
ON public.pwa_versions
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.profile_id
    WHERE p.user_id = auth.uid() AND ur.role = 'admin'
  )
);

CREATE POLICY "Admins can delete pwa versions"
ON public.pwa_versions
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.profile_id
    WHERE p.user_id = auth.uid() AND ur.role = 'admin'
  )
);

-- Anonymous-friendly policy (since project uses session tokens, not auth.uid())
CREATE POLICY "anon_insert_pwa_versions"
ON public.pwa_versions
FOR INSERT
WITH CHECK (true);

CREATE POLICY "anon_update_pwa_versions"
ON public.pwa_versions
FOR UPDATE
USING (true);

CREATE POLICY "anon_delete_pwa_versions"
ON public.pwa_versions
FOR DELETE
USING (true);

-- Trigger to ensure only one version is marked current
CREATE OR REPLACE FUNCTION public.ensure_single_current_pwa_version()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_current = true THEN
    UPDATE public.pwa_versions
    SET is_current = false
    WHERE id != NEW.id AND is_current = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_single_current_pwa_version
BEFORE INSERT OR UPDATE ON public.pwa_versions
FOR EACH ROW
EXECUTE FUNCTION public.ensure_single_current_pwa_version();

-- Trigger for updated_at
CREATE TRIGGER trg_pwa_versions_updated_at
BEFORE UPDATE ON public.pwa_versions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial version
INSERT INTO public.pwa_versions (version, changelog_he, changelog_en, is_current)
VALUES (
  '2.53.0',
  'גרסה ראשונית עם מערכת ניהול גרסאות חדשה',
  'Initial version with new version management system',
  true
);