import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Shield, Clock, Cpu, AlertTriangle, Trash2, LogOut, CalendarX } from "lucide-react";

const ADMIN_PASSWORD = "684Mr3411";

interface DiagnosticRow {
  id: string;
  device_id: string;
  agent_version: string;
  uptime_seconds: number;
  monitoring_active: boolean;
  camera_status: string;
  motion_detector_status: string;
  sound_detector_status: string;
  system_info: Record<string, unknown>;
  recent_errors: Array<{ ts: string; source: string; message: string }>;
  updated_at: string;
  device_name: string | null;
  last_seen_at: string | null;
  user_full_name: string | null;
  user_phone: string | null;
  user_country_code: string | null;
  device_mode: string | null;
  total_events: number;
  events_24h: number;
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case "active": return "bg-green-500";
    case "idle": return "bg-yellow-500";
    case "off":
    case "not_loaded":
    case "unknown": return "bg-red-500";
    default: return "bg-muted";
  }
}

function getTimeSince(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("he-IL", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function getPlatformLabel(systemInfo: Record<string, unknown> | null): string {
  if (!systemInfo || !systemInfo.platform) return "—";
  const p = String(systemInfo.platform).toLowerCase();
  if (p.includes("win")) return "🪟 WIN";
  if (p.includes("darwin")) return "🍎 MAC";
  if (p.includes("linux")) return "🐧 Linux";
  return String(systemInfo.platform).toUpperCase();
}

function isStale(dateStr: string): boolean {
  return Date.now() - new Date(dateStr).getTime() > 10 * 60 * 1000;
}

const AdminDiagnostics = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [diagnostics, setDiagnostics] = useState<DiagnosticRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedDevice, setExpandedDevice] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteBeforeDate, setDeleteBeforeDate] = useState("");
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setAuthenticated(true);
      setError("");
    } else {
      setError("סיסמה שגויה / Wrong password");
    }
  };

  const handleLogout = () => {
    setAuthenticated(false);
    setPassword("");
    setDiagnostics([]);
    setExpandedDevice(null);
  };

  const fetchDiagnostics = async () => {
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .rpc("get_diagnostics_with_profiles");

      if (fetchError) {
        console.error("Fetch error:", fetchError);
      } else {
        setDiagnostics((data as unknown as DiagnosticRow[]) || []);
      }
    } catch (err) {
      console.error("Error fetching diagnostics:", err);
    }
    setLoading(false);
  };

  const deleteRow = async (id: string) => {
    if (!confirm("למחוק שורה זו? / Delete this row?")) return;
    setDeletingId(id);
    const { error } = await supabase.from("device_diagnostics").delete().eq("id", id);
    if (error) {
      console.error("Delete error:", error);
      alert("שגיאה במחיקה: " + error.message);
    } else {
      setDiagnostics((prev) => prev.filter((r) => r.id !== id));
    }
    setDeletingId(null);
  };

  const deleteOlderThan = async () => {
    if (!deleteBeforeDate) return;
    if (!confirm(`למחוק את כל הדיווחים לפני ${deleteBeforeDate}?`)) return;
    setBulkDeleting(true);
    const { error, count } = await supabase
      .from("device_diagnostics")
      .delete({ count: "exact" })
      .lt("updated_at", new Date(deleteBeforeDate).toISOString());
    if (error) {
      console.error("Bulk delete error:", error);
      alert("שגיאה: " + error.message);
    } else {
      alert(`נמחקו ${count || 0} שורות`);
      fetchDiagnostics();
    }
    setBulkDeleting(false);
  };

  useEffect(() => {
    if (authenticated) {
      fetchDiagnostics();
    }
  }, [authenticated]);

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Admin Diagnostics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={handleLogin} className="w-full">
              Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Cpu className="h-6 w-6" />
            Device Diagnostics
            <Badge variant="secondary">{diagnostics.length} devices</Badge>
          </h1>
          <div className="flex items-center gap-2">
            <Button onClick={fetchDiagnostics} disabled={loading} variant="outline" size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button onClick={handleLogout} variant="ghost" size="sm">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {/* Bulk delete by date */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <CalendarX className="h-5 w-5 text-destructive" />
              <span className="text-sm font-medium">מחיקה לפי תאריך:</span>
              <Input
                type="date"
                value={deleteBeforeDate}
                onChange={(e) => setDeleteBeforeDate(e.target.value)}
                className="w-auto"
              />
              <Button
                onClick={deleteOlderThan}
                disabled={!deleteBeforeDate || bulkDeleting}
                variant="destructive"
                size="sm"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {bulkDeleting ? "מוחק..." : "מחק דיווחים ישנים"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>OS</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Uptime</TableHead>
                    <TableHead>Away</TableHead>
                    <TableHead>Monitoring</TableHead>
                    <TableHead>Camera</TableHead>
                    <TableHead>Motion</TableHead>
                    <TableHead>Sound</TableHead>
                    <TableHead>Last Report</TableHead>
                    <TableHead>Events</TableHead>
                    <TableHead>Errors</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diagnostics.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={14} className="text-center text-muted-foreground py-8">
                        {loading ? "Loading..." : "No diagnostic data yet"}
                      </TableCell>
                    </TableRow>
                  )}
                  {diagnostics.map((row) => {
                    const stale = isStale(row.updated_at);
                    return (
                      <>
                        <TableRow
                          key={row.id}
                          className={`cursor-pointer hover:bg-muted/50 ${stale ? "opacity-60" : ""}`}
                          onClick={() => setExpandedDevice(expandedDevice === row.id ? null : row.id)}
                        >
                          <TableCell className="font-medium">
                            {row.device_name || row.device_id.slice(0, 8)}
                            {stale && <span className="ml-1 text-destructive text-xs">⚠ offline</span>}
                          </TableCell>
                          <TableCell className="text-sm">
                            {row.user_full_name || "—"}
                          </TableCell>
                          <TableCell className="text-sm font-mono">
                            {row.user_phone
                              ? `${row.user_country_code || ''}${row.user_phone}`
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{getPlatformLabel(row.system_info)}</Badge>
                          </TableCell>
                          <TableCell>
                            {row.agent_version}
                          </TableCell>
                          <TableCell>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatUptime(row.uptime_seconds)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={row.device_mode === "AWAY" ? "default" : "secondary"}>
                              {row.device_mode === "AWAY" ? "AWAY" : "OFF"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={row.monitoring_active ? "default" : "secondary"}>
                              {row.monitoring_active ? "ON" : "OFF"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className={`inline-block w-3 h-3 rounded-full ${getStatusColor(row.camera_status)}`} title={row.camera_status} />
                          </TableCell>
                          <TableCell>
                            <span className={`inline-block w-3 h-3 rounded-full ${getStatusColor(row.motion_detector_status)}`} title={row.motion_detector_status} />
                          </TableCell>
                          <TableCell>
                            <span className={`inline-block w-3 h-3 rounded-full ${getStatusColor(row.sound_detector_status)}`} title={row.sound_detector_status} />
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            <div>{formatDateTime(row.updated_at)}</div>
                            <div className="text-[10px]">{getTimeSince(row.updated_at)}</div>
                          </TableCell>
                          <TableCell>
                            {row.recent_errors && row.recent_errors.length > 0 ? (
                              <Badge variant="destructive" className="gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {row.recent_errors.length}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">0</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              disabled={deletingId === row.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteRow(row.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                        {expandedDevice === row.id && (
                          <TableRow key={`${row.id}-detail`}>
                            <TableCell colSpan={14} className="bg-muted/30 p-4">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                  <h4 className="font-semibold mb-2">System Info</h4>
                                  <pre className="text-xs bg-background p-3 rounded overflow-auto max-h-40">
                                    {JSON.stringify(row.system_info, null, 2)}
                                  </pre>
                                </div>
                                <div>
                                  <h4 className="font-semibold mb-2">Motion Frame Stats</h4>
                                  {(() => {
                                    const si = row.system_info as Record<string, unknown> | null;
                                    const frames = si?.motion_frames_processed as number | undefined;
                                    if (frames === undefined) {
                                      return <p className="text-xs text-muted-foreground">Not available (agent &lt; v2.51.0)</p>;
                                    }
                                    const detections = (si?.motion_detections_found as number) || 0;
                                    const skipped = (si?.motion_frames_skipped as number) || 0;
                                    const delegate = (si?.motion_delegate as string) || '?';
                                    const confirmed = si?.motion_inference_confirmed as boolean;
                                    const errors = (si?.motion_consecutive_errors as number) || 0;
                                    return (
                                      <div className="space-y-1 text-xs">
                                        <div className="flex justify-between"><span>Frames processed:</span><span className="font-mono font-bold">{frames}</span></div>
                                        <div className="flex justify-between"><span>Detections found:</span><span className="font-mono font-bold">{detections}</span></div>
                                        <div className="flex justify-between"><span>Frames skipped (video not ready):</span><span className="font-mono">{skipped}</span></div>
                                        <div className="flex justify-between"><span>Delegate:</span><span className="font-mono">{delegate}</span></div>
                                        <div className="flex justify-between"><span>Inference confirmed:</span><span>{confirmed ? '✅' : '❌'}</span></div>
                                        <div className="flex justify-between"><span>Consecutive errors:</span><span className="font-mono">{errors}</span></div>
                                        {frames === 0 && <p className="text-destructive font-semibold mt-2">⚠ Zero frames — video element likely not playing</p>}
                                        {frames > 0 && detections === 0 && <p className="text-yellow-500 font-semibold mt-2">⚠ Frames OK but zero detections — GPU may produce empty results</p>}
                                      </div>
                                    );
                                  })()}
                                </div>
                                <div>
                                  <h4 className="font-semibold mb-2">Recent Errors ({row.recent_errors?.length || 0})</h4>
                                  {row.recent_errors && row.recent_errors.length > 0 ? (
                                    <div className="space-y-2 max-h-40 overflow-auto">
                                      {row.recent_errors.map((err, i) => (
                                        <div key={i} className="text-xs bg-destructive/10 p-2 rounded">
                                          <span className="text-muted-foreground">{err.ts}</span>
                                          <span className="mx-1 font-semibold">[{err.source}]</span>
                                          {err.message}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-muted-foreground">No errors recorded</p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDiagnostics;
