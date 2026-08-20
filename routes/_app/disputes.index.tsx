import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/common/DataTable";
import { Card, PageHeader } from "@/components/common/Page";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingCards, LoadingRows, NoData } from "@/components/common/AsyncStates";
import { useDisputes, useDisputeAnalytics, type DisputeFilters } from "@/lib/api/queries/disputes";
import { fmtDate, fmtNumber, fmtSlaRemaining } from "@/lib/format";
import type { DisputeRow, DisputeStatus } from "@/lib/api/types";
import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";

export const Route = createFileRoute("/_app/disputes/")({ component: DisputesPage });

// 'resolved' (a formal decision — refund/require-redo/etc, see disputes.js
// POST /:id/resolve) and 'closed' (an administrative close with no refund
// action, POST /:id/close) are two genuinely distinct terminal states —
// missing a "Closed" tab here meant closed disputes were only ever visible
// under "All", reading as if they'd vanished from their own category.
const STATUS_TABS: Array<{ key: DisputeStatus | "all"; label: string }> = [
  { key: "open", label: "Open" },
  { key: "awaiting_tailor_response", label: "Awaiting Response" },
  { key: "under_review", label: "Under Review" },
  { key: "resolved", label: "Resolved" },
  { key: "closed", label: "Closed" },
  { key: "escalated", label: "Escalated" },
  { key: "all", label: "All" },
];

function SlaTimer({
  deadline,
  status,
}: {
  secondsRemaining: number;
  deadline: string;
  status: DisputeStatus;
}) {
  // Once a dispute is closed its SLA clock is no longer a live, unresolved
  // problem — without this, the countdown (deadline vs Date.now(), re-ticked
  // every minute forever) kept growing "BREACHED · Xh Ym ago" indefinitely
  // for closed disputes, since neither the interval nor the calculation ever
  // checked status. Stop ticking and show a frozen label instead.
  const closed = status === "closed";
  const [, setTick] = useState(0);
  useEffect(() => {
    if (closed) return;
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, [closed]);

  if (closed) {
    return <span className="tabular-nums font-medium text-muted-foreground">Closed</span>;
  }

  const liveSeconds = Math.floor((new Date(deadline).getTime() - Date.now()) / 1000);
  const totalWindow = 48 * 3600; // SLA window 48h
  const ratio = liveSeconds / totalWindow;
  const breached = liveSeconds <= 0;
  const color = breached
    ? "text-destructive font-semibold animate-pulse"
    : ratio < 0.25
      ? "text-destructive"
      : ratio < 0.5
        ? "text-warning"
        : "text-success";
  return (
    <span className={`tabular-nums font-medium ${color}`}>{fmtSlaRemaining(liveSeconds)}</span>
  );
}

function DisputesPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<DisputeStatus | "all">("open");

  const filters: DisputeFilters = {
    status: tab,
    page: 1,
    limit: 50,
    sort: "sla_asc",
  };
  const q = useDisputes(filters);
  const analyticsQ = useDisputeAnalytics();

  const rows = q.data?.data ?? [];
  const kpi = q.data?.kpi;

  const columns = useMemo<ColumnDef<DisputeRow>[]>(
    () => [
      {
        accessorKey: "dispute_number",
        header: "Dispute",
        cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
      },
      { accessorKey: "order_number", header: "Order" },
      { accessorKey: "customer_name", header: "Customer" },
      { accessorKey: "tailor_name", header: "Tailor" },
      {
        accessorKey: "dispute_type",
        header: "Type",
        cell: ({ getValue }) => <StatusBadge status={getValue<string>()} />,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => <StatusBadge status={getValue<string>()} />,
      },
      {
        id: "assigned_to",
        header: "Assigned",
        cell: ({ row }) =>
          row.original.assigned_to ? (
            row.original.assigned_to.name
          ) : (
            <span className="text-muted-foreground text-xs">Unassigned</span>
          ),
      },
      {
        id: "sla",
        header: "SLA",
        cell: ({ row }) => (
          <SlaTimer
            secondsRemaining={row.original.time_remaining_seconds}
            deadline={row.original.sla_deadline}
            status={row.original.status}
          />
        ),
      },
      {
        accessorKey: "raised_at",
        header: "Raised",
        cell: ({ getValue }) => fmtDate(getValue<string>()),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dispute Management"
        description={q.data?.total ? `${fmtNumber(q.data.total)} disputes` : undefined}
        actions={
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs text-success">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
              </span>
              <span className="font-medium">Auto-refreshing every 30s</span>
            </span>
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

      {q.isLoading && !q.data ? (
        <LoadingCards count={6} />
      ) : kpi ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard label="Open" value={fmtNumber(kpi.open)} />
          <StatCard label="Awaiting Response" value={fmtNumber(kpi.awaiting_response)} />
          <StatCard label="Under Review" value={fmtNumber(kpi.under_review)} />
          <StatCard label="Resolved Today" value={fmtNumber(kpi.resolved_today)} />
          <StatCard label="Escalated" value={fmtNumber(kpi.escalated)} />
          <StatCard label="SLA Breached" value={fmtNumber(kpi.breached)} />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1 bg-muted/40 p-1 rounded-lg w-fit">
        {STATUS_TABS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setTab(s.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded ${
              tab === s.key ? "bg-card shadow-sm" : "text-muted-foreground"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} title="Couldn't load disputes" />
      ) : q.isLoading && !q.data ? (
        <div className="border rounded-xl p-4 bg-card">
          <LoadingRows rows={6} cols={9} />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <NoData
            icon={IconAlertTriangle}
            title={tab === "all" ? "No disputes recorded" : "No disputes match this filter"}
          />
        </Card>
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          searchPlaceholder="Search by dispute or order number…"
          onRowClick={(d) => navigate({ to: "/disputes/$id", params: { id: d.id } })}
        />
      )}

      <h3 className="text-lg font-semibold mt-2">Dispute Analytics</h3>
      {analyticsQ.isError ? (
        <ErrorState
          error={analyticsQ.error}
          onRetry={() => analyticsQ.refetch()}
          title="Couldn't load analytics"
        />
      ) : analyticsQ.isLoading ? (
        <LoadingCards count={4} />
      ) : analyticsQ.data ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total disputes" value={fmtNumber(analyticsQ.data.total ?? 0)} />
          <StatCard label="Open disputes" value={fmtNumber(analyticsQ.data.open ?? 0)} />
          <StatCard
            label="Avg resolution"
            value={
              analyticsQ.data.avg_resolution_hours
                ? `${analyticsQ.data.avg_resolution_hours}h`
                : "—"
            }
          />
          <StatCard
            label="Escalation rate"
            value={
              analyticsQ.data.escalation_rate_pct ? `${analyticsQ.data.escalation_rate_pct}%` : "—"
            }
          />
        </div>
      ) : null}
    </div>
  );
}
