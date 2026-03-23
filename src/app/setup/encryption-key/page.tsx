"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LoaderCircle, ShieldAlert } from "lucide-react";

export default function MissingEncryptionKeyPage() {
  const router = useRouter();

  useEffect(() => {
    async function checkStatus() {
      try {
        const response = await fetch("/api/setup/status", { cache: "no-store" });
        if (!response.ok) return;

        const data = (await response.json()) as {
          missingDestinationEncryptionKey?: boolean;
        };

        if (!data.missingDestinationEncryptionKey) {
          router.replace("/dashboard");
        }
      } catch {
        // Ignore transient request failures.
      }
    }

    void checkStatus();
  }, [router]);

  return (
    <div className="min-h-screen bg-background">
      <div className="relative flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-2xl border-2 border-border bg-card p-8 shadow-lg">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center border-2 border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Missing Encryption Key</h1>
              <p className="text-muted-foreground">HookHQ cannot safely start without this encryption key</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-lg border bg-muted/30 p-5">
              <div className="mb-3 flex items-center gap-2 font-semibold">
                <KeyRound className="h-4 w-4" />
                Add this binding
              </div>
              <pre className="overflow-x-auto rounded-md border bg-background p-4 text-sm">
                <code>wrangler secret put DESTINATION_ENCRYPTION_KEY</code>
              </pre>
              <p className="mt-3 text-sm text-muted-foreground">
                Use a strong random value. It must remain stable for the lifetime of the deployment because it is used
                to decrypt previously stored secrets.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
