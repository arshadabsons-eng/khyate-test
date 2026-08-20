import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  IconTruck,
  IconCash,
  IconCheck,
  IconPackage,
  IconFileInvoice,
  IconRefresh,
  IconSettings,
} from "@tabler/icons-react";
import { PageHeader } from "@/components/common/Page";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { DataTable } from "@/components/common/DataTable";
import { Money } from "@/components/common/Money";
import { ErrorState, LoadingCards, LoadingRows } from "@/components/common/AsyncStates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  useDeliveries,
  useAssignDelivery,
  useUpdateDeliveryStatus,
  useSyncDelivery,
  type Delivery,
} from "@/lib/api/queries/deliveries";
import { fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";
import { auth } from "@/lib/auth";

export const Route = createFileRoute("/_app/deliveries")({ component: DeliveriesPage });

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "requested", label: "Requested" },
  { value: "assigned", label: "Assigned" },
  { value: "picked_up", label: "Picked up" },
  { value: "in_transit", label: "In transit" },
  { value: "delivered", label: "Delivered" },
  { value: "failed", label: "Failed" },
];

function DeliveriesPage() {
  const [status, setStatus] = useState("all");
  const q = useDeliveries(status);
  const [assigning, setAssigning] = useState<Delivery | null>(null);
  const canWrite = auth.canWrite();

  const rows = q.data?.data ?? [];
  const kpi = q.data?.kpi;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deliveries"
        description="Assign a driver/courier and track a delivery through to completion. Aramex/Jeebly auto-book once configured — until then, every delivery is tracked and assigned manually here."
        actions={
          <Button variant="outline" asChild>
            <Link to="/deliveries/controls">
              <IconSettings size={15} className="mr-1.5" /> Delivery Settings
            </Link>
          </Button>
        }
      />

      {q.isLoading && !q.data ? (
        <LoadingCards count={4} />
      ) : kpi ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Active" value={kpi.active} icon={IconTruck} />
          <StatCard label="Delivered" value={kpi.delivered} icon={IconCheck} />
          <StatCard label="Revenue" value={kpi.revenue_fils} icon={IconCash} money />
          <StatCard label="Profit" value={kpi.profit_fils} icon={IconPackage} money />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((t) => (
          <Button
            key={t.value}
            size="sm"
            variant={status === t.value ? "default" : "outline"}
            onClick={() => setStatus(t.value)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} title="Couldn't load deliveries" />
      ) : q.isLoading ? (
        <LoadingRows cols={7} rows={6} />
      ) : (
        <DataTable
          rows={rows}
          emptyMessage="No deliveries in this status"
          columns={[
            { header: "Order", accessor: (d) => d.order_number },
            { header: "Customer", accessor: (d) => d.customer_name },
            { header: "Tailor", accessor: (d) => d.tailor_name },
            { header: "Status", accessor: (d) => <StatusBadge status={d.status} /> },
            { header: "Fee", accessor: (d) => <Money fils={d.customer_fee_fils} /> },
            {
              header: "Profit",
              accessor: (d) => (
                <span className={d.profit_fils < 0 ? "text-destructive" : ""}>
                  <Money fils={d.profit_fils} />
                </span>
              ),
            },
            { header: "Requested", accessor: (d) => fmtDate(d.requested_at) },
            {
              header: "",
              accessor: (d) => (
                <div className="flex items-center gap-1.5">
                  {canWrite && d.status === "requested" && (
                    <Button size="sm" variant="outline" onClick={() => setAssigning(d)}>
                      Assign
                    </Button>
                  )}
                  {d.status !== "requested" &&
                    d.status !== "delivered" &&
                    d.status !== "cancelled" && <AdvanceStatus delivery={d} />}
                  {d.partner && d.partner_job_id && <CourierActions delivery={d} />}
                </div>
              ),
            },
          ]}
        />
      )}

      {assigning && <AssignDialog delivery={assigning} onClose={() => setAssigning(null)} />}
    </div>
  );
}

function AdvanceStatus({ delivery }: { delivery: Delivery }) {
  const update = useUpdateDeliveryStatus();
  const next: Record<string, string> = {
    assigned: "picked_up",
    picked_up: "in_transit",
    in_transit: "delivered",
  };
  const nextStatus = next[delivery.status];
  if (!nextStatus || !auth.canWrite()) return null;
  return (
    <Button
      size="sm"
      onClick={() =>
        update.mutate(
          { id: delivery.id, status: nextStatus },
          {
            onSuccess: () => toast.success(`Marked ${nextStatus.replace("_", " ")}`),
            onError: (e: unknown) => toast.error((e as Error)?.message || "Couldn't update"),
          },
        )
      }
      disabled={update.isPending}
    >
      Mark {nextStatus.replace("_", " ")}
    </Button>
  );
}

// Shown only for deliveries booked through a real courier adapter (partner +
// partner_job_id set) — a printable label and an on-demand status refresh
// straight from the courier, independent of their webhook.
function CourierActions({ delivery }: { delivery: Delivery }) {
  const sync = useSyncDelivery();
  const [downloading, setDownloading] = useState(false);

  const printLabel = async () => {
    setDownloading(true);
    try {
      await apiClient.downloadPdf(
        `/deliveries/${delivery.id}/label`,
        `label-${delivery.order_number}.pdf`,
      );
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Couldn't fetch the shipping label");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        title="Print shipping label"
        onClick={printLabel}
        disabled={downloading}
      >
        <IconFileInvoice size={14} />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        title="Refresh status from courier"
        onClick={() =>
          sync.mutate(delivery.id, {
            onSuccess: () => toast.success("Status synced"),
            onError: (e: unknown) => toast.error((e as Error)?.message || "Couldn't sync"),
          })
        }
        disabled={sync.isPending}
      >
        <IconRefresh size={14} />
      </Button>
    </>
  );
}

function AssignDialog({ delivery, onClose }: { delivery: Delivery; onClose: () => void }) {
  const assign = useAssignDelivery();
  const canWrite = auth.canWrite();
  const [courierName, setCourierName] = useState("");
  const [driverCostAed, setDriverCostAed] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");

  const save = () => {
    assign.mutate(
      {
        id: delivery.id,
        courier_name: courierName.trim() || undefined,
        driver_cost_fils: driverCostAed.trim()
          ? Math.round(Number(driverCostAed) * 100)
          : undefined,
        tracking_url: trackingUrl.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success("Delivery assigned");
          onClose();
        },
        onError: (e: unknown) => toast.error((e as Error)?.message || "Couldn't assign"),
      },
    );
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign delivery — {delivery.order_number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Driver / courier name</label>
            <Input
              value={courierName}
              onChange={(e) => setCourierName(e.target.value)}
              placeholder="e.g. Ahmed"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Driver cost (AED)</label>
            <Input
              type="number"
              min={0}
              value={driverCostAed}
              onChange={(e) => setDriverCostAed(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Tracking URL (optional)</label>
            <Input
              value={trackingUrl}
              onChange={(e) => setTrackingUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={save}
            disabled={assign.isPending || !canWrite}
            title={!canWrite ? "You don't have permission to assign deliveries" : undefined}
          >
            {assign.isPending ? "Assigning…" : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
