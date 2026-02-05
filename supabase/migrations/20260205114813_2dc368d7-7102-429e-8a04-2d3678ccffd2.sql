-- Create scheduled job to invoke send-reminder every minute
SELECT cron.schedule(
  'send-reminder-job',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zoripeohnedivxkvrpbi.supabase.co/functions/v1/send-reminder',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpvcmlwZW9obmVkaXZ4a3ZycGJpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODMyMDIsImV4cCI6MjA4NDA1OTIwMn0.I24w1VjEWUNf2jCBnPo4-ypu3aq5rATJldbLgSSt9mo"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);