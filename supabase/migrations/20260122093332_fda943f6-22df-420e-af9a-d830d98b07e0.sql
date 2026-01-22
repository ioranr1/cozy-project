-- Insert a new session for the existing profile with the token from localStorage
INSERT INTO public.user_sessions (
  profile_id,
  session_token,
  expires_at
) VALUES (
  '3eee6480-23f2-401b-ab26-72e9ed5b4cf8',
  '0c5a161310a40323779f70501aaae739c78f44070f79decce67c9a8c4914eb1e',
  now() + interval '30 days'
);