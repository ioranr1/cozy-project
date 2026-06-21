CREATE TABLE public.event_view_tokens (
  token text PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.monitoring_events(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz NULL
);

CREATE INDEX idx_event_view_tokens_event ON public.event_view_tokens(event_id);
CREATE INDEX idx_event_view_tokens_expires ON public.event_view_tokens(expires_at);

GRANT ALL ON public.event_view_tokens TO service_role;
ALTER TABLE public.event_view_tokens ENABLE ROW LEVEL SECURITY;

-- No public policies. Only service_role (edge functions) accesses this table.
CREATE POLICY "service_role only"
  ON public.event_view_tokens
  FOR ALL
  USING (false)
  WITH CHECK (false);