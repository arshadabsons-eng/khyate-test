import { MutationCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { routeTree } from "./routeTree.gen";
import { ApiError } from "./lib/api/client";

export const getRouter = () => {
  const queryClient = new QueryClient({
    // Global safety net for mutation failures.
    //
    // Individual mutations are free to pass their own onError (and many do,
    // with a message specific to the action). This catches every one that
    // does NOT — previously those failed completely silently: the button
    // stopped spinning and nothing else happened, so a rejected save looked
    // exactly like a successful one. That is especially dangerous on the
    // Settings page, where an admin would believe commission rates or payout
    // rules had been saved when the request had actually 422'd.
    //
    // Deliberately global rather than per-call so mutations added later are
    // covered by default instead of having to remember.
    mutationCache: new MutationCache({
      onError: (error, _vars, _ctx, mutation) => {
        // Respect a mutation's own handler — if it has one, it already told
        // the user something more specific and we must not double-toast.
        if (mutation.options.onError) return;
        // 401 already triggers a forced sign-out in the api client; a second
        // toast on the way out is just noise.
        if (error instanceof ApiError && error.status === 401) return;
        const message =
          error instanceof ApiError && error.message
            ? error.message
            : "Something went wrong. Please try again.";
        toast.error(message);
      },
    }),
    defaultOptions: {
      queries: {
        // Never retry auth failures — the client already logs the user out on 401.
        retry: (failureCount, error) => {
          if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
            return false;
          }
          return failureCount < 2;
        },
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
