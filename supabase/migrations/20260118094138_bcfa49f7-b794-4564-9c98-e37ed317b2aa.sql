-- Insert laptop device for testing with correct device_type
INSERT INTO public.devices (
  id,
  profile_id,
  device_name,
  device_type,
  is_active,
  last_seen_at
) VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  '3eee6480-23f2-401b-ab26-72e9ed5b4cf8',
  'Main Laptop Camera',
  'camera',
  false,
  NULL
);