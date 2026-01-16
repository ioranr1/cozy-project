-- Fix: Create unique index without now() - enforce one active session per device
-- The expiration check will be done in application logic
CREATE UNIQUE INDEX idx_live_sessions_one_active_per_device 
ON public.live_sessions(device_id) 
WHERE status IN ('requested', 'active');