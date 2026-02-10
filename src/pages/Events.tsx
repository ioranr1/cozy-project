import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { 
  Bell, 
  Clock, 
  CheckCircle, 
  XCircle,
  Film,
  Eye,
  Volume2,
  Copy,
  Archive,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
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

interface ArchivedEventData {
  id: string;
  original_event_id: string;
  device_id: string;
  event_type: string;
  severity: string | null;
  ai_is_real: boolean | null;
  ai_summary: string | null;
  created_at: string;
  archived_at: string;
}

const PAGE_SIZE = 50;

const Events: React.FC = () => {
  const { language, isRTL } = useLanguage();
  const navigate = useNavigate();
  const [events, setEvents] = useState<EventData[]>([]);
  const [archivedEvents, setArchivedEvents] = useState<ArchivedEventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingArchive, setLoadingArchive] = useState(false);
  const [filter, setFilter] = useState<'all' | 'real' | 'false'>('all');
  const [tab, setTab] = useState<'active' | 'archive'>('active');
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('monitoring_events')
        .select('*')
        .order('created_at', { ascending: false })
        .range(0, PAGE_SIZE - 1);

      if (error) {
        console.error('Error fetching events:', error);
      } else {
        const fetched = (data || []) as unknown as EventData[];
        setEvents(fetched);
        setHasMore(fetched.length === PAGE_SIZE);
        setPage(1);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from('monitoring_events')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        console.error('Error loading more events:', error);
      } else {
        const fetched = (data || []) as unknown as EventData[];
        setEvents(prev => [...prev, ...fetched]);
        setHasMore(fetched.length === PAGE_SIZE);
        setPage(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoadingMore(false);
    }
  }, [page, loadingMore, hasMore]);

  const fetchArchivedEvents = useCallback(async () => {
    if (archivedEvents.length > 0) return; // already loaded
    setLoadingArchive(true);
    try {
      const { data, error } = await supabase
        .from('archived_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) {
        console.error('Error fetching archived events:', error);
      } else {
        setArchivedEvents((data || []) as unknown as ArchivedEventData[]);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoadingArchive(false);
    }
  }, [archivedEvents.length]);

  const handleTabChange = (newTab: 'active' | 'archive') => {
    setTab(newTab);
    if (newTab === 'archive') {
      fetchArchivedEvents();
    }
  };

  const filteredEvents = events.filter(event => {
    if (filter === 'all') return true;
    if (filter === 'real') return event.ai_is_real === true;
    if (filter === 'false') return event.ai_is_real === false;
    return true;
  });

  const filteredArchived = archivedEvents.filter(event => {
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
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6 text-primary" />
            <h1 className="text-xl md:text-2xl font-bold text-white">
              {language === 'he' ? 'אירועים' : 'Events'}
            </h1>
          </div>
          
          {/* Filter Buttons */}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => setFilter('all')}
              className={filter === 'all' 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-slate-950 hover:bg-slate-900 text-white'}
            >
              {language === 'he' ? 'הכל' : 'All'}
            </Button>
            <Button
              size="sm"
              onClick={() => setFilter('real')}
              className={filter === 'real' 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-slate-950 hover:bg-slate-900 text-white'}
            >
              {language === 'he' ? 'אמיתי' : 'Real'}
            </Button>
            <Button
              size="sm"
              onClick={() => setFilter('false')}
              className={filter === 'false' 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-slate-950 hover:bg-slate-900 text-white'}
            >
              {language === 'he' ? 'שווא' : 'False'}
            </Button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex gap-2 mb-6">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleTabChange('active')}
            className={cn(
              "flex items-center gap-1.5",
              tab === 'active'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-transparent text-white/60 border-slate-700 hover:text-white hover:border-slate-500'
            )}
          >
            <Bell className="w-3.5 h-3.5" />
            {language === 'he' ? 'פעילים (7 ימים)' : 'Active (7 days)'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleTabChange('archive')}
            className={cn(
              "flex items-center gap-1.5",
              tab === 'archive'
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-transparent text-white/60 border-slate-700 hover:text-white hover:border-slate-500'
            )}
          >
            <Archive className="w-3.5 h-3.5" />
            {language === 'he' ? 'ארכיון (8-14 ימים)' : 'Archive (8-14 days)'}
          </Button>
        </div>

        {/* Active Events Tab */}
        {tab === 'active' && (
          <>
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

                      {/* Time & Copy */}
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <div className="flex flex-col items-end gap-0.5">
                          <div className="flex items-center gap-1 text-white/40 text-sm">
                            <Clock className="w-3 h-3" />
                            <span>{formatTimeAgo(event.created_at)}</span>
                          </div>
                          <span className="text-white/30 text-[11px] font-mono leading-tight">
                            {new Date(event.created_at).toLocaleDateString(language === 'he' ? 'he-IL' : 'en-US', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                            {' '}
                            {new Date(event.created_at).toLocaleTimeString(language === 'he' ? 'he-IL' : 'en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            const url = `${window.location.origin}/event/${event.id}`;
                            navigator.clipboard.writeText(url);
                            toast.success(language === 'he' ? 'הקישור הועתק!' : 'Link copied!');
                          }}
                          className="text-white/40 hover:text-white hover:bg-white/10 p-1 h-auto"
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Load More */}
                {hasMore && (
                  <div className="flex justify-center pt-4">
                    <Button
                      variant="outline"
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="border-slate-700 text-white/60 hover:text-white hover:border-slate-500"
                    >
                      {loadingMore ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : null}
                      {language === 'he' ? 'טען עוד' : 'Load More'}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Archive Tab */}
        {tab === 'archive' && (
          <>
            {loadingArchive ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : filteredArchived.length === 0 ? (
              <div className="text-center py-12">
                <Archive className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-white/60">
                  {language === 'he' ? 'אין אירועים בארכיון' : 'No archived events'}
                </p>
                <p className="text-white/40 text-sm mt-2">
                  {language === 'he' 
                    ? 'אירועים מועברים לארכיון אחרי 7 ימים ונמחקים אחרי 14 ימים' 
                    : 'Events are archived after 7 days and deleted after 14 days'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredArchived.map((event) => (
                  <div
                    key={event.id}
                    className="bg-slate-800/30 rounded-xl border border-slate-700/30 p-4 opacity-80"
                  >
                    <div className="flex items-start gap-4">
                      {/* No media - show placeholder */}
                      <div className="w-16 h-16 rounded-lg bg-slate-900/50 flex-shrink-0 flex items-center justify-center">
                        <Archive className="w-5 h-5 text-slate-600" />
                      </div>

                      {/* Event Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {event.severity && (
                            <Badge className={cn("text-xs", getSeverityColor(event.severity))}>
                              {event.severity}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs border-slate-600 text-white/60">
                            {event.event_type}
                          </Badge>
                          {event.ai_is_real !== null && (
                            event.ai_is_real ? (
                              <CheckCircle className="w-4 h-4 text-red-400" />
                            ) : (
                              <XCircle className="w-4 h-4 text-slate-400" />
                            )
                          )}
                        </div>
                        
                        {event.ai_summary ? (
                          <p className="text-white/60 text-sm truncate">
                            {event.ai_summary}
                          </p>
                        ) : (
                          <p className="text-white/40 text-sm italic">
                            {language === 'he' ? 'מטא-דאטה בלבד' : 'Metadata only'}
                          </p>
                        )}

                        <p className="text-white/30 text-xs mt-1">
                          {language === 'he' ? 'מדיה פגה תוקף' : 'Media expired'}
                        </p>
                      </div>

                      {/* Time */}
                      <div className="flex flex-col items-end flex-shrink-0">
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
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default Events;
