-- Drop overly permissive policies
DROP POLICY IF EXISTS "Anyone can create a profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create proper RLS policies for profiles
-- Since we don't have auth yet, we'll use a session-based approach with email matching
CREATE POLICY "Profiles are viewable by profile owner via email" 
ON public.profiles 
FOR SELECT 
USING (email = current_setting('request.jwt.claims', true)::json->>'email' OR user_id = auth.uid());

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (user_id = auth.uid());