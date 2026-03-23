"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, CheckCircle, XCircle, AlertCircle, RefreshCw, TrendingUp, Activity, Zap, Database } from "lucide-react";
import { useState, useEffect } from "react";

interface MetricsData {
  timeRange: string;
  summary: {
    totalMessages: number;
    deliveredMessages: number;
    failedMessages: number;
    pendingMessages: number;
    processingMessages: number;
    retryingMessages: number;
    successRate: number;
    avgQueueTime: number;
    totalPayloadSize: number;
  };
  attempts: {
    totalAttempts: number;
    successfulAttempts: number;
    failedAttempts: number;
    successRate: number;
    avgResponseTime: number;
  };
  hourlyData: Array<{
    hour: number;
    count: number;
    delivered: number;
    failed: number;
  }>;
  topEventTypes: Array<{
    eventType: string;
    count: number;
  }>;
  recentMessages: Array<{
    id: string;
    eventId?: string;
    eventType: string;
    status: string;
    createdAt: string;
    responseTimeMs?: number;
    attempts: number;
    destinations: string[];
  }>;
}

export default function MetricsTab() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<string>("24h");
  const [refreshing, setRefreshing] = useState(false);

  const fetchMetrics = async () => {
    try {
      const params = new URLSearchParams();
      params.append("timeRange", timeRange);

      const response = await fetch(`/api/webhooks/metrics?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch metrics");
      }
      const data = (await response.json()) as MetricsData;
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [timeRange]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMetrics();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "processing":
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case "delivered":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "retrying":
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800",
      processing: "bg-blue-100 text-blue-800",
      delivered: "bg-green-100 text-green-800",
      failed: "bg-red-100 text-red-800",
      retrying: "bg-orange-100 text-orange-800",
    };

    return (
      <span className={`text-xs px-2 py-1 rounded ${colors[status as keyof typeof colors]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}m`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-gray-600">Loading metrics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="text-gray-600">No metrics data available</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Metrics</h2>
          <p className="text-muted-foreground">Monitor your webhook performance and delivery statistics</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.summary.totalMessages}</div>
            <p className="text-xs text-muted-foreground">
              {formatBytes(metrics.summary.totalPayloadSize)} total payload
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.summary.successRate}%</div>
            <p className="text-xs text-muted-foreground">{metrics.summary.deliveredMessages} delivered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Queue Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(metrics.summary.avgQueueTime)}</div>
            <p className="text-xs text-muted-foreground">Time from queued to processing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Failed Messages</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.summary.failedMessages}</div>
            <p className="text-xs text-muted-foreground">{metrics.attempts.failedAttempts} failed attempts</p>
          </CardContent>
        </Card>
      </div>

      {/* Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Message Status</CardTitle>
            <CardDescription>Current status distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Delivered</span>
                </div>
                <Badge variant="default">{metrics.summary.deliveredMessages}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm">Failed</span>
                </div>
                <Badge variant="destructive">{metrics.summary.failedMessages}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm">Pending</span>
                </div>
                <Badge variant="secondary">{metrics.summary.pendingMessages}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">Processing</span>
                </div>
                <Badge variant="outline">{metrics.summary.processingMessages}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  <span className="text-sm">Retrying</span>
                </div>
                <Badge variant="outline">{metrics.summary.retryingMessages}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Event Types</CardTitle>
            <CardDescription>Most frequent webhook events</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.topEventTypes.slice(0, 5).map((event, index) => (
                <div key={event.eventType} className="flex justify-between items-center">
                  <span className="text-sm font-medium">{event.eventType}</span>
                  <Badge variant="outline">{event.count}</Badge>
                </div>
              ))}
              {metrics.topEventTypes.length === 0 && <p className="text-sm text-muted-foreground">No events found</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest webhook messages</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {metrics.recentMessages.map(message => (
              <div key={message.id} className="p-3 border rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(message.status)}
                    <div>
                      <div className="font-medium text-sm">
                        {message.eventType && message.eventType.trim() !== "" ? message.eventType : "No event type"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ID: {message.id}
                        {message.eventId && ` • Event ID: ${message.eventId}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(message.status)}
                    <Badge variant="outline">
                      {message.attempts} {message.attempts === 1 ? "attempt" : "attempts"}
                    </Badge>
                    {message.responseTimeMs && (
                      <span className="text-xs text-muted-foreground">{formatDuration(message.responseTimeMs)}</span>
                    )}
                  </div>
                </div>

                {/* Destinations */}
                {message.destinations.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-xs text-muted-foreground mr-1">Destinations:</span>
                    {message.destinations.slice(0, 3).map((destination, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {destination}
                      </Badge>
                    ))}
                    {message.destinations.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{message.destinations.length - 3} more
                      </Badge>
                    )}
                  </div>
                )}

                {/* Timestamp */}
                <div className="text-xs text-muted-foreground">{formatTimestamp(message.createdAt)}</div>
              </div>
            ))}
            {metrics.recentMessages.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">No recent activity</div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
