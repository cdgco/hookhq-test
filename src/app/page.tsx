"use client";

import authClient from "@/auth/authClient";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { AlertCircle, ArrowLeft, LoaderCircle, Moon, Sun } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { useTheme } from "next-themes";

const MIN_TOTP_SPINNER_MS = 400;

function LoginContent() {
  const { data: session, error: sessionError } = authClient.useSession();
  const [isAuthActionInProgress, setIsAuthActionInProgress] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [lastSubmittedTotpCode, setLastSubmittedTotpCode] = useState("");
  const [isAwaitingTwoFactor, setIsAwaitingTwoFactor] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  // Check if setup is needed
  useEffect(() => {
    const checkSetupStatus = async () => {
      try {
        const response = await fetch("/api/setup/status");
        if (response.ok) {
          const data = (await response.json()) as {
            needsSetup: boolean;
            missingDestinationEncryptionKey?: boolean;
          };
          setNeedsSetup(data.needsSetup);

          if (data.missingDestinationEncryptionKey) {
            router.push("/setup/encryption-key");
          } else if (data.needsSetup) {
            router.push("/setup");
          }
        }
      } catch (error) {
        console.error("Error checking setup status:", error);
      }
    };

    checkSetupStatus();
  }, [router]);

  const handleSignIn = async () => {
    if (isAuthActionInProgress || !email || !password) return;

    setIsAuthActionInProgress(true);
    setError(null);

    try {
      const result = await authClient.signIn.email({
        email,
        password,
      });

      if (result.error) {
        setError(result.error.message ?? "Authentication failed");
      } else if ((result.data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) {
        setIsAwaitingTwoFactor(true);
        setTotpCode("");
        setLastSubmittedTotpCode("");
      } else {
        // Login succeeded - middleware will handle redirect to dashboard
        window.location.reload();
      }
    } catch (e: any) {
      setError(`An unexpected error occurred: ${e.message}`);
    } finally {
      setIsAuthActionInProgress(false);
    }
  };

  const handleVerifyTotp = async (code = totpCode) => {
    if (isAuthActionInProgress || code.length !== 6) return;

    const startedAt = Date.now();
    setIsAuthActionInProgress(true);
    setError(null);
    setLastSubmittedTotpCode(code);

    try {
      const result = await authClient.twoFactor.verifyTotp({
        code,
        trustDevice: false,
      });

      if (result.error) {
        setError(result.error.message ?? "Invalid authentication code");
      } else {
        window.location.reload();
      }
    } catch (e: any) {
      setError(`An unexpected error occurred: ${e.message}`);
    } finally {
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_TOTP_SPINNER_MS) {
        await new Promise(resolve => setTimeout(resolve, MIN_TOTP_SPINNER_MS - elapsed));
      }
      setIsAuthActionInProgress(false);
    }
  };

  useEffect(() => {
    if (!isAwaitingTwoFactor) return;

    if (totpCode.length < 6) {
      setLastSubmittedTotpCode("");
      return;
    }

    if (totpCode === lastSubmittedTotpCode || isAuthActionInProgress) return;

    void handleVerifyTotp(totpCode);
  }, [handleVerifyTotp, isAuthActionInProgress, isAwaitingTwoFactor, lastSubmittedTotpCode, totpCode]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (isAwaitingTwoFactor) {
        void handleVerifyTotp();
      } else {
        handleSignIn();
      }
    }
  };

  if (sessionError) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>Error loading session: {sessionError.message}</p>
      </div>
    );
  }

  // Show loading while checking setup status
  if (needsSetup === null) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 texture-overlay">
      <Button variant="ghost" size="icon" onClick={toggleTheme} className="!absolute top-4 right-4 border-0">
        {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
      </Button>

      <div className="w-full max-w-md">
        <div className="bg-card border border-border p-8">
          <div className="mb-8 flex items-center gap-3">
            {isAwaitingTwoFactor ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="-ml-2"
                onClick={() => {
                  setIsAwaitingTwoFactor(false);
                  setTotpCode("");
                  setLastSubmittedTotpCode("");
                  setError(null);
                }}
                disabled={isAuthActionInProgress}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            ) : null}
            <div className="h-10 w-10 bg-black flex items-center justify-center dark:border-border dark:border">
              <Image src="/logo.svg" alt="HookHQ" width={36} height={36} className="text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-foreground">HookHQ</h1>
              <p className="text-sm text-muted-foreground">Developer Dashboard</p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                {isAwaitingTwoFactor ? "Two-factor verification" : "Sign in"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {isAwaitingTwoFactor
                  ? "Enter the 6-digit code from your authenticator app to finish signing in."
                  : "Enter your credentials to access your dashboard"}
              </p>
            </div>

            {error && (
              <div className="text-red-500 dark:text-red-200 border border-red-200 dark:border-red-600 text-sm text-center py-3 px-4 bg-red-50 dark:bg-red-900 rounded-md flex items-center space-x-2">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}

            <form className="space-y-4" onSubmit={event => event.preventDefault()}>
              {!isAwaitingTwoFactor ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="border-border"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onKeyDown={handleKeyPress}
                      className="border-border"
                      required
                    />
                  </div>

                  <Button
                    onClick={handleSignIn}
                    className="w-full"
                    disabled={isAuthActionInProgress || !email || !password}
                  >
                    {isAuthActionInProgress ? "Signing In..." : "Sign In"}
                  </Button>
                </>
              ) : (
                <>
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-3">
                      <InputOTP
                        id="totpCode"
                        value={totpCode}
                        onChange={value => setTotpCode(value.replace(/\D/g, "").slice(0, 6))}
                        maxLength={6}
                        inputMode="numeric"
                        autoFocus={true}
                        autoComplete="one-time-code"
                        pattern="[0-9]*"
                        containerClassName="justify-center"
                        onKeyDown={handleKeyPress}
                      >
                        <InputOTPGroup>
                          {Array.from({ length: 6 }).map((_, index) => (
                            <InputOTPSlot
                              key={index}
                              index={index}
                              className={`h-12 w-12 text-xl ${
                                error
                                  ? "border-red-500 text-red-600 dark:border-red-500 dark:text-red-300 ring-red-400"
                                  : ""
                              }`}
                            />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>

                      <div className="flex h-12 w-6 items-center justify-center" aria-hidden={!isAuthActionInProgress}>
                        {isAuthActionInProgress ? (
                          <LoaderCircle className="h-4 w-4 animate-spin text-muted-foreground" />
                        ) : null}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </form>
            <br />
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-8">&copy; {new Date().getFullYear()} HookHQ</p>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange={false}
      storageKey="hookhq-theme"
    >
      <LoginContent />
    </ThemeProvider>
  );
}
