"use client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, CheckCircle2, XCircle, Webhook } from "lucide-react";
import Link from "next/link";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePortalContext } from "./layout";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Endpoint {
  id: string;
  name: string;
  url: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  topics: string[];
  metrics24h: Array<{
    messageId: string;
    status: string;
    attemptNumber: number;
    attemptedAt: Date;
  }>;
  metrics7d: Array<{
    messageId: string;
    status: string;
    attemptNumber: number;
    attemptedAt: Date;
  }>;
}

interface MetricsData {
  totalEvents7d: number;
  totalSuccess7d: number;
  totalFailed7d: number;
  successRate7d: number;
  chartData7d: Array<{
    date: string;
    events: number;
    success: number;
    failed: number;
  }>;
}

interface PortalGroup {
  id: string;
  name: string;
  failureAlerts: {
    enabled: boolean;
    threshold: number;
    windowMinutes: number;
    endpointIds: string[];
    channelType: "webhook" | "slack";
    destinationUrl?: string;
  };
}

export default function PortalDashboard() {
  const { payload, token, theme } = usePortalContext();
  const [loading, setLoading] = useState(false);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [group, setGroup] = useState<PortalGroup | null>(null);
  const [savingAlerts, setSavingAlerts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/portal/endpoints?token=${encodeURIComponent(token)}`);

      if (!response.ok) {
        throw new Error("Failed to fetch endpoints");
      }

      const data = (await response.json()) as { endpoints: Endpoint[] };
      setEndpoints(data.endpoints || []);

      const groupResponse = await fetch(`/api/portal/group?token=${encodeURIComponent(token)}`);
      if (groupResponse.ok) {
        const groupData = (await groupResponse.json()) as { group: PortalGroup };
        setGroup(groupData.group);
      }

      // Calculate aggregated metrics
      const allMetrics7d = data.endpoints.flatMap(endpoint => endpoint.metrics7d);
      const totalEvents7d = allMetrics7d.length;
      const totalSuccess7d = allMetrics7d.filter(m => m.status === "delivered").length;
      const totalFailed7d = totalEvents7d - totalSuccess7d;
      const successRate7d = totalEvents7d > 0 ? (totalSuccess7d / totalEvents7d) * 100 : 0;

      // Generate chart data for the last 7 days
      const chartData7d = generateChartData(allMetrics7d);

      setMetrics({
        totalEvents7d,
        totalSuccess7d,
        totalFailed7d,
        successRate7d,
        chartData7d,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  const generateChartData = (metrics: Endpoint["metrics7d"]) => {
    const chartData = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const dayMetrics = metrics.filter(m => {
        const attemptedAt = new Date(m.attemptedAt);
        return attemptedAt >= dayStart && attemptedAt < dayEnd;
      });

      const success = dayMetrics.filter(m => m.status === "delivered").length;
      const failed = dayMetrics.filter(m => m.status !== "delivered").length;

      chartData.push({
        date: dayStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        events: success + failed,
        success,
        failed,
      });
    }

    return chartData;
  };

  const updateGroupAlerts = async (nextAlerts: PortalGroup["failureAlerts"]) => {
    try {
      setSavingAlerts(true);
      const response = await fetch(`/api/portal/group?token=${encodeURIComponent(token)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ failureAlerts: nextAlerts }),
      });

      if (!response.ok) {
        throw new Error("Failed to update failure alerts");
      }

      const data = (await response.json()) as { group: PortalGroup };
      setGroup(data.group);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update failure alerts");
    } finally {
      setSavingAlerts(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Monitor your webhook endpoints and delivery metrics{" "}
            {payload.applicationName && `for ${payload.applicationName}`}
          </p>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading dashboard...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 mb-4">Error: {error}</p>
            <Button onClick={fetchData} variant="outline">
              Try Again
            </Button>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-0">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Events (7d)</CardTitle>
                  <Webhook className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono">{metrics?.totalEvents7d.toLocaleString() || "0"}</div>
                  <p className="text-xs text-muted-foreground mt-1">Across all endpoints</p>
                </CardContent>
              </Card>

              <Card className="border-0">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono">{metrics?.successRate7d.toFixed(1) || "0.0"}%</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {metrics?.totalSuccess7d.toLocaleString() || "0"} successful deliveries
                  </p>
                </CardContent>
              </Card>

              <Card className="border-0">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Failed Events</CardTitle>
                  <XCircle className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono">{metrics?.totalFailed7d.toLocaleString() || "0"}</div>
                  <p className="text-xs text-muted-foreground mt-1">Requiring attention</p>
                </CardContent>
              </Card>
            </div>

            {/* Event Volume Chart */}
            <Card className="border-0">
              <CardHeader>
                <CardTitle>Event Volume</CardTitle>
                <CardDescription>Daily webhook events over the last 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={metrics?.chartData7d || []}>
                      <XAxis dataKey="date" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis
                        stroke="#888888"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={value => `${value}`}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-background border border-border p-3 shadow-lg">
                                <p className="font-medium mb-2">{payload[0].payload.date}</p>
                                <div className="space-y-1 text-sm">
                                  <p className="text-muted-foreground">
                                    Total:{" "}
                                    <span className="font-mono font-medium text-foreground">
                                      {payload[0].payload.events}
                                    </span>
                                  </p>
                                  <p className="text-green-600">
                                    Success: <span className="font-mono font-medium">{payload[0].payload.success}</span>
                                  </p>
                                  <p className="text-red-600">
                                    Failed: <span className="font-mono font-medium">{payload[0].payload.failed}</span>
                                  </p>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Line type="monotone" dataKey="events" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Recent Endpoints */}
            <Card className="border-0">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Your Endpoints</CardTitle>
                  <CardDescription>Quick access to your webhook endpoints</CardDescription>
                </div>
                <Button asChild size="sm">
                  <Link href="/portal/endpoints">
                    View All
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {endpoints.map(endpoint => (
                    <Link
                      key={endpoint.id}
                      href={`/portal/endpoints/${endpoint.id}`}
                      className="flex items-center justify-between p-4 border border-border hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-muted flex items-center justify-center">
                            <Webhook className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="flex items-center gap-2">
                              <p className="font-medium truncate">{endpoint.name}</p>
                              <Badge variant="outline">{endpoint.id}</Badge>
                            </span>
                            <p className="text-sm text-muted-foreground truncate mb-2">{endpoint.description}</p>
                            <p className="text-sm text-muted-foreground font-mono truncate">{endpoint.url}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-6 ml-4">
                        <div>
                          {endpoint.isActive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-600 text-xs font-medium">
                              <div className="h-1.5 w-1.5 bg-green-600" />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-500/10 text-gray-600 text-xs font-medium">
                              <div className="h-1.5 w-1.5 bg-gray-600" />
                              Disabled
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}

                  {endpoints.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground mb-4">No endpoints found</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {group && (
              <Card className="border-0">
                <CardHeader>
                  <CardTitle>Failure Alerts</CardTitle>
                  <CardDescription>Receive alerts when events fail to deliver to your endpoints</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant={group.failureAlerts.enabled ? "default" : "secondary"}>
                      {group.failureAlerts.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                    <Badge variant="outline">{group.failureAlerts.channelType.charAt(0).toUpperCase() + group.failureAlerts.channelType.slice(1)}</Badge>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-muted-foreground">Alert URL</span>
                      <Input
                        value={group.failureAlerts.destinationUrl || ""}
                        onChange={event =>
                          setGroup(current =>
                            current
                              ? {
                                  ...current,
                                  failureAlerts: {
                                    ...current.failureAlerts,
                                    destinationUrl: event.target.value,
                                  },
                                }
                              : current
                          )
                        }
                        placeholder="https://hooks.slack.com/services/..."
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-muted-foreground">Channel</span>
                      <Select
                        value={group.failureAlerts.channelType}
                        onValueChange={value =>
                          setGroup(current =>
                            current
                              ? {
                                  ...current,
                                  failureAlerts: {
                                    ...current.failureAlerts,
                                    channelType: value as "webhook" | "slack",
                                  },
                                }
                              : current
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="webhook">Webhook</SelectItem>
                          <SelectItem value="slack">Slack</SelectItem>
                        </SelectContent>
                      </Select>
                    </label>
                    <label className="space-y-2">
                      <span className="text-muted-foreground">Failure Threshold</span>
                      <Input
                        type="number"
                        min={1}
                        value={group.failureAlerts.threshold}
                        onChange={event =>
                          setGroup(current =>
                            current
                              ? {
                                  ...current,
                                  failureAlerts: {
                                    ...current.failureAlerts,
                                    threshold: Number.parseInt(event.target.value || "1", 10),
                                  },
                                }
                              : current
                          )
                        }
                      />
                    </label>
                    <label className="space-y-2">
                      <span className="text-muted-foreground">Window (minutes)</span>
                      <Input
                        type="number"
                        min={1}
                        value={group.failureAlerts.windowMinutes}
                        onChange={event =>
                          setGroup(current =>
                            current
                              ? {
                                  ...current,
                                  failureAlerts: {
                                    ...current.failureAlerts,
                                    windowMinutes: Number.parseInt(event.target.value || "1", 10),
                                  },
                                }
                              : current
                          )
                        }
                      />
                    </label>
                  </div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={group.failureAlerts.enabled}
                      onChange={event =>
                        setGroup(current =>
                          current
                            ? {
                                ...current,
                                failureAlerts: {
                                  ...current.failureAlerts,
                                  enabled: event.target.checked,
                                },
                              }
                            : current
                        )
                      }
                    />
                    Enable failure alerts
                  </label>
                  <Button onClick={() => updateGroupAlerts(group.failureAlerts)} disabled={savingAlerts}>
                    {savingAlerts ? "Saving..." : "Save Alert Settings"}
                  </Button>
                </CardContent>
              </Card>
            )}

          </>
        )}
      </div>
    </>
  );
}
