import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/common/DataTable";
import { PageHeader } from "@/components/common/Page";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingRows, NoData } from "@/components/common/AsyncStates";
import { useOrders, type OrderFilters } from "@/lib/api/queries/orders";
import { fmtDate, fmtNumber } from "@/lib/format";
import { Money } from "@/components/common/Money";
import type { OrderRow, OrderStatus } from "@/lib/api/types";
import { IconRefresh, IconShoppingBag } from "@tabler/icons-react";

export const Route = createFileRoute("/_app/orders/")({ component: OrdersPage });

const STATUS_TABS: Array<{ key: OrderStatus | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "confirmed", label: "Confirmed" },
  { key: "in_progress", label: "In Progress" },
  { key: "ready", label: "Ready" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "disputed", label: "Disputed" },
];

function OrdersPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<OrderStatus | "all">("all");

  const filters: OrderFilters = {
    status: tab === "all" ? undefined : tab,
    page: 1,
    limit: 25,
    sort: "newest",
  };
  const q = useOrders(filters);

  const rows = q.data?.data ?? [];
  const kpi = q.data?.kpi_by_status;

  const columns = useMemo<ColumnDef<OrderRow>[]>(
    () => [
      {
        accessorKey: "order_number",
        header: "Order",
        cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
      },
      { accessorKey: "customer_name", header: "Customer" },
      { accessorKey: "tailor_name", header: "Tailor" },
      {
        accessorKey: "order_type",
        header: "Type",
        cell: ({ getValue }) => <StatusBadge status={getValue<string>()} />,
      },
      {
        accessorKey: "total_fils",
        header: "Total",
        cell: ({ getValue }) => (
          <span className="tabular-nums font-medium">
            <Money fils={getValue<number>()} />
          </span>
        ),
      },
      // No Commission column here: commission only lives in earnings_ledger, not on
      // orders — the list query (backend/src/routes/orders.js) never joins/returns
      // commission_fils, and a per-row join isn't worth the query cost for this list view.
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => <StatusBadge status={getValue<string>()} />,
      },
      {
        accessorKey: "payment_status",
        header: "Payment",
        cell: ({ getValue }) => <StatusBadge status={getValue<string>()} />,
      },
      {
        accessorKey: "created_at",
        header: "Created",
        cell: ({ getValue }) => fmtDate(getValue<string>()),
      },
    ],
    [],
  );

  const isAutoRefreshing = tab === "pending" || tab === "in_progress";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Order Management"
        description={q.data?.total ? `${fmtNumber(q.data.total)} orders` : undefined}
        actions={
          <div className="flex items-center gap-2">
            {isAutoRefreshing && (
              <span className="flex items-center gap-1.5 text-xs text-success">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                </span>
                <span className="font-medium">Auto-refreshing every 60s</span>
              </span>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => q.refetch()}
              disabled={q.isFetching}
            >
              <IconRefresh size={14} className={`mr-1.5 ${q.isFetching ? "animate-spin" : ""}`} />{" "}
              Refresh
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-1 bg-muted/40 p-1 rounded-lg w-fit">
        {STATUS_TABS.map((s) => {
          const count =
            s.key === "all"
              ? Object.values(kpi ?? {}).reduce((sum, v) => sum + (v ?? 0), 0)
              : kpi?.[s.key as OrderStatus];
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setTab(s.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded inline-flex items-center gap-1.5 ${
                tab === s.key ? "bg-card shadow-sm" : "text-muted-foreground"
              }`}
            >
              {s.label}
              {count != null && count > 0 && (
                <span className="text-[10px] tabular-nums text-muted-foreground">{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} title="Couldn't load orders" />
      ) : q.isLoading && !q.data ? (
        <div className="border rounded-xl p-4 bg-card">
          <LoadingRows rows={6} cols={8} />
        </div>
      ) : rows.length === 0 ? (
        <div className="border rounded-xl bg-card">
          <NoData
            icon={IconShoppingBag}
            title={tab === "all" ? "No orders yet" : `No ${tab.replace("_", " ")} orders`}
          />
        </div>
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          searchPlaceholder="Search by order number, customer, tailor…"
          onRowClick={(o) => navigate({ to: "/orders/$id", params: { id: o.id } })}
        />
      )}
    </div>
  );
}
