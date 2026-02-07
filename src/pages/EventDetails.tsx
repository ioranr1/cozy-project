import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Shield, ArrowLeft, Video, AlertTriangle, Clock, Calendar, Laptop, CheckCircle, XCircle, Film, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

interface LabelItem {
  label: string;
  confidence: number;
}

interface EventData {
  id: string;
  device_id: string;
  event_type: string;
  labels: Json;
  snapshot_url: string | null;
  ai_validated: boolean | null;
  ai_is_real: boolean | null;
  ai_summary: string | null;
  ai_confidence: number | null;
  severity: string;
  has_local_clip: boolean;
  local_clip_duration_seconds: number | null;
  notification_sent: boolean;
  created_at: string;
  metadata: Json;
}

interface Device {
  id: string;
  device_name: string;
  device_type: string;
  is_active: boolean;
  last_seen_at: string | null;
}

const EventDetails: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventData | null>(null);
  const [device, setDevice] = useState<Device | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingLive, setStartingLive] = useState(false);

  useEffect(() => {
    const fetchEventData = async () => {
      if (!eventId) return;

      try {
        // Fetch event from monitoring_events table
        const { data: eventData, error: eventError } = await supabase
          .from('monitoring_events')
          .select('*')
          .eq('id', eventId)
          .maybeSingle();

        if (eventError) {
          console.error('Error fetching event:', eventError);
          toast.error(language === 'he' ? 'שגיאה בטעינת האירוע' : 'Error loading event');
          setLoading(false);
          return;
        }

        if (!eventData) {
          console.log('Event not found:', eventId);
          setLoading(false);
          return;
        }

        setEvent(eventData);

        // Mark event as viewed (for notification reminder logic)
        markEventAsViewed(eventId);

        // Fetch device info
        const { data: deviceData } = await supabase
          .from('devices')
          .select('id, device_name, device_type, is_active, last_seen_at')
          .eq('id', eventData.device_id)
          .maybeSingle();

        if (deviceData) {
          setDevice(deviceData);
        }

        setLoading(false);
      } catch (error) {
        console.error('Error fetching event:', error);
        toast.error(language === 'he' ? 'שגיאה בטעינת האירוע' : 'Error loading event');
        setLoading(false);
      }
    };

    fetchEventData();
  }, [eventId, language]);

  // Mark event as viewed to prevent reminder notification
  const markEventAsViewed = async (eventId: string) => {
    try {
      // Use Supabase Functions client so apikey/auth headers are always correct.
      const { error } = await supabase.functions.invoke('mark-event-viewed', {
        body: { event_id: eventId },
      });

      if (error) {
        console.error('[EventDetails] Failed to mark event as viewed:', error);
        return;
      }

      console.log('[EventDetails] Event marked as viewed');
    } catch (error) {
      // Silent fail - not critical for user experience
      console.error('[EventDetails] Failed to mark event as viewed:', error);
    }
  };

  const handleViewLive = async () => {
    if (!device) {
      toast.error(language === 'he' ? 'מכשיר לא נמצא' : 'Device not found');
      return;
    }

    // Check if device is online
    const lastSeen = device.last_seen_at ? new Date(device.last_seen_at).getTime() : 0;
    const isOnline = Date.now() - lastSeen < 120000; // 2 minutes

    if (!isOnline) {
      toast.error(language === 'he' ? 'המכשיר לא מחובר כרגע' : 'Device is currently offline');
      return;
    }

    // Navigate to viewer with device pre-selected
    navigate('/viewer', { state: { deviceId: device.id } });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-600/20 text-red-400 border-red-500/30';
      case 'high':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'low':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const getSeverityLabel = (severity: string) => {
    const labels: Record<string, { en: string; he: string }> = {
      critical: { en: 'Critical', he: 'קריטי' },
      high: { en: 'High', he: 'גבוהה' },
      medium: { en: 'Medium', he: 'בינונית' },
      low: { en: 'Low', he: 'נמוכה' },
    };
    return labels[severity]?.[language] || severity;
  };

  const getEventTypeLabel = (type: string) => {
    const labels: Record<string, { en: string; he: string }> = {
      motion: { en: 'Motion', he: 'תנועה' },
      sound: { en: 'Sound', he: 'קול' },
    };
    return labels[type]?.[language] || type;
  };

  const parseLabels = (labels: Json): LabelItem[] => {
    if (Array.isArray(labels)) {
      return labels as unknown as LabelItem[];
    }
    return [];
  };

  const formatLabels = (labels: Json) => {
    const parsed = parseLabels(labels);
    return parsed.map(l => `${l.label} (${(l.confidence * 100).toFixed(0)}%)`).join(', ');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/60 mb-4">
            {language === 'he' ? 'אירוע לא נמצא' : 'Event not found'}
          </p>
          <Button onClick={() => navigate('/dashboard')}>
            {language === 'he' ? 'חזור לדשבורד' : 'Back to Dashboard'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/events')}
                className="text-white/60 hover:text-white hover:bg-white/10"
              >
                <ArrowLeft className={`w-4 h-4 ${isRTL ? 'rotate-180' : ''}`} />
              </Button>
              <Link to="/" className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <span className="text-xl font-bold text-white">AIGuard</span>
              </Link>
            </div>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Event Card */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 overflow-hidden">
          {/* Snapshot */}
          <div className="aspect-video bg-slate-900 relative">
            {event.snapshot_url ? (
              <img
                src={event.snapshot_url}
                alt="Event snapshot"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                <AlertTriangle className="w-16 h-16 text-slate-600" />
                <span className="text-slate-500 text-sm">
                  {event.event_type === 'sound' 
                    ? (language === 'he' ? 'אירוע קול - אין תמונה' : 'Sound event - no image')
                    : (language === 'he' ? 'אין תמונה זמינה' : 'No image available')}
                </span>
              </div>
            )}
            
            {/* Badges Overlay */}
            <div className={`absolute top-4 ${isRTL ? 'left-4' : 'right-4'} flex flex-col gap-2`}>
              <Badge className={`${getSeverityColor(event.severity)} border`}>
                {getSeverityLabel(event.severity)}
              </Badge>
              <Badge variant="outline" className="bg-slate-900/80 text-white border-slate-600">
                {getEventTypeLabel(event.event_type)}
              </Badge>
            </div>

            {/* AI Validation Badge */}
            {event.ai_validated && (
              <div className={`absolute bottom-4 ${isRTL ? 'left-4' : 'right-4'}`}>
                {event.ai_is_real ? (
                  <Badge className="bg-red-500/90 text-white border-0 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    {language === 'he' ? 'אירוע אמיתי' : 'Real Event'}
                  </Badge>
                ) : (
                  <Badge className="bg-slate-500/90 text-white border-0 flex items-center gap-1">
                    <XCircle className="w-3 h-3" />
                    {language === 'he' ? 'שווא' : 'False Positive'}
                  </Badge>
                )}
              </div>
            )}

            {/* Local Clip Indicator */}
            {event.has_local_clip && (
              <div className={`absolute bottom-4 ${isRTL ? 'right-4' : 'left-4'}`}>
                <Badge className="bg-blue-500/90 text-white border-0 flex items-center gap-1">
                  <Film className="w-3 h-3" />
                  {event.local_clip_duration_seconds 
                    ? `${event.local_clip_duration_seconds}s`
                    : (language === 'he' ? 'קליפ מקומי' : 'Local Clip')}
                </Badge>
              </div>
            )}
          </div>

          {/* Event Info */}
          <div className="p-6">
            {/* Event Metadata Section */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6 p-4 bg-slate-700/20 rounded-lg border border-slate-600/30">
              {/* Event Type */}
              <div>
                <span className="text-xs text-white/40 block mb-1">
                  {language === 'he' ? 'סוג אירוע' : 'Event Type'}
                </span>
                <span className="text-white font-medium">
                  {getEventTypeLabel(event.event_type)}
                </span>
              </div>
              
              {/* Detection Result */}
              <div>
                <span className="text-xs text-white/40 block mb-1">
                  {language === 'he' ? 'זוהה' : 'Detected'}
                </span>
                <span className="text-white font-medium">
                  {parseLabels(event.labels)[0]?.label || (language === 'he' ? 'לא ידוע' : 'Unknown')}
                </span>
              </div>
              
              {/* Confidence Score */}
              <div>
                <span className="text-xs text-white/40 block mb-1">
                  {language === 'he' ? 'ביטחון' : 'Confidence'}
                </span>
                <span className="text-white font-medium">
                  {parseLabels(event.labels)[0]?.confidence 
                    ? `${(parseLabels(event.labels)[0].confidence * 100).toFixed(0)}%`
                    : '-'}
                </span>
              </div>
              
              {/* Alert Level */}
              <div>
                <span className="text-xs text-white/40 block mb-1">
                  {language === 'he' ? 'רמת התראה' : 'Alert Level'}
                </span>
                <Badge className={`${getSeverityColor(event.severity)} border text-xs`}>
                  {getSeverityLabel(event.severity)}
                </Badge>
              </div>
              
              {/* Timestamp */}
              <div>
                <span className="text-xs text-white/40 block mb-1">
                  {language === 'he' ? 'זמן' : 'Time'}
                </span>
                <span className="text-white font-medium text-sm">
                  {new Date(event.created_at).toLocaleTimeString(language === 'he' ? 'he-IL' : 'en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </div>
              
              {/* Date */}
              <div>
                <span className="text-xs text-white/40 block mb-1">
                  {language === 'he' ? 'תאריך' : 'Date'}
                </span>
                <span className="text-white font-medium text-sm">
                  {new Date(event.created_at).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US')}
                </span>
              </div>
            </div>

            {/* Device / Camera Info */}
            {device && (
              <div className="flex items-center gap-3 mb-6 p-3 bg-slate-700/20 rounded-lg border border-slate-600/30">
                <Laptop className="w-5 h-5 text-white/60" />
                <div>
                  <span className="text-white font-medium">{device.device_name}</span>
                  <span className="text-white/40 text-xs block">{device.device_type}</span>
                </div>
                {device.is_active && (
                  <span className="ml-auto flex items-center gap-1 text-green-400 text-xs">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    {language === 'he' ? 'מחובר' : 'Online'}
                  </span>
                )}
              </div>
            )}

            {/* AI Summary Section - Full details */}
            {event.ai_summary && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-primary" />
                  {language === 'he' ? 'סיכום AI' : 'AI Summary'}
                </h2>
                <div className="p-4 bg-slate-700/30 rounded-lg border border-slate-600/30">
                  <p className="text-white/90 leading-relaxed text-base">
                    {event.ai_summary}
                  </p>
                  {event.ai_confidence && (
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-600/30">
                      <span className="text-xs text-white/40">
                        {language === 'he' ? 'רמת ביטחון AI:' : 'AI Confidence:'}
                      </span>
                      <div className="flex-1 h-2 bg-slate-600/50 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${event.ai_confidence * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-white font-medium">
                        {(event.ai_confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* All Detected Labels */}
            {parseLabels(event.labels).length > 1 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-white/60 mb-2">
                  {language === 'he' ? 'כל הזיהויים' : 'All Detections'}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {parseLabels(event.labels).map((label, idx) => (
                    <Badge 
                      key={idx} 
                      variant="outline" 
                      className="bg-slate-700/50 text-white/80 border-slate-600"
                    >
                      {label.label} ({(label.confidence * 100).toFixed(0)}%)
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Notification Status */}
            {event.notification_sent && (
              <div className="mb-6 p-3 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span className="text-green-400 text-sm">
                  {language === 'he' ? 'התראה נשלחה' : 'Notification sent'}
                </span>
              </div>
            )}

            {/* Local Clip Note */}
            {event.has_local_clip && (
              <div className="mb-6 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-blue-400 text-sm">
                    <Film className="w-4 h-4" />
                    <span>
                      {language === 'he' 
                        ? `קליפ וידאו (${event.local_clip_duration_seconds || '?'}s) שמור מקומית במחשב.`
                        : `Video clip (${event.local_clip_duration_seconds || '?'}s) saved locally on the computer.`}
                    </span>
                  </div>
                  {(window as any).electronAPI?.openClipsFolder ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => (window as any).electronAPI.openClipsFolder()}
                      className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 gap-1"
                    >
                      <FolderOpen className="w-4 h-4" />
                      {language === 'he' ? 'פתח תיקייה' : 'Open Folder'}
                    </Button>
                  ) : (
                    <span className="text-blue-400/60 text-xs">
                      {language === 'he' ? 'נתיב: שולחן העבודה / SecurityClips' : 'Path: Desktop/SecurityClips/'}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={handleViewLive}
                disabled={startingLive || !device}
                className="flex-1 bg-primary hover:bg-primary/90 text-white"
              >
                {startingLive ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white" />
                ) : (
                  <>
                    <Video className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                    {language === 'he' ? 'צפייה חיה' : 'Live View'}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/events')}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white border-gray-700"
              >
                {language === 'he' ? 'כל האירועים' : 'All Events'}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default EventDetails;
