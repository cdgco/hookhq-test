"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Webhook, MoreVertical, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { usePortalContext } from "../layout";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis } from "recharts";

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

interface ChartData {
  date: string;
  success: number;
  failed: number;
  total: number;
}

export default function EndpointsPage() {
  const { payload, token, theme } = usePortalContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<"24h" | "7d">("7d");

  useEffect(() => {
    fetchEndpoints();
  }, []);

  const fetchEndpoints = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/portal/endpoints?token=${encodeURIComponent(token)}`);

      if (!response.ok) {
        throw new Error("Failed to fetch endpoints");
      }

      const data = (await response.json()) as { endpoints: Endpoint[] };
      setEndpoints(data.endpoints || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch endpoints");
    } finally {
      setLoading(false);
    }
  };

  const calculateSuccessRate = (metrics: Endpoint["metrics24h"] | Endpoint["metrics7d"]) => {
    if (metrics.length === 0) return 0;
    const successful = metrics.filter(m => m.status === "delivered").length;
    return ((successful / metrics.length) * 100).toFixed(1);
  };

  const generateChartData = (metrics: Endpoint["metrics24h"] | Endpoint["metrics7d"]): ChartData[] => {
    const is24h = timeRange === "24h";
    const now = new Date();
    const startTime = is24h
      ? new Date(now.getTime() - 24 * 60 * 60 * 1000)
      : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const intervalMs = is24h ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000; // 1 hour or 1 day
    const intervals = is24h ? 24 : 7;

    const chartData: ChartData[] = [];

    for (let i = 0; i < intervals; i++) {
      const intervalStart = new Date(startTime.getTime() + i * intervalMs);
      const intervalEnd = new Date(intervalStart.getTime() + intervalMs);

      const intervalMetrics = metrics.filter(m => {
        const attemptedAt = new Date(m.attemptedAt);
        return attemptedAt >= intervalStart && attemptedAt < intervalEnd;
      });

      const success = intervalMetrics.filter(m => m.status === "delivered").length;
      const failed = intervalMetrics.filter(m => m.status !== "delivered").length;

      chartData.push({
        date: is24h
          ? intervalStart.toLocaleTimeString("en-US", { hour: "2-digit", hour12: false })
          : intervalStart.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        success,
        failed,
        total: success + failed,
      });
    }

    return chartData;
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Endpoints</h1>
            <p className="text-muted-foreground mt-1">Manage your event endpoints</p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Endpoint
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter by name or URL..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 bg-card border-border "
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant={timeRange === "7d" ? "default" : "outline"} size="sm" onClick={() => setTimeRange("7d")}>
              7d
            </Button>
            <Button variant={timeRange === "24h" ? "default" : "outline"} size="sm" onClick={() => setTimeRange("24h")}>
              24h
            </Button>
          </div>
        </div>

        {/* Endpoints Table */}
        <div className="border-0 bg-card">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 font-medium text-sm text-muted-foreground">Endpoint</th>
                  <th className="text-left p-4 font-medium text-sm text-muted-foreground">Topics</th>
                  <th className="text-left p-4 font-medium text-sm text-muted-foreground">Success Rate</th>
                  <th className="text-left p-4 font-medium text-sm text-muted-foreground">Status</th>
                  <th className="text-left p-4 font-medium text-sm text-muted-foreground">Events ({timeRange})</th>
                  <th className="w-12 p-4"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                      Loading endpoints...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-red-600">
                      Error: {error}
                    </td>
                  </tr>
                ) : (
                  endpoints
                    .filter(
                      endpoint =>
                        endpoint.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        endpoint.url.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map(endpoint => {
                      const currentMetrics = timeRange === "24h" ? endpoint.metrics24h : endpoint.metrics7d;
                      const successRate = calculateSuccessRate(currentMetrics);
                      const totalEvents = currentMetrics.length;

                      return (
                        <tr key={endpoint.id} className="border-b border-border hover:bg-accent/50 transition-colors">
                          <td className="p-4">
                            <Link href={`/portal/endpoints/${endpoint.id}`} className="block group">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-muted flex items-center justify-center">
                                  <Webhook className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium group-hover:text-primary transition-colors">
                                    {endpoint.name}
                                  </p>
                                  <p className="text-sm text-muted-foreground font-mono truncate">{endpoint.url}</p>
                                </div>
                              </div>
                            </Link>
                          </td>
                          <td className="p-4">
                            <span className="font-mono text-sm">{endpoint.topics.length}</span>
                          </td>
                          <td className="p-4">
                            <span className="font-mono text-sm">{successRate}%</span>
                          </td>
                          <td className="p-4">
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
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-20 h-8">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart
                                    data={generateChartData(endpoint[timeRange === "24h" ? "metrics24h" : "metrics7d"])}
                                    margin={{ top: 2, right: 2, left: 2, bottom: 2 }}
                                  >
                                    <XAxis hide />
                                    <YAxis hide />
                                    <Bar dataKey="success" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                                    <Bar dataKey="failed" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          </td>
                          <td className="p-4">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="border-0">
                                <DropdownMenuItem>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem className="text-red-600">
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {endpoints.length === 0 && !loading && !error && (
          <div className="text-center py-12">
            <Webhook className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No endpoints found</h3>
            <p className="text-muted-foreground mb-4">Get started by creating your first webhook endpoint</p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Endpoint
            </Button>
          </div>
        )}

        {endpoints.length > 0 && (
          <div className="text-sm text-muted-foreground">
            {endpoints.length} endpoint{endpoints.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Create Endpoint Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="border-0">
          <DialogHeader>
            <DialogTitle>Create Endpoint</DialogTitle>
            <DialogDescription>Add a new webhook endpoint to receive events</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="Production API" className="border-0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="url">Webhook URL</Label>
              <Input id="url" placeholder="https://api.example.com/webhooks" className="border-0" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input id="description" placeholder="Main production webhook endpoint" className="border-0" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setCreateDialogOpen(false)}>Create Endpoint</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
