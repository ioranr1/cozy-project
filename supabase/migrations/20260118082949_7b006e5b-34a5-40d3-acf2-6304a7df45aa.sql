-- Create commands table for remote camera control
CREATE TABLE public.commands (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
    command TEXT NOT NULL,
    handled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    handled_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.commands ENABLE ROW LEVEL SECURITY;

-- RLS policies: Users can manage commands for their own devices
CREATE POLICY "Users can create commands for their devices"
ON public.commands
FOR INSERT
WITH CHECK (
    device_id IN (
        SELECT d.id FROM public.devices d
        WHERE d.profile_id IN (
            SELECT p.id FROM public.profiles p
            WHERE p.user_id = auth.uid()
        )
    )
);

CREATE POLICY "Users can view commands for their devices"
ON public.commands
FOR SELECT
USING (
    device_id IN (
        SELECT d.id FROM public.devices d
        WHERE d.profile_id IN (
            SELECT p.id FROM public.profiles p
            WHERE p.user_id = auth.uid()
        )
    )
);

CREATE POLICY "Users can update commands for their devices"
ON public.commands
FOR UPDATE
USING (
    device_id IN (
        SELECT d.id FROM public.devices d
        WHERE d.profile_id IN (
            SELECT p.id FROM public.profiles p
            WHERE p.user_id = auth.uid()
        )
    )
);

-- Index for efficient polling of unhandled commands
CREATE INDEX idx_commands_unhandled ON public.commands (device_id, handled) WHERE handled = false;