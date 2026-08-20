import { createFileRoute, redirect } from "@tanstack/react-router";

// The real two-factor step is handled inline on the login screen (POST
// /api/auth/2fa/verify with the server-issued pre_token). This standalone route
// historically accepted ANY 6 digits and minted a session — a security hole — so
// it now just bounces to /login where the verified flow lives.
export const Route = createFileRoute("/verify")({
  beforeLoad: () => {
    throw redirect({ to: "/login" });
  },
});
