import { initAuth } from "@/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AccountForm from "@/components/AccountForm";
import DeleteAccountButton from "@/components/DeleteAccountButton";
import TwoFactorSettings from "@/components/TwoFactorSettings";

export default async function AccountPage() {
  const authInstance = await initAuth();
  // Fetch session using next/headers per better-auth docs for server components
  const session = await authInstance.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/"); // Redirect to home if no session
  }

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">Account Settings</h2>
        <p className="text-muted-foreground mt-1">Manage your account information and security settings.</p>
      </div>

      <AccountForm user={session.user} />
      <TwoFactorSettings
        email={session.user.email}
        initialEnabled={Boolean((session.user as { twoFactorEnabled?: boolean }).twoFactorEnabled)}
      />

      <div className="border-t pt-6">
        <DeleteAccountButton />
      </div>
    </div>
  );
}
