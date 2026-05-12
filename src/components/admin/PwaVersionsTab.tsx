/**
 * PwaVersionsTab v1.1.0
 * טאב אדמין לניהול גרסאות PWA.
 * מאפשר להוסיף גרסה חדשה, לערוך, למחוק, ולבחור גרסה נוכחית.
 * v1.1.0 — הוספת סקציית "מכשירים מחוברים" עם זיהוי OS/דפדפן/דגם משוער.
 */
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Trash2, Star, Edit, RefreshCw, Loader2, Smartphone } from 'lucide-react';
import type { PwaVersion } from '@/hooks/usePwaVersion';

// ============= UA Parser (best-effort, no external deps) =============
type ParsedUA = {
  os: string;
  osVersion: string;
  browser: string;
  deviceGuess: string;
};

function parseUA(ua: string | null): ParsedUA {
  if (!ua) return { os: 'לא ידוע', osVersion: '—', browser: '—', deviceGuess: '—' };

  let os = 'אחר';
  let osVersion = '—';
  let browser = 'אחר';
  let deviceGuess = '—';

  // OS detection
  if (/iPad/i.test(ua)) { os = 'iPadOS'; deviceGuess = 'iPad'; }
  else if (/iPhone/i.test(ua)) { os = 'iOS'; deviceGuess = 'iPhone'; }
  else if (/Android/i.test(ua)) { os = 'Android'; }
  else if (/Windows NT/i.test(ua)) { os = 'Windows'; }
  else if (/Mac OS X/i.test(ua)) { os = 'macOS'; }
  else if (/Linux/i.test(ua)) { os = 'Linux'; }

  // OS version
  const iosV = ua.match(/OS (\d+[_\.]\d+(?:[_\.]\d+)?)/);
  if (iosV) osVersion = iosV[1].replace(/_/g, '.');
  const androidV = ua.match(/Android (\d+(?:\.\d+)?)/);
  if (androidV) osVersion = androidV[1];
  const winV = ua.match(/Windows NT (\d+\.\d+)/);
  if (winV) osVersion = winV[1];

  // Android device model — between "; " and " Build" or ")"
  if (os === 'Android') {
    const m = ua.match(/Android [\d\.]+;[^;]*;\s*([^;)]+?)(?:\s+Build|\))/);
    if (m) deviceGuess = m[1].trim();
  }

  // Browser
  if (/CriOS\//i.test(ua)) browser = 'Chrome (iOS)';
  else if (/FxiOS\//i.test(ua)) browser = 'Firefox (iOS)';
  else if (/EdgiOS\//i.test(ua)) browser = 'Edge (iOS)';
  else if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';

  return { os, osVersion, browser, deviceGuess };
}

type SessionRow = {
  id: string;
  created_at: string;
  last_used_at: string;
  expires_at: string;
  device_fingerprint: string | null;
  profile_id: string;
  profile?: { full_name: string | null; phone_number: string | null; country_code: string | null };
};

const PwaVersionsTab = () => {
  const [versions, setVersions] = useState<PwaVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    version: '',
    changelog_he: '',
    changelog_en: '',
    is_current: true,
  });
  const [saving, setSaving] = useState(false);

  const fetchVersions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('pwa_versions')
      .select('*')
      .order('released_at', { ascending: false });
    if (error) {
      toast.error('שגיאה בטעינת גרסאות: ' + error.message);
    } else {
      setVersions((data || []) as PwaVersion[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchVersions();
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setSessionsLoading(true);
    const { data, error } = await supabase
      .from('user_sessions')
      .select('id, created_at, last_used_at, expires_at, device_fingerprint, profile_id, profile:profiles(full_name, phone_number, country_code)')
      .gt('expires_at', new Date().toISOString())
      .order('last_used_at', { ascending: false })
      .limit(200);
    if (error) {
      toast.error('שגיאה בטעינת מכשירים: ' + error.message);
    } else {
      setSessions((data || []) as any);
    }
    setSessionsLoading(false);
  };

  const openNew = () => {
    setEditingId(null);
    setForm({ version: '', changelog_he: '', changelog_en: '', is_current: true });
    setDialogOpen(true);
  };

  const openEdit = (v: PwaVersion) => {
    setEditingId(v.id);
    setForm({
      version: v.version,
      changelog_he: v.changelog_he,
      changelog_en: v.changelog_en,
      is_current: v.is_current,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.version.trim()) {
      toast.error('יש להזין מספר גרסה');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from('pwa_versions')
          .update({
            version: form.version.trim(),
            changelog_he: form.changelog_he,
            changelog_en: form.changelog_en,
            is_current: form.is_current,
          })
          .eq('id', editingId);
        if (error) throw error;
        toast.success('הגרסה עודכנה');
      } else {
        const { error } = await supabase.from('pwa_versions').insert({
          version: form.version.trim(),
          changelog_he: form.changelog_he,
          changelog_en: form.changelog_en,
          is_current: form.is_current,
          released_at: new Date().toISOString(),
        });
        if (error) throw error;
        toast.success('גרסה חדשה נוספה - המשתמשים יקבלו הודעה תוך דקה');
      }
      setDialogOpen(false);
      await fetchVersions();
    } catch (e: any) {
      toast.error('שגיאה בשמירה: ' + (e.message || 'Unknown'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, version: string) => {
    if (!confirm(`למחוק את גרסה ${version}?`)) return;
    const { error } = await supabase.from('pwa_versions').delete().eq('id', id);
    if (error) {
      toast.error('שגיאה במחיקה: ' + error.message);
    } else {
      toast.success('הגרסה נמחקה');
      await fetchVersions();
    }
  };

  const setAsCurrent = async (id: string) => {
    const { error } = await supabase
      .from('pwa_versions')
      .update({ is_current: true })
      .eq('id', id);
    if (error) {
      toast.error('שגיאה: ' + error.message);
    } else {
      toast.success('הגרסה הוגדרה כנוכחית');
      await fetchVersions();
    }
  };

  const formatDate = (s: string) =>
    new Date(s).toLocaleString('he-IL', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              ניהול גרסאות PWA
              <Badge variant="secondary">{versions.length}</Badge>
            </CardTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchVersions} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                רענן
              </Button>
              <Button size="sm" onClick={openNew}>
                <Plus className="h-4 w-4 mr-2" />
                גרסה חדשה
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground mb-4 p-3 bg-muted/40 rounded-md">
            💡 כל פעם שאתה מבצע <strong>Publish</strong>, צור גרסה חדשה כאן וסמן אותה כנוכחית. 
            כל המשתמשים שפתוח להם האתר יקבלו הודעת עדכון תוך דקה.
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>גרסה</TableHead>
                  <TableHead>תאריך</TableHead>
                  <TableHead>מה חדש (עברית)</TableHead>
                  <TableHead>What's New (English)</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead className="text-left">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {versions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {loading ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : 'אין גרסאות'}
                    </TableCell>
                  </TableRow>
                )}
                {versions.map((v) => (
                  <TableRow key={v.id} className={v.is_current ? 'bg-primary/5' : ''}>
                    <TableCell className="font-mono font-bold">v{v.version}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(v.released_at)}
                    </TableCell>
                    <TableCell className="text-sm max-w-xs truncate" dir="rtl">
                      {v.changelog_he || '—'}
                    </TableCell>
                    <TableCell className="text-sm max-w-xs truncate">
                      {v.changelog_en || '—'}
                    </TableCell>
                    <TableCell>
                      {v.is_current ? (
                        <Badge className="bg-primary gap-1">
                          <Star className="h-3 w-3 fill-current" />
                          נוכחית
                        </Badge>
                      ) : (
                        <Badge variant="outline">ישנה</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        {!v.is_current && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="הגדר כנוכחית"
                            onClick={() => setAsCurrent(v.id)}
                          >
                            <Star className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="ערוך"
                          onClick={() => openEdit(v)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          title="מחק"
                          onClick={() => handleDelete(v.id, v.version)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* מכשירים מחוברים */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              מכשירים מחוברים (Sessions פעילים)
              <Badge variant="secondary">{sessions.length}</Badge>
            </CardTitle>
            <Button variant="outline" size="sm" onClick={fetchSessions} disabled={sessionsLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${sessionsLoading ? 'animate-spin' : ''}`} />
              רענן
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground mb-3 p-3 bg-muted/40 rounded-md leading-relaxed">
            ℹ️ אפל לא חושפת את הדגם המדויק של iPhone (כל הדגמים מדווחים כ-"iPhone").
            אנדרואיד כן חושף דגם. הזיהוי מבוסס על User-Agent שנשמר בעת ההתחברות.
            סשנים שנוצרו לפני v1.1.0 יציגו "לא ידוע".
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>משתמש</TableHead>
                  <TableHead>טלפון</TableHead>
                  <TableHead>OS</TableHead>
                  <TableHead>גרסה</TableHead>
                  <TableHead>דגם / מכשיר</TableHead>
                  <TableHead>דפדפן</TableHead>
                  <TableHead>פעילות אחרונה</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {sessionsLoading ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : 'אין סשנים פעילים'}
                    </TableCell>
                  </TableRow>
                )}
                {sessions.map((s) => {
                  const p = parseUA(s.device_fingerprint);
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="text-sm">{s.profile?.full_name || '—'}</TableCell>
                      <TableCell className="text-xs font-mono">
                        {s.profile?.country_code}{s.profile?.phone_number}
                      </TableCell>
                      <TableCell><Badge variant="outline">{p.os}</Badge></TableCell>
                      <TableCell className="text-xs font-mono">{p.osVersion}</TableCell>
                      <TableCell className="text-sm">{p.deviceGuess}</TableCell>
                      <TableCell className="text-xs">{p.browser}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(s.last_used_at)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog להוספה/עריכה */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'עריכת גרסה' : 'גרסה חדשה'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="version">מספר גרסה (למשל 2.54.0)</Label>
              <Input
                id="version"
                placeholder="2.54.0"
                value={form.version}
                onChange={(e) => setForm({ ...form, version: e.target.value })}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="he">מה חדש (עברית)</Label>
              <Textarea
                id="he"
                placeholder="• תיקון באג בצפייה חיה&#10;• שיפור ביצועים"
                value={form.changelog_he}
                onChange={(e) => setForm({ ...form, changelog_he: e.target.value })}
                rows={4}
                dir="rtl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="en">What's New (English)</Label>
              <Textarea
                id="en"
                placeholder="• Fixed live view bug&#10;• Performance improvements"
                value={form.changelog_en}
                onChange={(e) => setForm({ ...form, changelog_en: e.target.value })}
                rows={4}
              />
            </div>
            <div className="flex items-center gap-2 p-3 bg-muted/40 rounded-md">
              <input
                type="checkbox"
                id="is_current"
                checked={form.is_current}
                onChange={(e) => setForm({ ...form, is_current: e.target.checked })}
                className="h-4 w-4"
              />
              <Label htmlFor="is_current" className="cursor-pointer">
                הגדר כגרסה נוכחית (משתמשים יקבלו הודעת עדכון)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving}>
              ביטול
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'שמור'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PwaVersionsTab;
