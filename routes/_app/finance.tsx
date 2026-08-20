import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
import { PageHeader } from "@/components/common/Page";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { RevenuePage } from "./revenue";
import { PayoutsPage } from "./payouts";

// Finance hub — Revenue (incl. commission config) + Payouts. The inner pages have
// no header of their own, so the hub provides the title.
const TABS = ["revenue", "payouts"] as const;
type TabKey = (typeof TABS)[number];

export const Route = createFileRoute("/_app/finance")({
  component: FinanceHub,
  validateSearch: (s: Record<string, unknown>): { tab?: TabKey } => {
    const t = s.tab;
    return { tab: TABS.includes(t as TabKey) ? (t as TabKey) : undefined };
  },
});

function FinanceHub() {
  const { tab } = useSearch({ from: "/_app/finance" });
  const navigate = useNavigate();
  const value: TabKey = tab ?? "revenue";
  return (
    <div className="space-y-4">
      <PageHeader title="Finance" description="Revenue, commission and tailor payouts." />
      <Tabs
        value={value}
        onValueChange={(t) => navigate({ to: "/finance", search: { tab: t as TabKey } })}
      >
        <TabsList>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="payouts">Payouts</TabsTrigger>
        </TabsList>
        <TabsContent value="revenue" className="mt-4">
          <RevenuePage />
        </TabsContent>
        <TabsContent value="payouts" className="mt-4">
          <PayoutsPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
