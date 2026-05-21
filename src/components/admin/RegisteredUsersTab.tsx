// RegisteredUsersTab — v1 (2026-05-21): show all registered profiles with device-link status
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, MessageCircle, Search } from "lucide-react";

interface RegisteredUser {
  id: string;
  full_name: string | null;
  email: string | null;
  phone_number: string | null;
  country_code: string | null;
  phone_verified: boolean | null;
  preferred_language: string | null;
  created_at: string;
  devices_count: number;
  active_devices_count: number;
  last_device_seen_at: string | null;
}

function formatDate(s: string): string {
  return new Date(s).toLocaleString("he-IL", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function buildWaLink(user: RegisteredUser): string | null {
  if (!user.phone_number) return null;
  const cc = (user.country_code || "").replace(/\D/g, "");
  const num = user.phone_number.replace(/\D/g, "").replace(/^0+/, "");
  if (!cc || !num) return null;
  const lang = user.preferred_language === "he" ? "he" : "en";
  const msg =
    lang === "he"
      ? `שלום ${user.full_name || ""},\nראיתי שנרשמת ל-AIGuard אבל עדיין לא הושלמה ההתקנה.\nאשמח לעזור! https://www.aiguard24.com`
      : `Hi ${user.full_name || ""},\nI noticed you registered to AIGuard but haven't completed the install.\nHappy to help! https://www.aiguard24.com`;
  return `https://wa.me/${cc}${num}?text=${encodeURIComponent(msg)}`;
}

function getStatus(u: RegisteredUser): { label: string; color: string } {
  if (u.active_devices_count > 0) return { label: "🟢 פעיל", color: "bg-green-500/10 text-green-500" };
  if (u.devices_count > 0) return { label: "🟡 מכשיר אופליין", color: "bg-yellow-500/10 text-yellow-500" };
  return { label: "🔴 ללא מכשיר", color: "bg-red-500/10 text-red-500" };
}

export default function RegisteredUsersTab() {
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone_number, country_code, phone_verified, preferred_language, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (pErr) throw pErr;

      const { data: devices, error: dErr } = await supabase
        .from("devices")
        .select("id, profile_id, is_active, last_seen_at");
      if (dErr) throw dErr;

      const now = Date.now();
      const TEN_MIN = 10 * 60 * 1000;
      const byProfile = new Map<string, { total: number; active: number; lastSeen: string | null }>();
      (devices || []).forEach((d) => {
        const entry = byProfile.get(d.profile_id) || { total: 0, active: 0, lastSeen: null };
        entry.total += 1;
        const seenMs = d.last_seen_at ? new Date(d.last_seen_at).getTime() : 0;
        if (seenMs && now - seenMs < TEN_MIN) entry.active += 1;
        if (d.last_seen_at && (!entry.lastSeen || new Date(d.last_seen_at) > new Date(entry.lastSeen))) {
          entry.lastSeen = d.last_seen_at;
        }
        byProfile.set(d.profile_id, entry);
      });

      const enriched: RegisteredUser[] = (profiles || []).map((p) => {
        const entry = byProfile.get(p.id) || { total: 0, active: 0, lastSeen: null };
        return {
          ...p,
          devices_count: entry.total,
          active_devices_count: entry.active,
          last_device_seen_at: entry.lastSeen,
        };
      });
      setUsers(enriched);
    } catch (err) {
      console.error("RegisteredUsersTab fetch error:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const q = search.trim().toLowerCase();
  const filtered = q
    ? users.filter(
        (u) =>
          (u.full_name || "").toLowerCase().includes(q) ||
          (u.email || "").toLowerCase().includes(q) ||
          (u.phone_number || "").includes(q)
      )
    : users;

  const total = users.length;
  const verified = users.filter((u) => u.phone_verified).length;
  const withDevice = users.filter((u) => u.devices_count > 0).length;
  const activeNow = users.filter((u) => u.active_devices_count > 0).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">סה"כ רשומים</div><div className="text-2xl font-bold">{total}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">מאומתים</div><div className="text-2xl font-bold">{verified}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">עם מכשיר</div><div className="text-2xl font-bold">{withDevice}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">פעילים כעת</div><div className="text-2xl font-bold text-green-500">{activeNow}</div></CardContent></Card>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="חיפוש לפי שם / טלפון / אימייל"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button onClick={fetchUsers} disabled={loading} variant="outline" size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          רענן
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>שם</TableHead>
                  <TableHead>טלפון</TableHead>
                  <TableHead>אימייל</TableHead>
                  <TableHead>שפה</TableHead>
                  <TableHead>מאומת</TableHead>
                  <TableHead>מכשירים</TableHead>
                  <TableHead>סטטוס</TableHead>
                  <TableHead>נרשם</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      {loading ? "טוען..." : "לא נמצאו משתמשים"}
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((u) => {
                  const status = getStatus(u);
                  const wa = buildWaLink(u);
                  return (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                      <TableCell className="font-mono text-sm" dir="ltr">
                        {u.phone_number ? `${u.country_code || ""}${u.phone_number}` : "—"}
                      </TableCell>
                      <TableCell className="text-sm">{u.email || "—"}</TableCell>
                      <TableCell><Badge variant="outline">{u.preferred_language || "—"}</Badge></TableCell>
                      <TableCell>{u.phone_verified ? "✅" : "❌"}</TableCell>
                      <TableCell className="text-center">
                        <span className="font-mono">{u.active_devices_count}/{u.devices_count}</span>
                      </TableCell>
                      <TableCell><span className={`px-2 py-1 rounded text-xs ${status.color}`}>{status.label}</span></TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(u.created_at)}</TableCell>
                      <TableCell>
                        {wa ? (
                          <a href={wa} target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="outline" className="gap-1">
                              <MessageCircle className="h-3 w-3" />
                              WA
                            </Button>
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}