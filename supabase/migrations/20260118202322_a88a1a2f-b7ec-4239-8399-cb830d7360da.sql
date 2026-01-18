-- Add status tracking columns to commands table for acknowledgment flow
ALTER TABLE public.commands 
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS error_message text,
ADD COLUMN IF NOT EXISTS requester_profile_id uuid;

-- Add index for faster command polling by device and status
CREATE INDEX IF NOT EXISTS idx_commands_device_status ON public.commands(device_id, status) WHERE status = 'pending';

-- Update existing commands to have 'completed' status if handled
UPDATE public.commands SET status = 'completed' WHERE handled = true AND status = 'pending';