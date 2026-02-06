import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { 
  Bell, 
  ArrowLeft, 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  XCircle,
  Film,
  Eye,
  Volume2,
  Filter
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { cn } from '@/lib/utils';
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
  severity: string;
  has_local_clip: boolean;
  created_at: string;
}

const Events: React.FC = () => {
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'real' | 'false'>('all');

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('monitoring_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error fetching events:', error);
      } else {
        setEvents((data || []) as unknown as EventData[]);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = events.filter(event => {
    if (filter === 'all') return true;
    if (filter === 'real') return event.ai_is_real === true;
    if (filter === 'false') return event.ai_is_real === false;
    return true;
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-600 text-white';
      case 'high':
        return 'bg-orange-500 text-white';
      case 'medium':
        return 'bg-yellow-500 text-black';
      case 'low':
        return 'bg-green-500 text-white';
      default:
        return 'bg-slate-500 text-white';
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return language === 'he' ? 'עכשיו' : 'Just now';
    if (diffMins < 60) return language === 'he' ? `לפני ${diffMins} דק'` : `${diffMins}m ago`;
    if (diffHours < 24) return language === 'he' ? `לפני ${diffHours} שע'` : `${diffHours}h ago`;
    return language === 'he' ? `לפני ${diffDays} ימים` : `${diffDays}d ago`;
  };

  const parseLabels = (labels: Json): LabelItem[] => {
    if (Array.isArray(labels)) {
      return labels as unknown as LabelItem[];
    }
    return [];
  };

  const getMainLabel = (labels: Json) => {
    const parsed = parseLabels(labels);
    if (parsed.length === 0) return language === 'he' ? 'לא ידוע' : 'Unknown';
    return parsed[0].label;
  };

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 text-primary" />
            <h1 className="text-xl md:text-2xl font-bold text-white">
              {language === 'he' ? 'אירועים' : 'Events'}
            </h1>
          </div>
          
          {/* Filter Buttons */}
          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
              className={filter === 'all' ? '' : 'border-slate-600 text-white/60'}
            >
              {language === 'he' ? 'הכל' : 'All'}
            </Button>
            <Button
              variant={filter === 'real' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('real')}
              className={
                filter === 'real'
                  ? 'bg-slate-800 hover:bg-slate-700 text-white'
                  : 'bg-slate-900/50 hover:bg-slate-800 text-white/80 border-slate-700'
              }
            >
              {language === 'he' ? 'אמיתי' : 'Real'}
            </Button>
            <Button
              variant={filter === 'false' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('false')}
              className={filter === 'false' ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'border-slate-600 text-white/60'}
            >
              {language === 'he' ? 'שווא' : 'False'}
            </Button>
          </div>
        </div>

        {/* Events List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <p className="text-white/60">
              {language === 'he' ? 'אין אירועים להצגה' : 'No events to display'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredEvents.map((event) => (
              <div
                key={event.id}
                onClick={() => navigate(`/event/${event.id}`)}
                className={cn(
                  "bg-slate-800/50 rounded-xl border border-slate-700/50 p-4 cursor-pointer",
                  "hover:bg-slate-700/50 hover:border-slate-600/50 transition-all",
                  event.ai_is_real === false && "opacity-60"
                )}
              >
                <div className="flex items-start gap-4">
                  {/* Thumbnail or Icon */}
                  <div className="w-16 h-16 rounded-lg bg-slate-900 flex-shrink-0 overflow-hidden">
                    {event.snapshot_url ? (
                      <img
                        src={event.snapshot_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {event.event_type === 'motion' ? (
                          <Eye className="w-6 h-6 text-slate-600" />
                        ) : (
                          <Volume2 className="w-6 h-6 text-slate-600" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Event Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={cn("text-xs", getSeverityColor(event.severity))}>
                        {event.severity}
                      </Badge>
                      <Badge variant="outline" className="text-xs border-slate-600 text-white/60">
                        {event.event_type}
                      </Badge>
                      {event.ai_validated && (
                        event.ai_is_real ? (
                          <CheckCircle className="w-4 h-4 text-red-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-slate-400" />
                        )
                      )}
                      {event.has_local_clip && (
                        <Film className="w-4 h-4 text-blue-400" />
                      )}
                    </div>
                    
                    <p className="text-white font-medium truncate">
                      {getMainLabel(event.labels)}
                    </p>
                    
                    {event.ai_summary && (
                      <p className="text-white/60 text-sm truncate mt-1">
                        {event.ai_summary}
                      </p>
                    )}
                  </div>

                  {/* Time */}
                  <div className="text-right flex-shrink-0">
                    <div className="flex items-center gap-1 text-white/40 text-sm">
                      <Clock className="w-3 h-3" />
                      <span>{formatTimeAgo(event.created_at)}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Events;
