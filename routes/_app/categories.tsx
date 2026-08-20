import { createFileRoute, redirect } from "@tanstack/react-router";

// The Categories page is rendered as a tab inside /inventory — this route only
// exists so old bookmarks/links keep working. Redirect before anything mounts.
export const Route = createFileRoute("/_app/categories")({
  beforeLoad: () => {
    throw redirect({ to: "/inventory", search: { tab: "categories" } });
  },
});
