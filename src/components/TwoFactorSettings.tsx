"use client";

import authClient from "@/auth/authClient";
import CopyableCode from "@/components/CopyableCode";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, Copy, Download, KeyRound, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

interface TwoFactorSettingsProps {
  email: string;
  initialEnabled?: boolean;
}

const ENROLLMENT_STEPS = [
  "Confirm password",
  "Scan authenticator",
  "Verify code",
  "Save backup codes",
] as const;

function parseTotpUri(totpURI: string) {
  try {
    const url = new URL(totpURI);
    return {
      secret: url.searchParams.get("secret") ?? "",
    };
  } catch {
    return {
      secret: "",
    };
  }
}

export default function TwoFactorSettings({ email, initialEnabled = false }: TwoFactorSettingsProps) {
  const { data: session } = authClient.useSession();
  const isEnabled = (session?.user as { twoFactorEnabled?: boolean } | undefined)?.twoFactorEnabled ?? initialEnabled;
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [password, setPassword] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [totpURI, setTotpURI] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [backupCodesHandled, setBackupCodesHandled] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const [showDisableForm, setShowDisableForm] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const enrollmentDetails = useMemo(() => (totpURI ? parseTotpUri(totpURI) : null), [totpURI]);
  const canDismissEnrollment = step < 4 || backupCodesHandled;

  const resetEnrollment = () => {
    setStep(1);
    setPassword("");
    setTotpURI(null);
    setTotpCode("");
    setBackupCodes([]);
    setBackupCodesHandled(false);
    setMessage(null);
    setIsWorking(false);
  };

  const openEnrollment = () => {
    resetEnrollment();
    setIsDialogOpen(true);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !canDismissEnrollment) return;

    setIsDialogOpen(nextOpen);
    if (!nextOpen) {
      resetEnrollment();
    }
  };

  const finishEnrollment = () => {
    setIsDialogOpen(false);
    resetEnrollment();
    setMessage({ type: "success", text: "Two-factor authentication is enabled and your backup codes have been saved." });
  };

  const handleConfirmPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!password) return;

    setIsWorking(true);
    setMessage(null);

    const result = await authClient.twoFactor.enable({
      password,
      issuer: "HookHQ",
    });

    if (result.error) {
      setMessage({ type: "error", text: result.error.message || "Failed to initialize two-factor setup." });
      setIsWorking(false);
      return;
    }

    setTotpURI(result.data.totpURI);
    setStep(2);
    setIsWorking(false);
  };

  const handleVerifyTotp = async (event: React.FormEvent) => {
    event.preventDefault();
    if (totpCode.length !== 6) return;

    setIsWorking(true);
    setMessage(null);

    const verifyResult = await authClient.twoFactor.verifyTotp({
      code: totpCode,
      trustDevice: false,
    });

    if (verifyResult.error) {
      setMessage({ type: "error", text: verifyResult.error.message || "The verification code is invalid." });
      setIsWorking(false);
      return;
    }

    const backupResult = await authClient.twoFactor.generateBackupCodes({
      password,
    });

    if (backupResult.error) {
      setMessage({
        type: "error",
        text: backupResult.error.message || "Two-factor was enabled, but backup code generation failed. Retry this step.",
      });
      setIsWorking(false);
      return;
    }

    setBackupCodes(backupResult.data.backupCodes);
    setBackupCodesHandled(false);
    setStep(4);
    setMessage(null);
    setIsWorking(false);
  };

  const copyBackupCodes = async () => {
    try {
      await navigator.clipboard.writeText(backupCodes.join("\n"));
      setBackupCodesHandled(true);
      setMessage({ type: "success", text: "Backup codes copied. Store them somewhere safe before closing." });
    } catch {
      setMessage({ type: "error", text: "Failed to copy backup codes to the clipboard." });
    }
  };

  const downloadBackupCodes = () => {
    const content = `HookHQ backup codes for ${email}\n\n${backupCodes.join("\n")}\n`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "hookhq-backup-codes.txt";
    link.click();
    URL.revokeObjectURL(url);
    setBackupCodesHandled(true);
    setMessage({ type: "success", text: "Backup codes downloaded. Keep the file somewhere secure." });
  };

  const handleDisable = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!disablePassword) return;

    setIsDisabling(true);
    setMessage(null);

    const result = await authClient.twoFactor.disable({
      password: disablePassword,
    });

    if (result.error) {
      setMessage({ type: "error", text: result.error.message || "Failed to disable two-factor authentication." });
      setIsDisabling(false);
      return;
    }

    setDisablePassword("");
    setShowDisableForm(false);
    setMessage({ type: "success", text: "Two-factor authentication has been disabled." });
    setIsDisabling(false);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isEnabled ? <ShieldCheck className="h-5 w-5" /> : <ShieldOff className="h-5 w-5" />}
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Protect the <span className="font-medium">{email}</span> account with a time-based one-time password app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {message && !isDialogOpen && (
            <Alert variant={message.type === "error" ? "destructive" : "default"}>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{message.type === "error" ? "Action failed" : "Security updated"}</AlertTitle>
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}

          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-medium">{isEnabled ? "2FA is active" : "2FA is not enabled"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {isEnabled
                ? "A TOTP code is required after your password whenever you sign in."
                : "Use an authenticator app to add a second factor to your login."}
            </p>
          </div>

          {!isEnabled ? (
            <Button onClick={openEnrollment}>Set up 2FA</Button>
          ) : !showDisableForm ? (
            <Button variant="outline" onClick={() => setShowDisableForm(true)}>
              Disable 2FA
            </Button>
          ) : (
            <form onSubmit={handleDisable} className="space-y-4 rounded-lg border p-4">
              <div className="space-y-2">
                <Label htmlFor="disable-two-factor-password">Confirm your password to disable 2FA</Label>
                <Input
                  id="disable-two-factor-password"
                  type="password"
                  value={disablePassword}
                  onChange={event => setDisablePassword(event.target.value)}
                  placeholder="Enter your current password"
                  required
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" variant="destructive" disabled={isDisabling || !disablePassword}>
                  {isDisabling ? "Disabling..." : "Disable 2FA"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowDisableForm(false);
                    setDisablePassword("");
                    setMessage(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent
          className="max-w-2xl gap-6"
          showCloseButton={canDismissEnrollment}
          onEscapeKeyDown={event => {
            if (!canDismissEnrollment) event.preventDefault();
          }}
          onInteractOutside={event => {
            if (!canDismissEnrollment) event.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>Set up two-factor authentication</DialogTitle>
            <DialogDescription>
              Confirm your password, scan the QR code, verify your first code, then store your recovery codes.
            </DialogDescription>
          </DialogHeader>

          {message && (
            <Alert variant={message.type === "error" ? "destructive" : "default"}>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{message.type === "error" ? "Action failed" : "Ready to continue"}</AlertTitle>
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            {ENROLLMENT_STEPS.map((label, index) => {
              const stepNumber = (index + 1) as 1 | 2 | 3 | 4;
              const isActive = step === stepNumber;
              const isComplete = step > stepNumber;

              return (
                <div key={label} className="flex min-w-fit items-center gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-medium ${
                        isActive || isComplete
                          ? "border-foreground bg-foreground text-background dark:border-foreground dark:bg-foreground dark:text-background"
                          : "border-border bg-background text-muted-foreground"
                      }`}
                    >
                      {stepNumber}
                    </div>
                    <span
                      className={`text-sm whitespace-nowrap ${
                        isActive || isComplete ? "text-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                  {index < ENROLLMENT_STEPS.length - 1 ? (
                    <div
                      className={`h-px w-12 sm:w-20 ${
                        isComplete ? "bg-foreground/70" : "bg-border"
                      }`}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>

          {step === 1 && (
            <form onSubmit={handleConfirmPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="two-factor-password">Current password</Label>
                <Input
                  id="two-factor-password"
                  type="password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  required
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={isWorking}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isWorking || !password}>
                  {isWorking ? "Checking..." : "Continue"}
                </Button>
              </DialogFooter>
            </form>
          )}

          {step === 2 && totpURI && enrollmentDetails && (
            <div className="space-y-6">
              <div className="flex flex-col items-center gap-5 rounded-2xl border bg-muted/10 p-6">
                <div className="flex flex-col items-center justify-center">
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <QRCodeSVG value={totpURI} size={192} includeMargin />
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Smartphone className="h-4 w-4" />
                    Scan with your authenticator app
                  </div>
                </div>

                <div className="w-full max-w-sm space-y-3 text-center">
                  <div>
                    <h3 className="font-medium">Manual setup secret</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      If scanning is not available, enter this secret manually in your authenticator app.
                    </p>
                  </div>

                  <CopyableCode
                    copyText={enrollmentDetails.secret}
                    className="rounded-xl border bg-background px-4 py-4 font-mono text-sm break-all"
                  >
                    {enrollmentDetails.secret || "Secret unavailable"}
                  </CopyableCode>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setStep(1)} disabled={isWorking}>
                  Back
                </Button>
                <Button type="button" onClick={() => setStep(3)} disabled={!enrollmentDetails.secret}>
                  I’ve added it
                </Button>
              </DialogFooter>
            </div>
          )}

          {step === 3 && (
            <form onSubmit={handleVerifyTotp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="two-factor-code">Enter the 6-digit code from your authenticator app</Label>
                <InputOTP
                  id="two-factor-code"
                  value={totpCode}
                  onChange={value => setTotpCode(value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  containerClassName="justify-center"
                >
                  <InputOTPGroup>
                    {Array.from({ length: 6 }).map((_, index) => (
                      <InputOTPSlot key={index} index={index} className="h-11 w-11 text-base" />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setStep(2)} disabled={isWorking}>
                  Back
                </Button>
                <Button type="submit" disabled={isWorking || totpCode.length !== 6}>
                  {isWorking ? "Verifying..." : "Enable 2FA"}
                </Button>
              </DialogFooter>
            </form>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>2FA is now enabled</AlertTitle>
                <AlertDescription>
                  Save these backup codes now. You will not be able to dismiss this setup until you copy or download
                  them.
                </AlertDescription>
              </Alert>

              <div className="rounded-xl border p-4">
                <div className="mb-3 flex items-center gap-2">
                  <KeyRound className="h-4 w-4" />
                  <h3 className="font-medium">Backup codes</h3>
                </div>
                <CopyableCode
                  copyText={backupCodes.join("\n")}
                  className="grid gap-2 rounded-lg border bg-background p-4 font-mono text-sm sm:grid-cols-2"
                >
                  {backupCodes.map(code => (
                    <div key={code}>{code}</div>
                  ))}
                </CopyableCode>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button type="button" className="flex-1" onClick={copyBackupCodes}>
                  <Copy className="h-4 w-4" />
                  Copy codes
                </Button>
                <Button type="button" variant="outline" className="flex-1" onClick={downloadBackupCodes}>
                  <Download className="h-4 w-4" />
                  Download codes
                </Button>
              </div>

              <DialogFooter>
                <Button type="button" onClick={finishEnrollment} disabled={!backupCodesHandled}>
                  Finish
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
