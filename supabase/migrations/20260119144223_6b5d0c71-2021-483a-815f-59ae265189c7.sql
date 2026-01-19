-- Enable uuid extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create rtc_sessions table for WebRTC session management
CREATE TABLE public.rtc_sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id uuid NOT NULL,
  viewer_id text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'ended', 'failed')),
  created_at timestamptz DEFAULT now(),
  ended_at timestamptz NULL,
  fail_reason text NULL
);

-- Create rtc_signals table for WebRTC signaling messages
CREATE TABLE public.rtc_signals (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.rtc_sessions(id) ON DELETE CASCADE,
  from_role text NOT NULL CHECK (from_role IN ('desktop', 'mobile')),
  type text NOT NULL CHECK (type IN ('offer', 'answer', 'ice')),
  payload jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for efficient queries
CREATE INDEX idx_rtc_sessions_device_status ON public.rtc_sessions(device_id, status, created_at DESC);
CREATE INDEX idx_rtc_signals_session ON public.rtc_signals(session_id, created_at ASC);

-- Enable RLS
ALTER TABLE public.rtc_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rtc_signals ENABLE ROW LEVEL SECURITY;

-- MVP: Permissive policies for rtc_sessions (will harden later)
CREATE POLICY "Allow all select on rtc_sessions" ON public.rtc_sessions
  FOR SELECT USING (true);

CREATE POLICY "Allow all insert on rtc_sessions" ON public.rtc_sessions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow all update on rtc_sessions" ON public.rtc_sessions
  FOR UPDATE USING (true);

-- MVP: Permissive policies for rtc_signals (will harden later)
CREATE POLICY "Allow all select on rtc_signals" ON public.rtc_signals
  FOR SELECT USING (true);

CREATE POLICY "Allow all insert on rtc_signals" ON public.rtc_signals
  FOR INSERT WITH CHECK (true);