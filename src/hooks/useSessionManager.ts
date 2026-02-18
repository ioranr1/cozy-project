/**
 * useSessionManager — Centralized session preparation hook (v1.0.0)
 * 
 * Implements the KILL → SET → EXEC pattern for all session types.
 * This is the SINGLE SOURCE OF TRUTH for preparing device state before
 * starting any WebRTC or monitoring session.
 * 
 * THREE ISOLATED FUNCTIONS:
 * 1. prepareLiveView()        — Regular video+audio live view
 * 2. prepareBabyMonitor()     — Audio-only baby monitor
 * 3. prepareMotionDetection() — Background motion detection (no WebRTC)
 * 
 * Each function:
 *   KILL: Resets ALL sensor flags to false
 *   SET:  Enables only its own flag (if any)
 *   EXEC: Sends the appropriate command
 * 
 * Components that use this hook:
 * - Dashboard.tsx (prepareLiveView before navigating to Viewer)
 * - Viewer.tsx (prepareLiveView for manual start)
 * - BabyMonitorViewer.tsx (prepareBabyMonitor)
 * - SecurityArmToggle.tsx (prepareMotionDetection — future)
 */

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * KILL — Reset ALL sensor flags to a clean state.
 * This is identical for every mode and MUST run first.
 */
async function killAllFlags(deviceId: string, preserveMotion = false): Promise<boolean> {
  console.log('[SessionManager] KILL — Resetting flags for device:', deviceId, { preserveMotion });
  
  const update: Record<string, boolean> = {
    baby_monitor_enabled: false,
    sound_enabled: false,
  };

  // Only reset motion_enabled when explicitly requested (e.g., baby monitor mode).
  // Live View should NOT touch motion_enabled — the Electron agent handles
  // pausing motion detection during an active WebRTC stream and resuming after.
  if (!preserveMotion) {
    update.motion_enabled = false;
  }

  const { error } = await supabase
    .from('device_status')
    .update(update)
    .eq('device_id', deviceId);

  if (error) {
    console.error('[SessionManager] KILL failed:', error.message);
    return false;
  }

  console.log('[SessionManager] KILL ✅ — Flags reset (preserveMotion:', preserveMotion, ')');
  return true;
}

/**
 * SET — Enable the specific flag for the chosen mode.
 */
async function setModeFlag(
  deviceId: string, 
  mode: 'live_view' | 'baby_monitor' | 'motion_detection'
): Promise<boolean> {
  // Live View doesn't need any flag — it uses full video by default
  if (mode === 'live_view') {
    console.log('[SessionManager] SET — Live View: no flag needed (full mode by default)');
    return true;
  }

  const update = mode === 'baby_monitor'
    ? { baby_monitor_enabled: true }
    : { motion_enabled: true };

  console.log('[SessionManager] SET —', mode, ':', update);

  const { error } = await supabase
    .from('device_status')
    .update(update)
    .eq('device_id', deviceId);

  if (error) {
    console.error('[SessionManager] SET failed:', error.message);
    return false;
  }

  console.log('[SessionManager] SET ✅ —', mode, 'flag enabled');
  return true;
}

/**
 * Close any stale RTC sessions for the device (prevents ghost sessions)
 */
async function cleanupStaleSessions(deviceId: string): Promise<void> {
  try {
    await supabase
      .from('rtc_sessions')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString(),
        fail_reason: 'superseded_by_new_start',
      })
      .eq('device_id', deviceId)
      .in('status', ['pending', 'active'])
      .is('ended_at', null);
    
    console.log('[SessionManager] Stale sessions cleaned up');
  } catch (e) {
    console.warn('[SessionManager] Failed to cleanup stale sessions (continuing):', e);
  }
}

export type SessionMode = 'live_view' | 'baby_monitor' | 'motion_detection';

export function useSessionManager() {
  /**
   * prepareLiveView — KILL → SET → cleanup stale sessions
   * 
   * Called by Dashboard (before navigate) and Viewer (manual start).
   * Does NOT create the RTC session or send commands — that's the caller's job
   * since Dashboard and Viewer have different flows (Dashboard navigates first,
   * Viewer sends command first).
   */
  const prepareLiveView = useCallback(async (deviceId: string): Promise<boolean> => {
    console.log('[SessionManager] ═══ prepareLiveView START ═══');

    // KILL — preserve motion_enabled so motion detection stays armed during live view.
    // The Electron agent pauses motion detection while WebRTC is active and resumes after.
    const killed = await killAllFlags(deviceId, true);
    if (!killed) return false;

    // SET (no flag needed for live view)
    const set = await setModeFlag(deviceId, 'live_view');
    if (!set) return false;

    // Cleanup stale sessions
    await cleanupStaleSessions(deviceId);

    console.log('[SessionManager] ═══ prepareLiveView DONE ═══');
    return true;
  }, []);

  /**
   * prepareBabyMonitor — KILL → SET baby_monitor=true → cleanup stale sessions
   * 
   * Called by BabyMonitorViewer before connecting.
   */
  const prepareBabyMonitor = useCallback(async (deviceId: string): Promise<boolean> => {
    console.log('[SessionManager] ═══ prepareBabyMonitor START ═══');

    // KILL
    const killed = await killAllFlags(deviceId);
    if (!killed) return false;

    // SET
    const set = await setModeFlag(deviceId, 'baby_monitor');
    if (!set) return false;

    // Cleanup stale sessions
    await cleanupStaleSessions(deviceId);

    console.log('[SessionManager] ═══ prepareBabyMonitor DONE ═══');
    return true;
  }, []);

  /**
   * prepareMotionDetection — KILL → SET motion=true
   * 
   * No stale session cleanup needed (motion detection doesn't use WebRTC).
   * Note: Currently SecurityArmToggle handles this inline.
   * This is provided for future consolidation.
   */
  const prepareMotionDetection = useCallback(async (deviceId: string): Promise<boolean> => {
    console.log('[SessionManager] ═══ prepareMotionDetection START ═══');

    // KILL
    const killed = await killAllFlags(deviceId);
    if (!killed) return false;

    // SET
    const set = await setModeFlag(deviceId, 'motion_detection');
    if (!set) return false;

    console.log('[SessionManager] ═══ prepareMotionDetection DONE ═══');
    return true;
  }, []);

  return {
    prepareLiveView,
    prepareBabyMonitor,
    prepareMotionDetection,
  };
}
