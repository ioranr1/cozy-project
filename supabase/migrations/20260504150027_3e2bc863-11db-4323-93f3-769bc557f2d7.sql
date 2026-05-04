
DROP POLICY IF EXISTS "anon_select_monitoring_events" ON public.monitoring_events;
DROP POLICY IF EXISTS "anon_insert_monitoring_events" ON public.monitoring_events;
DROP POLICY IF EXISTS "anon_update_monitoring_events" ON public.monitoring_events;
DROP POLICY IF EXISTS "anon_delete_monitoring_events" ON public.monitoring_events;

DROP POLICY IF EXISTS "anon_select_archived_events" ON public.archived_events;
DROP POLICY IF EXISTS "anon_insert_archived_events" ON public.archived_events;
DROP POLICY IF EXISTS "anon_delete_archived_events" ON public.archived_events;

DROP POLICY IF EXISTS "anon_select_device_status" ON public.device_status;
DROP POLICY IF EXISTS "anon_insert_device_status" ON public.device_status;
DROP POLICY IF EXISTS "anon_update_device_status" ON public.device_status;

DROP POLICY IF EXISTS "anon_select_monitoring_config" ON public.monitoring_config;
DROP POLICY IF EXISTS "anon_insert_monitoring_config" ON public.monitoring_config;
DROP POLICY IF EXISTS "anon_update_monitoring_config" ON public.monitoring_config;

DROP POLICY IF EXISTS "anon_select_commands_temp2" ON public.commands;
DROP POLICY IF EXISTS "anon_update_commands_temp2" ON public.commands;

DROP POLICY IF EXISTS "anon_delete_device_diagnostics" ON public.device_diagnostics;

DROP POLICY IF EXISTS "anon_insert_pwa_versions" ON public.pwa_versions;
DROP POLICY IF EXISTS "anon_update_pwa_versions" ON public.pwa_versions;
DROP POLICY IF EXISTS "anon_delete_pwa_versions" ON public.pwa_versions;
