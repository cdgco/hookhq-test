"use client";

import { Settings, Users, Globe, BarChart3 } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminConfigTab from "@/components/tabs/admin/AdminConfigTab";
import AdminUsersTab from "@/components/tabs/admin/AdminUsersTab";
import AdminEnvironmentsTab from "@/components/tabs/admin/AdminEnvironmentsTab";
import QueueMetricsTab from "@/components/tabs/admin/QueueMetricsTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ServerConfig {
  cloudflareApiKey: string | null;
  cloudflareAccountId: string | null;
  cloudflareQueueId: string | null;
}

interface AdminPageProps {
  params: Promise<{ slug?: string[] }>;
}

export default function AdminPage({ params }: AdminPageProps) {
  const router = useRouter();
  const [serverConfig, setServerConfig] = useState<ServerConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolvedParams, setResolvedParams] = useState<{ slug?: string[] }>({});

  useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const response = await fetch("/api/admin/config");
      if (response.ok) {
        const data = (await response.json()) as { config: ServerConfig };
        setServerConfig(data.config);
      }
    } catch (error) {
      console.error("Error fetching config:", error);
    } finally {
      setLoading(false);
    }
  };

  // Check if Cloudflare config is complete
  const hasCloudflareConfig =
    serverConfig && serverConfig.cloudflareApiKey && serverConfig.cloudflareAccountId && serverConfig.cloudflareQueueId;

  // Determine active tab from URL slug
  const activeTab = resolvedParams.slug?.[0] || "config";

  // Local state for tab management
  const [currentTab, setCurrentTab] = useState(activeTab);

  // Sync local state with URL when params resolve
  useEffect(() => {
    if (resolvedParams.slug) {
      setCurrentTab(resolvedParams.slug[0] || "config");
    }
  }, [resolvedParams.slug]);

  const handleTabChange = (value: string) => {
    // Update local state immediately for instant UI response
    setCurrentTab(value);
    // Update URL without causing a full page reload
    const newUrl = `/dashboard/admin/${value}`;
    window.history.pushState(null, "", newUrl);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Tabs value={currentTab} onValueChange={handleTabChange}>
      <TabsList className="mb-2 rounded-none w-full">
        <TabsTrigger value="config" className="rounded-none dark:data-[state=active]:bg-neutral-700/50">
          <Settings className="h-4 w-4" /> Server Config
        </TabsTrigger>
        {hasCloudflareConfig && (
          <TabsTrigger value="metrics" className="rounded-none dark:data-[state=active]:bg-neutral-700/50">
            <BarChart3 className="h-4 w-4" /> Queue Metrics
          </TabsTrigger>
        )}
        <TabsTrigger value="users" className="rounded-none dark:data-[state=active]:bg-neutral-700/50">
          <Users className="h-4 w-4" /> User Management
        </TabsTrigger>
        <TabsTrigger value="environments" className="rounded-none dark:data-[state=active]:bg-neutral-700/50">
          <Globe className="h-4 w-4" /> Environments
        </TabsTrigger>
      </TabsList>
      <TabsContent value="config">
        <AdminConfigTab onConfigUpdate={fetchConfig} />
      </TabsContent>
      {hasCloudflareConfig && (
        <TabsContent value="metrics">
          <QueueMetricsTab />
        </TabsContent>
      )}
      <TabsContent value="users">
        <AdminUsersTab />
      </TabsContent>
      <TabsContent value="environments">
        <AdminEnvironmentsTab />
      </TabsContent>
    </Tabs>
  );
}
