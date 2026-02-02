-- Generate a device auth token for the camera
UPDATE public.devices
SET 
  device_auth_token = encode(gen_random_bytes(32), 'hex'),
  device_auth_token_created_at = now()
WHERE id = '9b4d46ac-5d00-4867-ba92-1ffdae2b5052'
AND device_auth_token IS NULL;