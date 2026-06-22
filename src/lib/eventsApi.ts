import { supabase } from '@/integrations/supabase/client';

const SESSION_TOKEN_KEY = 'aiguard_session_token';

export interface EventApiItem {
  id: string;
  device_id: string;
  event_type: string;
  labels: unknown;
  snapshot_url: string | null;
  ai_validated: boolean | null;
  ai_is_real: boolean | null;
  ai_summary: string | null;
  ai_confidence: number | null;
  severity: string;
  has_local_clip: boolean;
  local_clip_duration_seconds: number | null;
  local_clip_filename?: string | null;
  notification_sent?: boolean;
  notification_sent_at?: string | null;
  notification_type?: string | null;
  reminder_sent?: boolean;
  reminder_sent_at?: string | null;
  viewed_at?: string | null;
  metadata?: unknown;
  created_at: string;
  ai_validated_at?: string | null;
}

function getSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Fetch events for the current authenticated user via Edge Function.
 * Server enforces ownership — only events for devices the user owns are returned.
 */
export async function fetchUserEvents(params?: {
  device_id?: string;
  limit?: number;
}): Promise<EventApiItem[]> {
  const session_token = getSessionToken();
  if (!session_token) {
    throw new Error('No session token');
  }

  const { data, error } = await supabase.functions.invoke('get-user-events', {
    body: {
      session_token,
      ...(params?.device_id ? { device_id: params.device_id } : {}),
      ...(params?.limit ? { limit: params.limit } : {}),
    },
  });

  if (error) {
    console.error('[eventsApi] fetchUserEvents error:', error);
    throw error;
  }

  return (data?.events ?? []) as EventApiItem[];
}

/**
 * Fetch a single event by ID via Edge Function.
 * Returns the event + a fresh signed snapshot URL (15 min TTL).
 * Throws on 403 if the event does not belong to the current user.
 */
// v1.1.0 (2026-06-22) — supports optional viewToken for WhatsApp deep-links.
export async function fetchEventDetails(
  eventId: string,
  viewToken?: string | null,
): Promise<{
  event: EventApiItem;
  signed_snapshot_url: string | null;
}> {
  const session_token = getSessionToken();
  if (!session_token && !viewToken) {
    throw new Error('No session token');
  }

  const body: Record<string, string> = { event_id: eventId };
  if (session_token) body.session_token = session_token;
  if (viewToken) body.view_token = viewToken;

  const { data, error } = await supabase.functions.invoke('get-event-details', {
    body,
  });

  if (error) {
    console.error('[eventsApi] fetchEventDetails error:', error);
    throw error;
  }

  return {
    event: data?.event as EventApiItem,
    signed_snapshot_url: (data?.signed_snapshot_url ?? null) as string | null,
  };
}