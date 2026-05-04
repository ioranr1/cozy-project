
-- device_status
DROP POLICY IF EXISTS "Device owners can view their device status" ON public.device_status;
DROP POLICY IF EXISTS "Device owners can insert their device status" ON public.device_status;
DROP POLICY IF EXISTS "Device owners can update their device status" ON public.device_status;
CREATE POLICY "Anyone can view device status" ON public.device_status FOR SELECT USING (true);
CREATE POLICY "Anyone can insert device status" ON public.device_status FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update device status" ON public.device_status FOR UPDATE USING (true) WITH CHECK (true);

-- commands
DROP POLICY IF EXISTS "Users can view commands for their devices" ON public.commands;
DROP POLICY IF EXISTS "Users can create commands for their devices" ON public.commands;
DROP POLICY IF EXISTS "Users can update commands for their devices" ON public.commands;
CREATE POLICY "Anyone can view commands" ON public.commands FOR SELECT USING (true);
CREATE POLICY "Anyone can create commands" ON public.commands FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update commands" ON public.commands FOR UPDATE USING (true) WITH CHECK (true);

-- monitoring_config
DROP POLICY IF EXISTS "Device owners can view their monitoring config" ON public.monitoring_config;
DROP POLICY IF EXISTS "Device owners can insert their monitoring config" ON public.monitoring_config;
DROP POLICY IF EXISTS "Device owners can update their monitoring config" ON public.monitoring_config;
CREATE POLICY "Anyone can view monitoring config" ON public.monitoring_config FOR SELECT USING (true);
CREATE POLICY "Anyone can insert monitoring config" ON public.monitoring_config FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update monitoring config" ON public.monitoring_config FOR UPDATE USING (true) WITH CHECK (true);

-- monitoring_events
DROP POLICY IF EXISTS "Device owners can view their monitoring events" ON public.monitoring_events;
CREATE POLICY "Anyone can view monitoring events" ON public.monitoring_events FOR SELECT USING (true);
CREATE POLICY "Anyone can insert monitoring events" ON public.monitoring_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update monitoring events" ON public.monitoring_events FOR UPDATE USING (true) WITH CHECK (true);

-- live_sessions
DROP POLICY IF EXISTS "Device owners can view their device sessions" ON public.live_sessions;
DROP POLICY IF EXISTS "Device owners can create sessions for their devices" ON public.live_sessions;
DROP POLICY IF EXISTS "Device owners can update their device sessions" ON public.live_sessions;
CREATE POLICY "Anyone can view live sessions" ON public.live_sessions FOR SELECT USING (true);
CREATE POLICY "Anyone can create live sessions" ON public.live_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update live sessions" ON public.live_sessions FOR UPDATE USING (true) WITH CHECK (true);

-- access_tokens
DROP POLICY IF EXISTS "Device owners can view their access tokens" ON public.access_tokens;
DROP POLICY IF EXISTS "Device owners can create access tokens" ON public.access_tokens;
DROP POLICY IF EXISTS "Device owners can update their access tokens" ON public.access_tokens;
DROP POLICY IF EXISTS "Device owners can delete their access tokens" ON public.access_tokens;
CREATE POLICY "Anyone can view access tokens" ON public.access_tokens FOR SELECT USING (true);
CREATE POLICY "Anyone can create access tokens" ON public.access_tokens FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update access tokens" ON public.access_tokens FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete access tokens" ON public.access_tokens FOR DELETE USING (true);

-- archived_events
DROP POLICY IF EXISTS "Device owners can view archived events" ON public.archived_events;
CREATE POLICY "Anyone can view archived events" ON public.archived_events FOR SELECT USING (true);
CREATE POLICY "Anyone can insert archived events" ON public.archived_events FOR INSERT WITH CHECK (true);

-- camera_desync_reports
DROP POLICY IF EXISTS "Owners can view camera desync reports" ON public.camera_desync_reports;
DROP POLICY IF EXISTS "Owners can create camera desync reports" ON public.camera_desync_reports;
DROP POLICY IF EXISTS "Owners can resolve camera desync reports" ON public.camera_desync_reports;
CREATE POLICY "Anyone can view camera desync reports" ON public.camera_desync_reports FOR SELECT USING (true);
CREATE POLICY "Anyone can create camera desync reports" ON public.camera_desync_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update camera desync reports" ON public.camera_desync_reports FOR UPDATE USING (true) WITH CHECK (true);

-- pairing_codes
DROP POLICY IF EXISTS "Users can view their own pairing codes" ON public.pairing_codes;
DROP POLICY IF EXISTS "Users can create their own pairing codes" ON public.pairing_codes;
CREATE POLICY "Anyone can view pairing codes" ON public.pairing_codes FOR SELECT USING (true);
CREATE POLICY "Anyone can create pairing codes" ON public.pairing_codes FOR INSERT WITH CHECK (true);

-- profiles
DROP POLICY IF EXISTS "Profiles are viewable by profile owner via email" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Anyone can view profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Anyone can insert profiles" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update profiles" ON public.profiles FOR UPDATE USING (true) WITH CHECK (true);
