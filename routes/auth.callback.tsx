import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { auth } from "@/lib/auth";
import { apiClient } from "@/lib/api/client";
import { BrandHero } from "@/components/common/Logo";

export const Route = createFileRoute("/auth/callback")({ component: AuthCallbackPage });

// Landing point for the backend's server-side "Sign in with Google" redirect
// flow (backend/src/routes/oauth.js GET /auth/google/callback) — it finishes
// the exchange with Google server-side, then redirects the browser here with
// only a bare JWT in the URL FRAGMENT (never sent to any server, including
// ours, by design): `#token=...`. This page's whole job is to turn that bare
// token into the same completed-login state login.tsx's own finishLogin()
// reaches after a normal email/password sign-in — there's no user profile in
// the redirect itself, so it fetches one using the token it just stored.
function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function finish() {
      const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
      const params = new URLSearchParams(hash);
      const token = params.get("token");
      const queryError = new URLSearchParams(window.location.search).get("error");

      if (queryError) {
        setError("Google sign-in failed. Please try again or sign in with your password.");
        return;
      }
      if (!token) {
        setError("No sign-in token was received. Please try again.");
        return;
      }

      // Store first so the two authed calls below pick it up via
      // resolveToken() — same storage key finishLogin() uses.
      localStorage.setItem("khyate.token", token);
      try {
        // The identity endpoint is /auth/me — a bare /api/me does not exist
        // (this used to 404 and wipe the token, silently failing every Google
        // sign-in). /rbac/me is additionally staff-gated (403 for customer/
        // tailor/custom roles), so it's a best-effort enrichment, never a
        // reason to fail a sign-in that /auth/me already proved valid.
        const me = await apiClient.get<{ email: string; full_name: string; role: string }>(
          "/auth/me",
        );
        if (cancelled) return;
        let role = me.role;
        let rank = 0;
        try {
          const rbacMe = await apiClient.get<{ role: string; rank: number }>("/rbac/me");
          role = rbacMe.role;
          rank = rbacMe.rank;
        } catch {
          // Non-staff role — the base role from /auth/me is authoritative.
        }
        if (cancelled) return;
        localStorage.setItem(
          "khyate.user",
          JSON.stringify({ full_name: me.full_name, role, rank }),
        );
        auth.completeApiLogin(me.email, {
          full_name: me.full_name,
          role,
          rank,
        });
        navigate({ to: auth.homePath() });
      } catch {
        if (cancelled) return;
        localStorage.removeItem("khyate.token");
        setError("Couldn't complete sign-in. Please try again.");
      }
    }

    finish();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount, reads window.location directly
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white px-6 text-center">
      <BrandHero compact />
      {error ? (
        <>
          <p className="text-sm text-destructive max-w-sm">{error}</p>
          <a href="/login" className="text-sm text-primary hover:text-primary-dark font-medium">
            Back to sign in
          </a>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Signing you in…</p>
      )}
    </div>
  );
}
