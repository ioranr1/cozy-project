-- Create user sessions table for persistent login
CREATE TABLE public.user_sessions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    session_token TEXT NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
    device_fingerprint TEXT,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add unique constraint on session token
CREATE UNIQUE INDEX idx_user_sessions_token ON public.user_sessions (session_token);

-- Add index for profile lookups
CREATE INDEX idx_user_sessions_profile ON public.user_sessions (profile_id);

-- Enable RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Public policies for session management (edge functions handle security)
CREATE POLICY "Anyone can create sessions" 
ON public.user_sessions 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Anyone can read sessions" 
ON public.user_sessions 
FOR SELECT 
USING (true);

CREATE POLICY "Anyone can update sessions" 
ON public.user_sessions 
FOR UPDATE 
USING (true);

CREATE POLICY "Anyone can delete sessions" 
ON public.user_sessions 
FOR DELETE 
USING (true);

-- Function to validate session token
CREATE OR REPLACE FUNCTION public.validate_user_session(p_token TEXT)
RETURNS TABLE(
    profile_id UUID,
    is_valid BOOLEAN,
    profile_data JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.profile_id,
        CASE 
            WHEN s.id IS NULL THEN false
            WHEN s.expires_at < now() THEN false
            ELSE true
        END as is_valid,
        CASE
            WHEN s.id IS NOT NULL AND s.expires_at >= now() THEN
                jsonb_build_object(
                    'id', p.id,
                    'full_name', p.full_name,
                    'email', p.email,
                    'phone_number', p.phone_number,
                    'country_code', p.country_code,
                    'phone_verified', p.phone_verified
                )
            ELSE NULL
        END as profile_data
    FROM public.user_sessions s
    LEFT JOIN public.profiles p ON p.id = s.profile_id
    WHERE s.session_token = p_token;
    
    -- Update last_used_at if valid
    UPDATE public.user_sessions
    SET last_used_at = now()
    WHERE session_token = p_token AND expires_at >= now();
END;
$$;

-- Cleanup old sessions trigger
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    DELETE FROM public.user_sessions WHERE expires_at < now() - interval '1 day';
    RETURN NEW;
END;
$$;

CREATE TRIGGER cleanup_sessions_on_insert
AFTER INSERT ON public.user_sessions
FOR EACH STATEMENT
EXECUTE FUNCTION public.cleanup_expired_sessions();