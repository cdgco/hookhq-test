"use client";

import { useEnvironment } from "@/components/providers/EnvironmentProvider";
import OnboardingFlow from "./OnboardingFlow";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface EnvironmentGateProps {
  children: React.ReactNode;
}

export default function EnvironmentGate({ children }: EnvironmentGateProps) {
  const { loading, hasEnvironments, environmentError, environments, setSelectedEnvironment } = useEnvironment();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!hasEnvironments) {
    return <OnboardingFlow />;
  }

  // Show environment error if current environment doesn't exist
  if (environmentError) {
    const handleEnvironmentChange = async (environmentId: string) => {
      const selectedEnv = environments.find(env => env.id === environmentId);
      if (selectedEnv) {
        await setSelectedEnvironment(selectedEnv);
        // Refresh the page to reload with the new environment
        window.location.reload();
      }
    };

    return (
      <div className="min-h-screen bg-background">
        {/* Texture overlay */}
        <div className="fixed inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzAwMDAwMCIgb3BhY2l0eT0iMC4wMyIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40 pointer-events-none" />

        <div className="relative flex min-h-screen items-center justify-center p-4">
          <div className="w-full max-w-2xl">
            {/* Content Card */}
            <div className="border-2 border-border bg-card p-8 shadow-lg">
              <div className="space-y-6">
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tight">Environment Not Found</h1>
                  <p className="text-muted-foreground">{environmentError}</p>
                </div>

                {environments.length > 0 && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="environmentName">Select an environment:</Label>
                      <Select onValueChange={handleEnvironmentChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choose an environment..." />
                        </SelectTrigger>
                        <SelectContent>
                          {environments.map(env => (
                            <SelectItem key={env.id} value={env.id}>
                              {env.name}
                              {env.isDefault && " (Default)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={() => window.location.reload()}>
                    Refresh Page
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
