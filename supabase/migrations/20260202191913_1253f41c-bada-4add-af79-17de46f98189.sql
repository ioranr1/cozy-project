-- Create a per-device notification state table to enforce WhatsApp cooldown atomically
CREATE TABLE IF NOT EXISTS public.device_notification_state (
  device_id uuid PRIMARY KEY REFERENCES public.devices(id) ON DELETE CASCADE,
  last_whatsapp_sent_at timestamp with time zone,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS (no policies => no access for anon/auth; service role still works)
ALTER TABLE public.device_notification_state ENABLE ROW LEVEL SECURITY;

-- Function: atomically decide whether WhatsApp can be sent for a device
CREATE OR REPLACE FUNCTION public.acquire_whatsapp_send_slot(
  p_device_id uuid,
  p_cooldown_ms integer DEFAULT 60000
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff timestamp with time zone;
  v_updated timestamp with time zone;
BEGIN
  IF p_device_id IS NULL THEN
    RETURN false;
  END IF;

  v_cutoff := now() - (p_cooldown_ms::text || ' milliseconds')::interval;

  -- Ensure a row exists
  INSERT INTO public.device_notification_state (device_id, last_whatsapp_sent_at)
  VALUES (p_device_id, NULL)
  ON CONFLICT (device_id) DO NOTHING;

  -- Atomically claim the slot if outside cooldown
  UPDATE public.device_notification_state
  SET last_whatsapp_sent_at = now(),
      updated_at = now()
  WHERE device_id = p_device_id
    AND (last_whatsapp_sent_at IS NULL OR last_whatsapp_sent_at < v_cutoff)
  RETURNING last_whatsapp_sent_at INTO v_updated;

  RETURN FOUND;
END;
$$;