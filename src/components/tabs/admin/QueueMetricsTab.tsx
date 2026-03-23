"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Activity,
  Clock,
  TrendingUp,
  Database,
  Zap,
} from "lucide-react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface QueueMetrics {
  backlog: {
    messages: number;
    bytes: number;
  };
  consumerConcurrency: number;
  messageOperations: {
    totalOperations: number;
    totalBytes: number;
    avgLagTime: number;
    avgRetries: number;
    maxMessageSize: number;
  };
  timeRange: string;
  lastUpdated: string;
}

interface ChartDataPoint {
  time: string;
  messages: number;
  bytes: number;
  concurrency: number;
  writeOperations: number;
  readOperations: number;
  deleteOperations: number;
  lagTime: number;
  retries: number;
}

interface DeleteOutcomeDataPoint {
  time: string;
  success: number;
  dlq: number;
  fail: number;
}

interface RawMetricsData {
  backlog: Array<{
    avg: { messages: number; bytes: number };
    dimensions: { datetime: string };
  }>;
  consumer: Array<{
    avg: { concurrency: number };
    dimensions: { datetimeHour: string };
  }>;
  operations: Array<{
    count: number;
    sum: { bytes: number };
    avg: { lagTime: number; retryCount: number };
    max: { messageSize: number };
    dimensions: { datetimeMinute: string; actionType: string; outcome?: string };
  }>;
}

export default function QueueMetricsTab() {
  const [metrics, setMetrics] = useState<QueueMetrics | null>(null);
  const [rawData, setRawData] = useState<RawMetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<string>("24h");

  useEffect(() => {
    fetchMetrics();
  }, [timeRange]);

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/admin/queue-metrics?timeRange=${timeRange}&includeRaw=true`);

      if (!response.ok) {
        if (response.status === 400) {
          const errorData = (await response.json()) as { error?: string };
          throw new Error(errorData.error || "Configuration error");
        } else if (response.status === 401) {
          throw new Error("Unauthorized - Admin access required");
        } else {
          throw new Error("Failed to fetch queue metrics");
        }
      }

      const data = (await response.json()) as QueueMetrics & { rawData?: RawMetricsData };
      setMetrics(data);
      if (data.rawData) {
        setRawData(data.rawData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchMetrics();
  };

  const handleTimeRangeChange = (value: string) => {
    setTimeRange(value);
  };

  // Generate complete time series for the selected range
  const generateTimeSeries = (): string[] => {
    const now = new Date();
    const timePoints: string[] = [];

    switch (timeRange) {
      case "1h":
        // Generate 5-minute intervals for the last hour
        for (let i = 0; i < 12; i++) {
          const time = new Date(now.getTime() - (11 - i) * 5 * 60 * 1000);
          timePoints.push(`${time.getMinutes()}m`);
        }
        break;
      case "24h":
        // Generate hourly intervals for the last 24 hours
        for (let i = 0; i < 24; i++) {
          const time = new Date(now.getTime() - (23 - i) * 60 * 60 * 1000);
          timePoints.push(`${time.getHours()}h`);
        }
        break;
      case "7d":
        // Generate daily intervals for the last 7 days
        for (let i = 0; i < 7; i++) {
          const time = new Date(now.getTime() - (6 - i) * 24 * 60 * 60 * 1000);
          timePoints.push(`Day ${time.getDate()}`);
        }
        break;
      case "30d":
        // Generate daily intervals for the last 30 days
        for (let i = 0; i < 30; i++) {
          const time = new Date(now.getTime() - (29 - i) * 24 * 60 * 60 * 1000);
          timePoints.push(`Day ${time.getDate()}`);
        }
        break;
    }

    return timePoints;
  };

  // Process raw data into chart format
  const processChartData = (): ChartDataPoint[] => {
    if (!rawData) return [];

    // Generate complete time series
    const timeSeries = generateTimeSeries();

    // Create a map to combine data from different sources
    const timeMap = new Map<string, ChartDataPoint>();

    // Initialize all time points with zeros
    timeSeries.forEach(timeKey => {
      timeMap.set(timeKey, {
        time: timeKey,
        messages: 0,
        bytes: 0,
        concurrency: 0,
        writeOperations: 0,
        readOperations: 0,
        deleteOperations: 0,
        lagTime: 0,
        retries: 0,
      });
    });

    // Process backlog data
    rawData.backlog.forEach(item => {
      const timeKey = formatTimeKey(item.dimensions.datetime, timeRange);
      if (timeMap.has(timeKey)) {
        const point = timeMap.get(timeKey)!;
        point.messages = item.avg.messages;
        point.bytes = item.avg.bytes;
      }
    });

    // Process consumer data
    rawData.consumer.forEach(item => {
      const timeKey = formatTimeKey(item.dimensions.datetimeHour, timeRange);
      if (timeMap.has(timeKey)) {
        const point = timeMap.get(timeKey)!;
        point.concurrency = item.avg.concurrency;
      }
    });

    // Process operations data - separate by action type and accumulate lag time
    rawData.operations.forEach(item => {
      const timeKey = formatTimeKey(item.dimensions.datetimeMinute, timeRange);
      if (timeMap.has(timeKey)) {
        const point = timeMap.get(timeKey)!;

        // Separate operations by type
        switch (item.dimensions.actionType) {
          case "WriteMessage":
            point.writeOperations += item.count;
            break;
          case "ReadMessage":
            point.readOperations += item.count;
            break;
          case "DeleteMessage":
            point.deleteOperations += item.count;
            break;
        }

        // Accumulate lag time (weighted by count) and retries
        const totalLagTime =
          point.lagTime * (point.writeOperations + point.readOperations + point.deleteOperations - item.count) +
          item.avg.lagTime * item.count;
        const totalOperations = point.writeOperations + point.readOperations + point.deleteOperations;
        point.lagTime = totalOperations > 0 ? totalLagTime / totalOperations : 0;

        const totalRetries =
          point.retries * (point.writeOperations + point.readOperations + point.deleteOperations - item.count) +
          item.avg.retryCount * item.count;
        point.retries = totalOperations > 0 ? totalRetries / totalOperations : 0;
      }
    });

    // Convert map to array (already sorted by time series generation)
    return Array.from(timeMap.values());
  };

  // Process delete message outcomes data
  const processDeleteOutcomeData = (): DeleteOutcomeDataPoint[] => {
    if (!rawData) return [];

    // Generate complete time series
    const timeSeries = generateTimeSeries();

    const timeMap = new Map<string, DeleteOutcomeDataPoint>();

    // Initialize all time points with zeros
    timeSeries.forEach(timeKey => {
      timeMap.set(timeKey, {
        time: timeKey,
        success: 0,
        dlq: 0,
        fail: 0,
      });
    });

    rawData.operations.forEach(item => {
      if (item.dimensions.actionType === "DeleteMessage") {
        const timeKey = formatTimeKey(item.dimensions.datetimeMinute, timeRange);
        if (timeMap.has(timeKey)) {
          const point = timeMap.get(timeKey)!;

          switch (item.dimensions.outcome) {
            case "success":
              point.success += item.count;
              break;
            case "dlq":
              point.dlq += item.count;
              break;
            case "fail":
              point.fail += item.count;
              break;
          }
        }
      }
    });

    return Array.from(timeMap.values());
  };

  const formatTimeKey = (datetime: string, range: string): string => {
    const date = new Date(datetime);

    switch (range) {
      case "1h":
        return `${date.getMinutes()}m`;
      case "24h":
        return `${date.getHours()}h`;
      case "7d":
        return `Day ${date.getDate()}`;
      case "30d":
        return `Day ${date.getDate()}`;
      default:
        return datetime;
    }
  };

  const chartData = processChartData();
  const deleteOutcomeData = processDeleteOutcomeData();

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return Math.round(num).toString();
  };

  const formatLagTime = (lagTimeMs: number): string => {
    if (lagTimeMs >= 1000) {
      return (lagTimeMs / 1000).toFixed(1) + "s";
    }
    return Math.round(lagTimeMs) + "ms";
  };

  const formatBacklogMessages = (messages: number): string => {
    return formatNumber(Math.round(messages));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading queue metrics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-center space-x-2 p-4">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <div>
              <p className="text-red-800 font-medium">Error loading queue metrics</p>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">No metrics data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Queue Metrics</h2>
          <p className="text-muted-foreground">
            Cloudflare Queue performance and statistics. Metrics on this page represent all environments on the server.
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <Select value={timeRange} onValueChange={handleTimeRangeChange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
            {refreshing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">Backlog Messages</p>
            </div>
            <p className="text-2xl font-bold">{formatBacklogMessages(metrics.backlog.messages)}</p>
            <p className="text-xs text-muted-foreground">{formatBytes(metrics.backlog.bytes)} in queue</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">Consumer Concurrency</p>
            </div>
            <p className="text-2xl font-bold">{metrics.consumerConcurrency.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Average concurrent consumers</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">Total Operations</p>
            </div>
            <p className="text-2xl font-bold">{formatNumber(metrics.messageOperations.totalOperations)}</p>
            <p className="text-xs text-muted-foreground">
              {formatBytes(metrics.messageOperations.totalBytes)} processed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium text-muted-foreground">Avg Lag Time</p>
            </div>
            <p className="text-2xl font-bold">{formatLagTime(metrics.messageOperations.avgLagTime)}</p>
            <p className="text-xs text-muted-foreground">
              {metrics.messageOperations.avgRetries.toFixed(1)} avg retries
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Backlog Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5" />
              <span>Backlog Trend</span>
            </CardTitle>
            <CardDescription>Queue backlog over time ({timeRange})</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    color: "hsl(var(--foreground))",
                  }}
                  formatter={(value, name) => [
                    name === "messages" ? formatBacklogMessages(Number(value)) : formatBytes(Number(value)),
                    name === "messages" ? "Messages" : "Bytes",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="messages"
                  stackId="1"
                  stroke="#8884d8"
                  fill="#8884d8"
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Consumer Concurrency */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Consumer Concurrency</span>
            </CardTitle>
            <CardDescription>Active consumers over time ({timeRange})</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    color: "hsl(var(--foreground))",
                  }}
                  formatter={value => [Number(value).toFixed(1), "Concurrency"]}
                />
                <Line
                  type="monotone"
                  dataKey="concurrency"
                  stroke="#82ca9d"
                  strokeWidth={2}
                  dot={{ fill: "#82ca9d" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Message Operations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>Message Operations</span>
            </CardTitle>
            <CardDescription>Operations by type over time ({timeRange})</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    color: "hsl(var(--foreground))",
                  }}
                  formatter={(value, name) => [
                    formatNumber(Number(value)),
                    name === "writeOperations"
                      ? "Write Operations"
                      : name === "readOperations"
                        ? "Read Operations"
                        : name === "deleteOperations"
                          ? "Delete Operations"
                          : name === "retries"
                            ? "Retries"
                            : name,
                  ]}
                />
                <Bar dataKey="writeOperations" stackId="operations" fill="#8884d8" name="Write Operations" />
                <Bar dataKey="readOperations" stackId="operations" fill="#82ca9d" name="Read Operations" />
                <Bar dataKey="deleteOperations" stackId="operations" fill="#ff7300" name="Delete Operations" />
                <Bar dataKey="retries" fill="#6366f1" name="Retries" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Performance Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Performance Metrics</span>
            </CardTitle>
            <CardDescription>Lag time and message size distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">Average Lag Time</p>
                <div className="h-32">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "6px",
                          color: "hsl(var(--foreground))",
                        }}
                        formatter={value => [formatLagTime(Number(value)), "Lag Time"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="lagTime"
                        stroke="#ff7300"
                        strokeWidth={2}
                        dot={{ fill: "#ff7300" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Max Message Size</p>
                  <p className="text-lg font-semibold">{formatBytes(metrics.messageOperations.maxMessageSize)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Avg Retries</p>
                  <p className="text-lg font-semibold">{metrics.messageOperations.avgRetries.toFixed(1)}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bandwidth Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Database className="h-5 w-5" />
              <span>Bandwidth Usage</span>
            </CardTitle>
            <CardDescription>Data throughput over time ({timeRange})</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    color: "hsl(var(--foreground))",
                  }}
                  formatter={value => [formatBytes(Number(value)), "Bytes"]}
                />
                <Area type="monotone" dataKey="bytes" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Delete Message Outcomes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5" />
              <span>Delete Message Outcomes</span>
            </CardTitle>
            <CardDescription>Delete operation results over time ({timeRange})</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={deleteOutcomeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    color: "hsl(var(--foreground))",
                  }}
                  formatter={(value, name) => [
                    formatNumber(Number(value)),
                    name === "success"
                      ? "Success"
                      : name === "dlq"
                        ? "Dead Letter Queue"
                        : name === "fail"
                          ? "Failed"
                          : name,
                  ]}
                />
                <Bar dataKey="success" fill="#22c55e" name="Success" />
                <Bar dataKey="dlq" fill="#f59e0b" name="Dead Letter Queue" />
                <Bar dataKey="fail" fill="#ef4444" name="Failed" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Last Updated */}
      <div className="text-center text-sm text-muted-foreground">
        Last updated: {new Date(metrics.lastUpdated).toLocaleString()}
      </div>
    </div>
  );
}
