import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Shield, Clock, Cpu, AlertTriangle } from "lucide-react";

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
  devices?: { device_name: string; profile_id: string; last_seen_at: string | null };
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

function isStale(dateStr: string): boolean {
  return Date.now() - new Date(dateStr).getTime() > 10 * 60 * 1000; // >10 min
}

const AdminDiagnostics = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [diagnostics, setDiagnostics] = useState<DiagnosticRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedDevice, setExpandedDevice] = useState<string | null>(null);

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      setAuthenticated(true);
      setError("");
    } else {
      setError("סיסמה שגויה / Wrong password");
    }
  };

  const fetchDiagnostics = async () => {
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from("device_diagnostics")
        .select("*, devices(device_name, profile_id, last_seen_at)")
        .order("updated_at", { ascending: false });

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
          <Button onClick={fetchDiagnostics} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Uptime</TableHead>
                    <TableHead>Monitoring</TableHead>
                    <TableHead>Camera</TableHead>
                    <TableHead>Motion</TableHead>
                    <TableHead>Sound</TableHead>
                    <TableHead>Last Report</TableHead>
                    <TableHead>Errors</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diagnostics.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
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
                            {row.devices?.device_name || row.device_id.slice(0, 8)}
                            {stale && <span className="ml-1 text-destructive text-xs">⚠ offline</span>}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{row.agent_version}</Badge>
                          </TableCell>
                          <TableCell>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatUptime(row.uptime_seconds)}
                            </span>
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
                          <TableCell className="text-xs text-muted-foreground">
                            {getTimeSince(row.updated_at)}
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
                        </TableRow>
                        {expandedDevice === row.id && (
                          <TableRow key={`${row.id}-detail`}>
                            <TableCell colSpan={9} className="bg-muted/30 p-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <h4 className="font-semibold mb-2">System Info</h4>
                                  <pre className="text-xs bg-background p-3 rounded overflow-auto max-h-40">
                                    {JSON.stringify(row.system_info, null, 2)}
                                  </pre>
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
