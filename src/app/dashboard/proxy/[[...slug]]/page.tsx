"use client";

import { Server, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ProxyServersTab from "@/components/tabs/proxy/ProxyServersTab";
import ProxyGroupsTab from "@/components/tabs/proxy/ProxyGroupsTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ProxyPageProps {
  params: Promise<{ slug?: string[] }>;
}

export default function ProxyPage({ params }: ProxyPageProps) {
  const router = useRouter();
  const [resolvedParams, setResolvedParams] = useState<{ slug?: string[] }>({});

  useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  // Determine active tab from URL slug
  const activeTab = resolvedParams.slug?.[0] || "proxy-servers";

  // Local state for tab management
  const [currentTab, setCurrentTab] = useState(activeTab);

  // Sync local state with URL when params resolve
  useEffect(() => {
    if (resolvedParams.slug) {
      setCurrentTab(resolvedParams.slug[0] || "proxy-servers");
    }
  }, [resolvedParams.slug]);

  const handleTabChange = (value: string) => {
    // Update local state immediately for instant UI response
    setCurrentTab(value);
    // Update URL without causing a full page reload
    const newUrl = `/dashboard/proxy/${value}`;
    window.history.pushState(null, "", newUrl);
  };

  return (
    <Tabs value={currentTab} onValueChange={handleTabChange}>
      <TabsList className="mb-2 rounded-none w-full">
        <TabsTrigger value="proxy-servers" className="rounded-none dark:data-[state=active]:bg-neutral-700/50">
          <Server className="h-4 w-4" /> Proxy Servers
        </TabsTrigger>
        <TabsTrigger value="proxy-groups" className="rounded-none dark:data-[state=active]:bg-neutral-700/50">
          <Users className="h-4 w-4" /> Proxy Groups
        </TabsTrigger>
      </TabsList>
      <TabsContent value="proxy-servers">
        <ProxyServersTab />
      </TabsContent>
      <TabsContent value="proxy-groups">
        <ProxyGroupsTab />
      </TabsContent>
    </Tabs>
  );
}
