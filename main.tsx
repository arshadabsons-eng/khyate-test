import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import * as Sentry from "@sentry/react";
import { getRouter } from "./router";

// No mocks — the app always talks to the real backend API (VITE_API_BASE_URL,
// default "/api"). Set VITE_API_BASE_URL in .env.local to point dev at it.

// Crash/error monitoring — no-op until VITE_SENTRY_DSN is set (Sentry →
// Settings → Client Keys). Error capture only, no performance tracing.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({ dsn: sentryDsn, environment: import.meta.env.MODE, tracesSampleRate: 0 });
}

const rootElement = document.getElementById("app");
if (!rootElement) throw new Error("Failed to find root element");

const router = getRouter();
createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
