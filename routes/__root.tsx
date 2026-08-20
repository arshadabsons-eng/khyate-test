import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useMatches,
} from "@tanstack/react-router";
import { MaintenanceBanner } from "@/components/common/MaintenanceBanner";
import { Toaster } from "@/components/ui/sonner";

import "../styles.css";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  // The admin (`/_app`) and tailor (`/tailor`) layouts already render their own
  // MaintenanceBanner inside their PageContainer — skip it here for those so a
  // logged-in session never sees it twice. Every other route (the public site:
  // landing, storefront, listing, signup, login, etc.) has no shared layout of
  // its own, so this is the only place it can be shown at all.
  const matches = useMatches();
  const hasOwnBanner = matches.some((m) => m.routeId === "/_app" || m.routeId === "/tailor");

  return (
    <QueryClientProvider client={queryClient}>
      {!hasOwnBanner && (
        <div className="px-4 sm:px-6 lg:px-8 xl:px-10 pt-3">
          <MaintenanceBanner />
        </div>
      )}
      <Outlet />
      {/* 44 files across the admin and tailor surfaces call toast() — but
          sonner only paints through a mounted <Toaster />, and nothing in the
          app ever mounted one (components/ui/sonner.tsx defined it and was
          then tree-shaken out of the build entirely, since nothing imported
          it). Every success and every error toast in the whole app was a
          silent no-op: a failed mutation left its dialog sitting open with no
          message at all, which reads as "the button does nothing". Most
          visibly, a rejected Add Admin (duplicate email, invalid role,
          network error) gave the operator zero feedback. */}
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
