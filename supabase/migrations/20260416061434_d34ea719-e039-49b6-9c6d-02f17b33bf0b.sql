UPDATE public.devices 
SET device_auth_token = encode(gen_random_bytes(32), 'hex'),
    device_auth_token_created_at = now()
WHERE device_auth_token IS NULL;