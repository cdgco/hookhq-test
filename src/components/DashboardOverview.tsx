"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Clock, Send, TrendingUp, XCircle, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorStateCard, LoadingStateCard } from "@/components/shared/resource-state";
import { cn } from "@/lib/utils";
import { getPublicApiUrl } from "@/lib/publicApi/utils";
import { ErrorBody } from "@/lib/webhookApi";

type MetricCard = {
  label: string;
  value: string;
  change: string;
  icon: LucideIcon;
  color: string;
};

type RecentEvent = {
  id: string;
  type: string;
  endpoint: string;
  status: string;
  timestamp: string;
};

interface DashboardMetricsData {
  summary: {
    totalMessages: number;
    deliveredMessages: number;
    failedMessages: number;
    successRate: number;
    avgQueueTime: number;
  };
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

function getQuickLinks(apiDocsEnabled: boolean) {
  return [
    { label: "Create Endpoint", href: "/dashboard/endpoints" },
    { label: "View Metrics", href: "/dashboard/metrics" },
    { label: "Event Logs", href: "/dashboard/log" },
    ...(apiDocsEnabled ? [{ label: "API Documentation", href: getPublicApiUrl() }] : []),
  ];
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.round(ms / 60_000)}m`;
}

async function fetchDashboardMetrics() {
  const response = await fetch("/api/webhooks/metrics?timeRange=7d");

  if (!response.ok) {
    let message = "Request failed";

    try {
      const errorBody = (await response.json()) as ErrorBody;
      message = errorBody.message || errorBody.error || message;
    } catch {
      message = response.statusText || message;
    }

    throw new Error(message);
  }

  return (await response.json()) as DashboardMetricsData;
}

function buildMetrics(data?: DashboardMetricsData): MetricCard[] {
  const summary = data?.summary;
  const totalMessages = summary?.totalMessages ?? 0;
  const deliveredMessages = summary?.deliveredMessages ?? 0;
  const failedMessages = summary?.failedMessages ?? 0;
  const successRate = summary?.successRate ?? 0;
  const avgQueueTime = summary?.avgQueueTime ?? 0;
  const failedRate = totalMessages > 0 ? ((failedMessages / totalMessages) * 100).toFixed(1) : "0";

  return [
    {
      label: "Total Messages",
      value: totalMessages.toLocaleString(),
      change: `${deliveredMessages} delivered`,
      icon: Send,
      color: "text-sky-500 dark:text-sky-700",
    },
    {
      label: "Success Rate",
      value: `${successRate}%`,
      change: `${failedMessages} failed`,
      icon: CheckCircle2,
      color: "text-green-500 dark:text-green-700",
    },
    {
      label: "Avg Queue Time",
      value: formatDuration(avgQueueTime),
      change: "Time to processing",
      icon: Clock,
      color: "text-amber-500 dark:text-amber-700",
    },
    {
      label: "Failed Messages",
      value: failedMessages.toLocaleString(),
      change: `${failedRate}% of total`,
      icon: XCircle,
      color: "text-red-500 dark:text-red-700",
    },
  ];
}

function buildRecentEvents(data?: DashboardMetricsData): RecentEvent[] {
  return (
    data?.recentMessages.map(event => ({
      id: event.id,
      type: event.eventType || "No event type",
      endpoint: event.destinations.join(", "),
      status: event.status,
      timestamp: event.createdAt,
    })) ?? []
  );
}

export function DashboardOverview({ apiDocsEnabled }: { apiDocsEnabled: boolean }) {
  const [data, setData] = useState<DashboardMetricsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardMetrics() {
      try {
        const nextData = await fetchDashboardMetrics();
        if (isMounted) {
          setData(nextData);
        }
      } catch (nextError) {
        if (isMounted) {
          setError(nextError instanceof Error ? nextError.message : "Failed to fetch dashboard metrics");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadDashboardMetrics();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return <LoadingStateCard title="Loading dashboard..." />;
  }

  if (error) {
    return <ErrorStateCard message={error} />;
  }

  const metrics = buildMetrics(data ?? undefined);
  const recentEvents = buildRecentEvents(data ?? undefined);
  const quickLinks = getQuickLinks(apiDocsEnabled);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Monitor your webhook performance and recent activity</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {metrics.map(metric => (
          <Card key={metric.label} className="border-border p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
                <p className="mt-2 text-3xl font-bold">{metric.value}</p>
                <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  <TrendingUp className="h-3 w-3" />
                  {metric.change}
                </p>
              </div>
              <div className={cn("rounded-sm border border-border p-2", metric.color)}>
                <metric.icon className="h-5 w-5" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="gap-0 border-border lg:col-span-2">
          <div className="border-b border-border px-6 pb-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Recent Events</h2>
              <Link href="/dashboard/log">
                <Button variant="ghost" size="sm" className="gap-2">
                  View all
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
          <div className="divide-y divide-border">
            {recentEvents.map(event => (
              <div key={event.id} className="flex items-center gap-4 py-4 pl-6 pr-10">
                <div
                  className={cn(
                    "h-2 w-2 rounded-full",
                    event.status === "delivered" ? "bg-green-500 dark:bg-green-700" : "bg-red-500 dark:bg-red-700"
                  )}
                />
                <div className="flex-1 space-y-1">
                  <p className="font-mono text-sm font-medium">{event.type}</p>
                  <p className="text-sm text-muted-foreground">{event.endpoint}</p>
                  <p className="text-sm text-muted-foreground">{event.id}</p>
                </div>
                <div className="text-right">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      event.status === "delivered"
                        ? "text-green-600 dark:text-green-700"
                        : "text-red-500 dark:text-red-700"
                    )}
                  >
                    {event.status}
                  </p>
                  <p className="text-sm text-muted-foreground">{event.timestamp}</p>
                </div>
              </div>
            ))}

            {recentEvents.length === 0 && (
              <div className="mt-8 flex items-center justify-center py-4">
                <p className="text-muted-foreground">No recent events</p>
              </div>
            )}
          </div>
        </Card>

        <Card className="border-border">
          <div className="border-b border-border px-6 pb-4">
            <h2 className="text-lg font-semibold">Quick Actions</h2>
          </div>
          <div className="flex flex-col gap-1 space-y-2 px-6">
            {quickLinks.map(link => (
              <Link key={link.label} href={link.href}>
                <Button variant="outline" className="w-full justify-between bg-transparent p-6" size="sm">
                  {link.label}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
