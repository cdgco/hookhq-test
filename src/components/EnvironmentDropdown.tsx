"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Globe, Plus, Check, ChevronDown } from "lucide-react";
import { useState, useEffect } from "react";
import { useEnvironment, Environment } from "@/components/providers/EnvironmentProvider";

interface EnvironmentDropdownProps {
  onEnvironmentChange?: (environment: Environment) => void;
}

export default function EnvironmentDropdown({ onEnvironmentChange }: EnvironmentDropdownProps) {
  const { environments, selectedEnvironment, loading, setSelectedEnvironment, createEnvironment } = useEnvironment();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newEnvName, setNewEnvName] = useState("");
  const [newEnvDescription, setNewEnvDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Notify parent when environment changes
  useEffect(() => {
    if (selectedEnvironment) {
      onEnvironmentChange?.(selectedEnvironment);
    }
  }, [selectedEnvironment, onEnvironmentChange]);

  const handleEnvironmentSelect = async (environment: Environment) => {
    await setSelectedEnvironment(environment);
    setIsPopoverOpen(false);
  };

  const handleCreateEnvironment = async () => {
    if (!newEnvName.trim()) return;

    setIsCreating(true);
    try {
      await createEnvironment(newEnvName.trim(), newEnvDescription.trim() || undefined);

      setNewEnvName("");
      setNewEnvDescription("");
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error("Failed to create environment:", error);
    } finally {
      setIsCreating(false);
    }
  };

  if (loading) {
    return (
      <Button variant="outline" disabled>
        <Globe className="h-4 w-4 mr-2" />
        Loading...
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" className="min-w-[100px] max-w-[300px] justify-between rounded-sm">
            <div className="flex items-center">
              <Globe className="h-4 w-4 mr-2" />
              {selectedEnvironment ? selectedEnvironment.name : "Select Environment"}
            </div>
            <ChevronDown className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 rounded-none">
          <div className="space-y-2">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Select Environment</h4>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {environments.map(env => (
                  <button
                    key={env.id}
                    onClick={() => handleEnvironmentSelect(env)}
                    className="w-full flex items-center justify-between p-3 text-left hover:bg-muted rounded-none transition-colors"
                  >
                    <div>
                      <div className="font-medium text-sm">{env.name}</div>
                      {env.description && <div className="text-xs text-muted-foreground">{env.description}</div>}
                    </div>
                    {selectedEnvironment?.id === env.id && <Check className="h-4 w-4 text-blue-600" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t pt-3">
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full rounded-none">
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Environment
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Environment</DialogTitle>
                    <DialogDescription>
                      Create a new environment for organizing your webhooks and API keys.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="env-name">Environment Name</Label>
                      <Input
                        id="env-name"
                        placeholder="e.g., Production, Staging, Development"
                        value={newEnvName}
                        onChange={e => setNewEnvName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="env-description">Description (Optional)</Label>
                      <Input
                        id="env-description"
                        placeholder="Brief description of this environment"
                        value={newEnvDescription}
                        onChange={e => setNewEnvDescription(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateEnvironment} disabled={!newEnvName.trim() || isCreating}>
                      {isCreating ? "Creating..." : "Create Environment"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
