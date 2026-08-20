import { useEffect, useState } from "react";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BrandHero } from "@/components/common/Logo";
import { IconShieldLock } from "@tabler/icons-react";

// Admins must use 2FA. This gate blocks the admin shell until the signed-in
// admin has enrolled an authenticator (TOTP — free, no SMS limits). Customers
// never see this (they don't use the admin shell); it's enforced here for staff.
export function TwoFactorGate({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<"loading" | "ok" | "enroll">("loading");

  useEffect(() => {
    apiClient
      .get<{ enabled: boolean; required?: boolean }>("/auth/2fa/status")
      // Enforce enrollment only when the "require 2FA for all admins" policy is on
      // (Settings → Security) and this admin hasn't enrolled yet.
      .then((d) => setState(d.required && !d.enabled ? "enroll" : "ok"))
      .catch(() => setState("ok")); // demo/offline or no token → don't block
  }, []);

  if (state === "loading") return null;
  if (state === "ok") return <>{children}</>;
  return <Enroll onDone={() => setState("ok")} />;
}

function Enroll({ onDone }: { onDone: () => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string>("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiClient
      .post<{ qr: string; secret: string }>("/auth/2fa/setup")
      .then((d) => {
        setQr(d.qr);
        setSecret(d.secret);
      })
      .catch(() => setErr("Couldn't start setup. Refresh and try again."));
  }, []);

  const enable = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await apiClient.post("/auth/2fa/enable", { code });
      onDone();
    } catch (e: unknown) {
      setErr((e as Error)?.message || "That code is incorrect — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center bg-ivory px-6">
      <div className="w-full max-w-md bg-card border rounded-2xl p-7 shadow-sm">
        <div className="flex flex-col items-center text-center mb-5">
          <BrandHero compact />
          <div className="mt-4 inline-flex items-center gap-2 text-primary font-semibold">
            <IconShieldLock size={20} /> Secure your admin account
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Two-factor authentication is required for staff. Scan this with Google Authenticator (or
            any authenticator app), then enter the 6-digit code.
          </p>
        </div>

        {qr ? (
          <div className="flex flex-col items-center">
            <img src={qr} alt="2FA QR code" className="w-44 h-44 border rounded-lg bg-white p-2" />
            <p className="mt-2 text-[11px] text-muted-foreground break-all">Manual key: {secret}</p>
          </div>
        ) : (
          <div className="h-44 grid place-items-center text-sm text-muted-foreground">
            Preparing…
          </div>
        )}

        <form onSubmit={enable} className="mt-5 space-y-3">
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, ""));
              setErr("");
            }}
            placeholder="123456"
            className="text-center tracking-[0.4em] text-lg"
          />
          {err && <p className="text-sm text-destructive text-center">{err}</p>}
          <Button type="submit" disabled={busy || code.length < 6} className="w-full h-11">
            {busy ? "Verifying…" : "Turn on 2FA & continue"}
          </Button>
        </form>
      </div>
    </div>
  );
}
