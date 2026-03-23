"use client";

import { Globe, Users, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import EndpointGroupsTab from "@/components/tabs/endpoints/EndpointGroupsTab";
import EndpointsTab from "@/components/tabs/endpoints/EndpointsTab";
import EventTypesTab from "@/components/tabs/endpoints/EventTypesTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface EndpointsPageProps {
  params: Promise<{ slug?: string[] }>;
}

export default function EndpointsPage({ params }: EndpointsPageProps) {
  const [resolvedParams, setResolvedParams] = useState<{ slug?: string[] }>({});

  useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  const activeTab = resolvedParams.slug?.[0] || "endpoints";
  const [currentTab, setCurrentTab] = useState(activeTab);

  useEffect(() => {
    if (resolvedParams.slug) {
      setCurrentTab(resolvedParams.slug[0] || "endpoints");
    }
  }, [resolvedParams.slug]);

  const handleTabChange = (value: string) => {
    setCurrentTab(value);
    window.history.pushState(null, "", `/dashboard/endpoints/${value}`);
  };

  return (
    <Tabs value={currentTab} onValueChange={handleTabChange}>
      <TabsList className="mb-2 w-full rounded-none">
        <TabsTrigger value="endpoints" className="rounded-none dark:data-[state=active]:bg-neutral-700/50">
          <Globe className="h-4 w-4" /> Endpoints
        </TabsTrigger>
        <TabsTrigger value="endpoint-groups" className="rounded-none dark:data-[state=active]:bg-neutral-700/50">
          <Users className="h-4 w-4" /> Endpoint Groups
        </TabsTrigger>
        <TabsTrigger value="event-types" className="rounded-none dark:data-[state=active]:bg-neutral-700/50">
          <Zap className="h-4 w-4" /> Event Types
        </TabsTrigger>
      </TabsList>

      <TabsContent value="endpoints">
        <EndpointsTab />
      </TabsContent>
      <TabsContent value="endpoint-groups">
        <EndpointGroupsTab />
      </TabsContent>
      <TabsContent value="event-types">
        <EventTypesTab />
      </TabsContent>
    </Tabs>
  );
}
