"use client";

import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

function NotFoundContent() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background">
      {/* Texture overlay */}
      <div className="fixed inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0iIzAwMDAwMCIgb3BhY2l0eT0iMC4wMyIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40 pointer-events-none" />

      <div className="relative flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          {/* Content Card */}
          <div className="border-2 border-border bg-card p-8 shadow-lg">
            <div className="space-y-6">
              <div className="space-y-2 text-center">
                <div className="text-6xl font-bold text-muted-foreground">404</div>
                <h1 className="text-3xl font-bold tracking-tight">Page Not Found</h1>
                <p className="text-muted-foreground">The page you're looking for doesn't exist or has been moved.</p>
              </div>

              <div className="space-y-4 border-l-2 border-primary pl-6">
                <div className="flex items-start gap-3">
                  <Search className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <h3 className="font-semibold">Check the URL</h3>
                    <p className="text-sm text-muted-foreground">
                      Make sure you've typed the URL correctly. URLs are case-sensitive.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <ArrowLeft className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <h3 className="font-semibold">Go Back</h3>
                    <p className="text-sm text-muted-foreground">
                      Use your browser's back button or the button below to return to the previous page.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Home className="mt-0.5 h-5 w-5 text-primary" />
                  <div>
                    <h3 className="font-semibold">Start Fresh</h3>
                    <p className="text-sm text-muted-foreground">
                      Return to the dashboard to continue managing your webhooks and environments.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-center gap-4 pt-4">
                <Button onClick={() => router.back()} variant="outline" className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Go Back
                </Button>
                <Button asChild className="gap-2">
                  <Link href="/dashboard">
                    <Home className="h-4 w-4" />
                    Dashboard
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NotFound() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange={false}
      storageKey="hookhq-theme"
    >
      <NotFoundContent />
    </ThemeProvider>
  );
}
