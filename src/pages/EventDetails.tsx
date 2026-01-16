import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Shield, ArrowLeft, Video, AlertTriangle, Clock, Calendar, Laptop } from 'lucide-react';
import { toast } from 'sonner';

interface Device {
  id: string;
  device_name: string;
  device_type: string;
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
}

// For now, events are fetched via raw query since table may not be in types yet
interface EventData {
  id: string;
  device_id: string;
  image_url: string | null;
  ai_summary: string | null;
  severity: 'low' | 'medium' | 'high' | null;
  created_at: string;
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
        // Try to fetch event using RPC or direct query
        // Since events table might not be in types, we use a raw approach
        const { data, error } = await supabase
          .rpc('validate_access_token', { p_token: 'dummy' }) // This won't work, placeholder
          .limit(0);
        
        // For now, show a placeholder - events table needs types regeneration
        // In production, this would fetch the actual event
        console.log('Event ID:', eventId);
        
        // Mock event for UI testing until types are updated
        setEvent({
          id: eventId,
          device_id: '',
          image_url: null,
          ai_summary: language === 'he' 
            ? 'זוהתה תנועה באזור המבוא. המערכת זיהתה אדם שנכנס לשטח המנוטר.'
            : 'Motion detected in the entrance area. The system detected a person entering the monitored area.',
          severity: 'medium',
          created_at: new Date().toISOString(),
        });
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching event:', error);
        toast.error(language === 'he' ? 'שגיאה בטעינת האירוע' : 'Error loading event');
        setLoading(false);
      }
    };

    fetchEventData();
  }, [eventId, navigate, language]);

  const handleViewLive = async () => {
    if (!device) {
      toast.error(language === 'he' ? 'נא לבחור מכשיר' : 'Please select a device');
      return;
    }

    setStartingLive(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error(language === 'he' ? 'נא להתחבר מחדש' : 'Please log in again');
        navigate('/login');
        return;
      }

      const response = await fetch(
        'https://zoripeohnedivxkvrpbi.supabase.co/functions/v1/live-start',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            device_id: device.id,
            event_id: event?.id,
            ttl_seconds: 60,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          toast.error(language === 'he' ? 'יש כבר שידור פעיל למכשיר זה' : 'There is already an active session for this device');
        } else {
          toast.error(data.error || (language === 'he' ? 'שגיאה בהפעלת השידור' : 'Error starting live view'));
        }
        return;
      }

      navigate(`/live/${data.session_id}`, {
        state: {
          sessionId: data.session_id,
          channel: data.channel,
          expiresAt: data.expires_at,
          ttlSeconds: data.ttl_seconds,
          iceServers: data.ice_servers,
          deviceName: device.device_name,
        },
      });
    } catch (error) {
      console.error('Error starting live:', error);
      toast.error(language === 'he' ? 'שגיאת רשת' : 'Network error');
    } finally {
      setStartingLive(false);
    }
  };

  const getSeverityColor = (severity: string | null) => {
    switch (severity) {
      case 'high':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'low':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      default:
        return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const getSeverityLabel = (severity: string | null) => {
    const labels: Record<string, { en: string; he: string }> = {
      high: { en: 'High', he: 'גבוהה' },
      medium: { en: 'Medium', he: 'בינונית' },
      low: { en: 'Low', he: 'נמוכה' },
    };
    return severity ? labels[severity]?.[language] || severity : (language === 'he' ? 'לא ידוע' : 'Unknown');
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
                onClick={() => navigate(-1)}
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
            {event.image_url ? (
              <img
                src={event.image_url}
                alt="Event snapshot"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <AlertTriangle className="w-16 h-16 text-slate-600" />
              </div>
            )}
            
            {/* Severity Badge Overlay */}
            <div className={`absolute top-4 ${isRTL ? 'left-4' : 'right-4'}`}>
              <Badge className={`${getSeverityColor(event.severity)} border`}>
                {getSeverityLabel(event.severity)}
              </Badge>
            </div>
          </div>

          {/* Event Info */}
          <div className="p-6">
            {/* Device & Time Info */}
            <div className="flex flex-wrap gap-4 mb-6 text-sm text-white/60">
              {device && (
                <div className="flex items-center gap-2">
                  <Laptop className="w-4 h-4" />
                  <span>{device.device_name}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>{new Date(event.created_at).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>{new Date(event.created_at).toLocaleTimeString(language === 'he' ? 'he-IL' : 'en-US')}</span>
              </div>
            </div>

            {/* AI Summary */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-white mb-2">
                {language === 'he' ? 'סיכום AI' : 'AI Summary'}
              </h2>
              <p className="text-white/80 leading-relaxed">
                {event.ai_summary || (language === 'he' ? 'אין סיכום זמין' : 'No summary available')}
              </p>
            </div>

            {/* Note about events table */}
            <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-blue-400 text-sm">
                {language === 'he' 
                  ? 'הערה: דף זה יציג אירועים אמיתיים לאחר שהטבלאות יעודכנו'
                  : 'Note: This page will show real events after database types are regenerated'}
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => navigate('/viewer')}
                className="flex-1 bg-primary hover:bg-primary/90 text-white"
              >
                <Video className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
                {language === 'he' ? 'בחר מכשיר לשידור חי' : 'Select Device for Live View'}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default EventDetails;
