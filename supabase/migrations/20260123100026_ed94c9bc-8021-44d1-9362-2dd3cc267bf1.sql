-- Enable realtime for commands table so desktop/mobile can receive INSERT/UPDATE events
-- (No schema changes to the table itself; only adds it to the publication)
ALTER PUBLICATION supabase_realtime ADD TABLE public.commands;