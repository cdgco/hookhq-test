"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { getCurrentEnvironment, updateUserLastEnvironment } from "@/lib/environments";
import { publicApiFetch } from "@/lib/publicApi/utils";

export interface Environment {
  id: string;
  name: string;
  description?: string;
  isDefault: boolean;
  createdAt: string;
}

interface EnvironmentContextType {
  environments: Environment[];
  selectedEnvironment: Environment | null;
  loading: boolean;
  hasEnvironments: boolean;
  environmentError: string | null;
  setSelectedEnvironment: (environment: Environment) => void;
  refreshEnvironments: () => Promise<void>;
  createEnvironment: (name: string, description?: string) => Promise<Environment>;
  validateCurrentEnvironment: () => Promise<boolean>;
}

const EnvironmentContext = createContext<EnvironmentContextType | undefined>(undefined);

interface EnvironmentProviderProps {
  children: ReactNode;
}

export function EnvironmentProvider({ children }: EnvironmentProviderProps) {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [selectedEnvironment, setSelectedEnvironmentState] = useState<Environment | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasEnvironments, setHasEnvironments] = useState(false);
  const [environmentError, setEnvironmentError] = useState<string | null>(null);

  const fetchEnvironments = async () => {
    try {
      setEnvironmentError(null);
      const response = await publicApiFetch("/environments");
      if (!response.ok) {
        throw new Error("Failed to fetch environments");
      }
      const data = (await response.json()) as { environments: Environment[] };
      setEnvironments(data.environments);
      setHasEnvironments(data.environments.length > 0);

      // Set current environment if none selected
      if (!selectedEnvironment && data.environments.length > 0) {
        const currentEnvId = await getCurrentEnvironment();
        let envToSelect: Environment | undefined;

        if (currentEnvId) {
          // Try to find the environment from cookie/database
          envToSelect = data.environments.find((env: Environment) => env.id === currentEnvId);

          // If current environment doesn't exist, show error
          if (!envToSelect) {
            setEnvironmentError(
              `The environment "${currentEnvId}" no longer exists. Please select a different environment.`
            );
          }
        }

        // Fallback to default or first environment
        if (!envToSelect) {
          envToSelect = data.environments.find((env: Environment) => env.isDefault) || data.environments[0];
        }

        if (envToSelect) {
          setSelectedEnvironmentState(envToSelect);
        }
      }
    } catch (error) {
      console.error("Error fetching environments:", error);
      setHasEnvironments(false);
      setEnvironmentError("Failed to load environments. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  const setSelectedEnvironment = async (environment: Environment) => {
    setSelectedEnvironmentState(environment);
    await updateUserLastEnvironment(environment.id);
  };

  const refreshEnvironments = async () => {
    setLoading(true);
    await fetchEnvironments();
  };

  const createEnvironment = async (name: string, description?: string): Promise<Environment> => {
    const response = await publicApiFetch("/environments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: name.trim(),
        description: description?.trim() || undefined,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to create environment");
    }

    const newEnv = (await response.json()) as Environment;

    // Add to environments list
    setEnvironments(prev => [...prev, newEnv]);

    // Clear any environment errors
    setEnvironmentError(null);

    // Set as current environment
    await setSelectedEnvironment(newEnv);

    return newEnv;
  };

  const validateCurrentEnvironment = async (): Promise<boolean> => {
    try {
      const currentEnvId = await getCurrentEnvironment();
      if (!currentEnvId) {
        return false;
      }

      const environment = environments.find(env => env.id === currentEnvId);
      if (!environment) {
        setEnvironmentError(
          `The environment "${currentEnvId}" no longer exists. Please select a different environment.`
        );
        return false;
      }

      setEnvironmentError(null);
      return true;
    } catch (error) {
      console.error("Error validating environment:", error);
      setEnvironmentError("Failed to validate environment.");
      return false;
    }
  };

  useEffect(() => {
    fetchEnvironments();
  }, []);

  const value: EnvironmentContextType = {
    environments,
    selectedEnvironment,
    loading,
    hasEnvironments,
    environmentError,
    setSelectedEnvironment,
    refreshEnvironments,
    createEnvironment,
    validateCurrentEnvironment,
  };

  return <EnvironmentContext.Provider value={value}>{children}</EnvironmentContext.Provider>;
}

export function useEnvironment() {
  const context = useContext(EnvironmentContext);
  if (context === undefined) {
    throw new Error("useEnvironment must be used within an EnvironmentProvider");
  }
  return context;
}
