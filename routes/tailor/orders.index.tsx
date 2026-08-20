import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { DataTable } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ErrorState, LoadingRows } from "@/components/common/AsyncStates";
import { useTailorOrders } from "@/lib/api/queries/tailor";
import { filsToAed, fmtDate } from "@/lib/format";
import { labelize } from "@/components/inventory/options";

export const Route = createFileRoute("/tailor/orders/")({ component: TailorOrders });

const TABS = [
  "all",
  "pending",
  "confirmed",
  "in_progress",
  "ready",
  "shipped",
  "delivered",
  "completed",
  "cancelled",
  "disputed",
] as const;

function TailorOrders() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("all");
  const navigate = useNavigate();
  const q = useTailorOrders(tab === "all" ? undefined : tab);
  const kpi = q.data?.kpi_by_status ?? {};

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto border-b">
        {TABS.map((t) => {
          const active = tab === t;
          const count = t === "all" ? Object.values(kpi).reduce((a, b) => a + b, 0) : (kpi[t] ?? 0);
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap ${active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {t === "all" ? "All" : labelize(t)}{" "}
              <span className="text-xs opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} title="Couldn't load orders" />
      ) : q.isLoading && !q.data ? (
        <LoadingRows cols={6} rows={8} />
      ) : (
        <DataTable
          rows={q.data?.data ?? []}
          onRowClick={(o) => navigate({ to: "/tailor/orders/$id", params: { id: o.id } })}
          emptyMessage="No orders in this view"
          columns={[
            {
              header: "Order",
              accessor: (o) => <span className="font-medium">{o.order_number}</span>,
            },
            { header: "Customer", accessor: (o) => o.customer_name },
            { header: "Type", accessor: (o) => labelize(o.order_type) },
            { header: "Total", accessor: (o) => filsToAed(o.total_fils) },
            { header: "Status", accessor: (o) => <StatusBadge status={o.status} /> },
            { header: "Placed", accessor: (o) => fmtDate(o.created_at) },
          ]}
        />
      )}
    </div>
  );
}
