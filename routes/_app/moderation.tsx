import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ReviewsPage } from "./reviews";
import { ContentReportsPage } from "./content-reports";
import { FlaggedUploadsPage } from "./flagged-uploads";

// Moderation hub — Reviews + Content Reports + Flagged Uploads in one place
// (the inner pages keep their own headers, so this is just the tab switcher
// above them). Flagged Uploads previously had zero frontend entry point at
// all despite complete backend routes — added as a third tab here.
const TABS = ["reviews", "reports", "flagged"] as const;
type TabKey = (typeof TABS)[number];

export const Route = createFileRoute("/_app/moderation")({
  component: ModerationHub,
  validateSearch: (s: Record<string, unknown>): { tab?: TabKey } => {
    const t = s.tab;
    return { tab: TABS.includes(t as TabKey) ? (t as TabKey) : undefined };
  },
});

function ModerationHub() {
  const { tab } = useSearch({ from: "/_app/moderation" });
  const navigate = useNavigate();
  const value: TabKey = tab ?? "reviews";
  return (
    <Tabs
      value={value}
      onValueChange={(t) => navigate({ to: "/moderation", search: { tab: t as TabKey } })}
    >
      <TabsList>
        <TabsTrigger value="reviews">Reviews</TabsTrigger>
        <TabsTrigger value="reports">Content Reports</TabsTrigger>
        <TabsTrigger value="flagged">Flagged Uploads</TabsTrigger>
      </TabsList>
      <TabsContent value="reviews" className="mt-4">
        <ReviewsPage />
      </TabsContent>
      <TabsContent value="reports" className="mt-4">
        <ContentReportsPage />
      </TabsContent>
      <TabsContent value="flagged" className="mt-4">
        <FlaggedUploadsPage />
      </TabsContent>
    </Tabs>
  );
}
