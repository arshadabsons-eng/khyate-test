import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader, Card } from "@/components/common/Page";
import { DataTable } from "@/components/common/DataTable";
import { ErrorState, LoadingRows, CenteredSpinner } from "@/components/common/AsyncStates";
import { LiquidTabs } from "@/components/common/LiquidTabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useDeliverySettings,
  useSetActivePartner,
  useSetZonePartner,
  useDeliveryActivity,
} from "@/lib/api/queries/delivery-controls";
import { relTime } from "@/lib/format";
import { auth } from "@/lib/auth";
import { toast } from "sonner";
import { IconArrowLeft } from "@tabler/icons-react";

export const Route = createFileRoute("/_app/deliveries/controls")({
  component: DeliveryControlsPage,
});

const TABS = [
  { id: "courier", label: "Courier" },
  { id: "activity", label: "Activity" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const PARTNER_LABEL: Record<string, string> = {
  jeebly: "Jeebly",
  aramex: "Aramex",
  manual: "Manual",
};

// UAE emirates this platform operates in — matches the backend's EMIRATES
// list in backend/src/lib/delivery/zones.js exactly (Jeebly's API is
// case-sensitive about these strings).
const EMIRATES = [
  "Abu Dhabi",
  "Ajman",
  "Al-Ain",
  "Dubai",
  "Fujairah",
  "Ras Al Khaimah",
  "Sharjah",
  "Umm Al-Quwain",
];

function DeliveryControlsPage() {
  const [tab, setTab] = useState<TabId>("courier");
  return (
    <div>
      <Link
        to="/deliveries"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-3"
      >
        <IconArrowLeft size={15} /> Back to deliveries
      </Link>
      <PageHeader
        title="Delivery Settings"
        description="Choose which courier handles delivery, globally and per emirate."
      />
      <LiquidTabs tabs={TABS} value={tab} onChange={(id) => setTab(id as TabId)} className="mb-6" />
      {tab === "courier" && <CourierTab />}
      {tab === "activity" && <ActivityTab />}
    </div>
  );
}

function CourierTab() {
  const q = useDeliverySettings();
  const setActive = useSetActivePartner();
  const setZone = useSetZonePartner();
  const canWrite = auth.canWrite();

  if (q.isLoading) return <CenteredSpinner />;
  if (q.isError || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const s = q.data;

  const connected = (p: string) =>
    p === "jeebly" ? s.jeebly_connected : p === "aramex" ? s.aramex_connected : true;

  return (
    <div className="space-y-6">
      <Card title="Global default">
        <div className="flex items-center gap-3">
          <Select
            value={s.delivery_active_partner}
            disabled={!canWrite}
            onValueChange={(v) =>
              setActive.mutate(v, {
                onSuccess: () => toast.success("Active courier updated"),
                onError: (e: unknown) => toast.error((e as Error)?.message || "Couldn't update"),
              })
            }
          >
            <SelectTrigger
              className="w-48"
              title={
                !canWrite ? "You don't have permission to change the active courier" : undefined
              }
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["jeebly", "aramex", "manual"] as const).map((p) => (
                <SelectItem key={p} value={p}>
                  {PARTNER_LABEL[p]} {p !== "manual" && !connected(p) ? "(not configured)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">
            Jeebly: {s.jeebly_connected ? "configured" : "not configured"} · Aramex:{" "}
            {s.aramex_connected ? "configured" : "not configured"}
          </span>
        </div>
      </Card>

      <Card title="Per-emirate overrides">
        <div className="space-y-3">
          {s.zones.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No emirate has an override yet — every zone currently inherits the global default
              above.
            </p>
          )}
          {EMIRATES.map((emirate) => {
            const existing = s.zones.find((z) => z.emirate === emirate);
            return (
              <div
                key={emirate}
                className="flex items-center justify-between gap-3 py-1.5 border-b last:border-b-0"
              >
                <span className="text-sm font-medium">{emirate}</span>
                <Select
                  value={existing?.partner ?? "none"}
                  disabled={!canWrite}
                  onValueChange={(v) =>
                    setZone.mutate(
                      { emirate, partner: v },
                      {
                        onSuccess: () => toast.success(`${emirate} updated`),
                        onError: (e: unknown) =>
                          toast.error((e as Error)?.message || "Couldn't update"),
                      },
                    )
                  }
                >
                  <SelectTrigger
                    className="w-56"
                    title={
                      !canWrite
                        ? `You don't have permission to change the courier for ${emirate}`
                        : undefined
                    }
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Non-interactive: the backend has no "clear override" endpoint,
                        so this can only ever be shown, never chosen — it's disabled
                        the same way Radix/shadcn disables any other SelectItem. */}
                    <SelectItem value="none" disabled>
                      Inherits global
                    </SelectItem>
                    {(["jeebly", "aramex", "manual"] as const).map((p) => (
                      <SelectItem key={p} value={p}>
                        {PARTNER_LABEL[p]}{" "}
                        {p !== "manual" && !connected(p) ? "(not configured)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function ActivityTab() {
  const [page, setPage] = useState(1);
  const q = useDeliveryActivity(page);
  if (q.isLoading) return <LoadingRows cols={4} rows={8} />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  return (
    <DataTable
      rows={q.data?.data ?? []}
      emptyMessage="No delivery activity yet"
      columns={[
        { header: "Time", accessor: (r) => relTime(r.created_at) },
        { header: "Action", accessor: (r) => r.action },
        { header: "Summary", accessor: (r) => r.summary },
        { header: "Actor", accessor: (r) => r.actor_name ?? "System" },
      ]}
      pagination={{
        page: q.data?.page ?? 1,
        totalPages: q.data?.total_pages ?? 1,
        onPageChange: setPage,
      }}
    />
  );
}
