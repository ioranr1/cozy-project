-- Enable scheduled reminders (2nd WhatsApp message) via pg_cron + pg_net
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;