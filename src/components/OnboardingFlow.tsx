"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CheckCircle2, ArrowRight, Server, Globe, AlertCircle, Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEnvironment, EnvironmentProvider } from "@/components/providers/EnvironmentProvider"

function OnboardingPageContent() {
  const router = useRouter()
  const { createEnvironment } = useEnvironment()
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    environmentName: "",
    environmentDescription: "",
  })

  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps = [
    { number: 1, title: "Welcome", icon: Server },
    { number: 2, title: "Environment", icon: Globe },
  ]

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setError(null);
  }

  const handleNext = () => {
    if (currentStep < 2) {
      setCurrentStep(currentStep + 1)
    } else {
      // Complete onboarding and redirect to dashboard
      router.push("/")
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleCreateEnvironment = async (name: string, description?: string): Promise<void> => {
    if (!name.trim()) return;

    setIsCreating(true);
    setError(null);

    try {
      // Use the EnvironmentProvider's createEnvironment method
      await createEnvironment(name, description);
      handleComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create environment");
    } finally {
      setIsCreating(false);
    }
  };

  const handleComplete = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Texture overlay */}
      <div className="fixed inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzAwMDAwMCIgb3BhY2l0eT0iMC4wMyIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40 pointer-events-none" />

      <div className="relative flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          {/* Progress Steps */}
          <div className="mb-12 flex items-center justify-center gap-4">
            {steps.map((step, index) => {
              const Icon = step.icon
              const isActive = currentStep === step.number
              const isCompleted = currentStep > step.number

              return (
                <div key={step.number} className="flex items-center">
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className={`flex h-12 w-12 items-center justify-center border-2 transition-colors ${
                        isCompleted
                          ? "border-primary bg-primary text-primary-foreground"
                          : isActive
                            ? "border-primary bg-background text-primary"
                            : "border-border bg-background text-muted-foreground"
                      }`}
                    >
                      {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        isActive || isCompleted ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {step.title}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`mx-4 h-[2px] w-16 transition-colors ${isCompleted ? "bg-primary" : "bg-border"}`}
                    />
                  )}
                </div>
              )
            })}
          </div>

          {/* Content Card */}
          <div className="border-2 border-border bg-card p-8 shadow-lg">
            {/* Step 1: Welcome */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tight">Welcome to HookHQ</h1>
                  <p className="text-muted-foreground">Let's set up your first environment to get started</p>
                </div>

                <div className="space-y-4 border-l-2 border-primary pl-6">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
                    <div>
                      <h3 className="font-semibold">Environment Organization</h3>
                      <p className="text-sm text-muted-foreground">
                      Environments help you organize your webhooks and API keys.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-primary" />
                    <div>
                      <h3 className="font-semibold">Event Types</h3>
                      <p className="text-sm text-muted-foreground">
                        Event types are scoped to environments and are used by all endpoints in the environment.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button onClick={handleNext} className="gap-2">
                    Get Started
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Environment */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h1 className="text-3xl font-bold tracking-tight">Create Your First Environment</h1>
                  <p className="text-muted-foreground">
                    Environments help you organize webhooks across different stages
                  </p>
                </div>

                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-md flex items-center space-x-2">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <p className="text-sm text-red-800">{error}</p>
                    </div>
                )}

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="environmentName">Environment Name</Label>
                    <Input
                      id="environmentName"
                      type="text"
                      placeholder="Production"
                      value={formData.environmentName}
                      onChange={(e) => handleInputChange("environmentName", e.target.value)}
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">Common names: Production, Staging, Development</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="environmentDescription">Description (Optional)</Label>
                    <Textarea
                      id="environmentDescription"
                      placeholder="Primary production environment for live webhook events"
                      value={formData.environmentDescription}
                      onChange={(e) => handleInputChange("environmentDescription", e.target.value)}
                      className="min-h-[100px] resize-none font-mono"
                    />
                  </div>

                  <div className="border-l-2 border-primary bg-primary/5 p-4">
                    <p className="text-sm text-muted-foreground">
                      <strong className="text-foreground">Tip:</strong> You can create additional environments later
                      from the admin settings. Each environment can have its own endpoints and configurations.
                    </p>
                  </div>
                </div>

                <div className="flex justify-between pt-4">
                  <Button onClick={handleBack} variant="outline">
                    Back
                  </Button>
                  {isCreating ? (
                    <Button disabled>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating Environment...
                    </Button>
                  ) : (
                    <Button onClick={() => handleCreateEnvironment(formData.environmentName, formData.environmentDescription)} disabled={!formData.environmentName} className="gap-2">
                      Create Environment
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              Step {currentStep} of {steps.length}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <EnvironmentProvider>
      <OnboardingPageContent />
    </EnvironmentProvider>
  )
}
