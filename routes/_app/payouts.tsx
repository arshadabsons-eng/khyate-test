import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import {
  IconWallet,
  IconAlertTriangle,
  IconRefresh,
  IconPlayerPlay,
  IconClock,
  IconCheck,
  IconX,
  IconEdit,
  IconCopy,
  IconBan,
} from "@tabler/icons-react";
import {
  usePayouts,
  usePayoutSchedule,
  useProcessPayouts,
  useProcessSinglePayout,
  useRetryPayout,
  useRejectPayout,
  useUpdatePayoutSchedule,
} from "@/lib/api/queries/payouts";
import { StatCard } from "@/components/common/StatCard";
import { DataTable } from "@/components/common/DataTable";
import { Card } from "@/components/common/Page";
import { StatusBadge } from "@/components/common/StatusBadge";
import {
  ErrorState,
  LoadingCards,
  LoadingRows,
  CenteredSpinner,
} from "@/components/common/AsyncStates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { filsToAed, fmtDate, fmtDateTime } from "@/lib/format";
import { useRbacMe } from "@/lib/api/queries/rbac";
import type { PayoutTab, PayoutFilters } from "@/lib/api/queries/payouts";
import type { PayoutSchedule } from "@/lib/api/types";

export const Route = createFileRoute("/_app/payouts")({ component: PayoutsPage });

const TABS: { id: PayoutTab; label: string }[] = [
  { id: "queue", label: "Queue" },
  { id: "failed", label: "Failed" },
  { id: "history", label: "History" },
];

// Every mutation on this page used to omit onError entirely — a rejected
// double-submit ("not awaiting processing"), a rejected retry ("only a
// rejected payout can be retried"), or any other failure just re-enabled
// the button with zero indication anything went wrong. Same helper shape as
// disputes.$id.tsx, which already gets this right.
const mutationErrorToast = (fallback: string) => (e: unknown) =>
  toast.error((e as Error)?.message || fallback);

function copyIban(iban: string) {
  navigator.clipboard.writeText(iban).then(
    () => toast.success("IBAN copied"),
    () => toast.error("Couldn't copy — select and copy manually"),
  );
}

export function PayoutsPage() {
  const [activeTab, setActiveTab] = useState<PayoutTab>("queue");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  // Was gated on the literal "Super Admin" role string, but the backend's
  // FINANCE_EDIT permission (schedule PUT) also allows Operations Admin —
  // an Operations Admin the backend would authorize never saw this editor.
  // Then was gated on a generic rank check (auth.canWrite()), which can
  // diverge from the backend's actual matrix-driven finance:edit permission
  // (PUT /payouts/schedule is rbac.requirePermission('finance', 'edit'),
  // fully matrix-governed and decoupled from rank) — a custom role granted
  // finance:edit below the rank floor never saw the editor, while a
  // rank-qualifying role with finance:edit revoked saw it and got a 403 on
  // Save. Read the same per-module permission the backend actually checks.
  const rbacMe = useRbacMe();
  const financeLevel = rbacMe.data?.permissions.finance;
  const canEditSchedule = financeLevel === "edit" || financeLevel === "admin";

  const filters: PayoutFilters = { tab: activeTab, search: search || undefined, page, limit: 25 };
  const { data, isLoading, isFetching, isError, error, refetch } = usePayouts(filters);
  const scheduleQ = usePayoutSchedule();
  const processAll = useProcessPayouts();

  const kpi = data?.kpi;

  return (
    <div className="space-y-6">
      {/* KPI strip */}
      {isLoading && !data ? (
        <LoadingCards count={4} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Pending Queue" value={kpi?.pending_count ?? 0} icon={IconClock} />
          <StatCard
            label="Pending Amount"
            value={filsToAed(kpi?.pending_amount_fils ?? 0)}
            icon={IconWallet}
          />
          <StatCard
            label="Failed Payouts"
            value={kpi?.failed_count ?? 0}
            icon={IconAlertTriangle}
            className={kpi?.failed_count ? "border-red-200 bg-red-50" : ""}
          />
          <StatCard
            label="Paid Today"
            value={filsToAed(kpi?.paid_today_fils ?? 0)}
            icon={IconCheck}
            className="border-green-200 bg-green-50"
          />
        </div>
      )}

      {/* Failed alert banner */}
      {(kpi?.failed_count ?? 0) > 0 && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800">
          <IconAlertTriangle size={20} className="shrink-0" />
          <p className="text-sm flex-1">
            <strong>{kpi!.failed_count} payout(s)</strong> failed and require attention. Switch to
            the Failed tab to retry.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="border-red-300 text-red-700 hover:bg-red-100"
            onClick={() => setActiveTab("failed")}
          >
            View Failed
          </Button>
        </div>
      )}

      {/* Tab nav + toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex border rounded-md overflow-hidden">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setActiveTab(t.id);
                setPage(1);
              }}
              className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                activeTab === t.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground hover:bg-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Input
          placeholder="Search tailor…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="w-48"
        />
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh"
          >
            <IconRefresh size={16} className={isFetching ? "animate-spin" : ""} />
          </Button>
          {activeTab === "queue" && (
            <Button
              size="sm"
              onClick={() => {
                // Payouts are 100% manual bank transfers (see Bank Details
                // column below) — this flips every pending payout straight to
                // 'paid'. A misclick here marks money as sent when it never
                // was, so it needs the same confirm() gate as Reject below.
                if (
                  !window.confirm(
                    `Mark all ${kpi?.pending_count ?? 0} pending payout(s) as paid? Only confirm after the bank transfers have actually been sent.`,
                  )
                )
                  return;
                processAll.mutate(undefined, {
                  onError: mutationErrorToast("Couldn't process the pending payouts"),
                });
              }}
              disabled={processAll.isPending || !kpi?.pending_count}
            >
              <IconPlayerPlay size={15} className="mr-1.5" />
              Process All Pending
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      {isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading && !data ? (
        <LoadingRows cols={6} rows={10} />
      ) : (
        <DataTable
          columns={[
            { header: "Tailor", accessor: (r) => r.tailor_name },
            {
              header: "Amount",
              accessor: (r) => <span className="font-medium">{filsToAed(r.amount_fils)}</span>,
            },
            {
              // This was the actual Critical gap: payouts are 100% manual bank
              // transfers, and the table never rendered bank_name/iban even
              // though the backend already selects both — an admin had no way
              // to see where to send money before marking a payout paid.
              header: "Bank Details",
              accessor: (r) =>
                r.bank_name || r.iban ? (
                  <div className="text-xs leading-tight">
                    <div>{r.bank_name ?? "—"}</div>
                    {r.iban && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyIban(r.iban!);
                        }}
                        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground font-mono"
                        title="Copy IBAN"
                      >
                        {r.iban} <IconCopy size={12} />
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                ),
            },
            { header: "Status", accessor: (r) => <StatusBadge status={r.status} /> },
            { header: "Requested", accessor: (r) => fmtDate(r.requested_at) },
            {
              header: "Processed",
              accessor: (r) => (r.processed_at ? fmtDate(r.processed_at) : "—"),
            },
            {
              header: "Reference",
              accessor: (r) => (
                <span className="text-xs text-muted-foreground">{r.reference || "—"}</span>
              ),
            },
            {
              header: "Action",
              accessor: (r) => <PayoutActions id={r.id} status={r.status} />,
            },
          ]}
          rows={data?.data ?? []}
          pagination={{
            page: data?.page ?? 1,
            totalPages: data?.total_pages ?? 1,
            onPageChange: setPage,
          }}
        />
      )}

      {/* Schedule config */}
      {canEditSchedule && <PayoutScheduleCard />}
    </div>
  );
}

function PayoutActions({ id, status }: { id: string; status: string }) {
  const processSingle = useProcessSinglePayout();
  const retry = useRetryPayout();
  const reject = useRejectPayout();

  if (status === "pending") {
    return (
      <div className="flex gap-1.5">
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            // Same manual-bank-transfer risk as "Process All Pending" above —
            // this marks the payout paid immediately with no further step.
            if (
              !window.confirm(
                "Mark this payout as paid? Only confirm after the bank transfer has actually been sent.",
              )
            )
              return;
            // Optional — the bank's own confirmation/transaction number, kept
            // for later reconciliation. tailor_payouts already has a `reference`
            // column that nothing ever wrote to.
            const reference = window.prompt(
              "Bank reference / transaction number (optional, for reconciliation):",
            );
            processSingle.mutate(
              { id, reference: reference?.trim() || undefined },
              { onError: mutationErrorToast("Couldn't process this payout") },
            );
          }}
          disabled={processSingle.isPending || reject.isPending}
        >
          <IconPlayerPlay size={14} className="mr-1" /> Process
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-red-300 text-red-700 hover:bg-red-50"
          onClick={(e) => {
            e.stopPropagation();
            if (
              !window.confirm(
                "Reject this payout? The amount is credited back to the tailor's balance immediately.",
              )
            )
              return;
            reject.mutate(id, { onError: mutationErrorToast("Couldn't reject this payout") });
          }}
          disabled={processSingle.isPending || reject.isPending}
        >
          <IconBan size={14} className="mr-1" /> Reject
        </Button>
      </div>
    );
  }
  if (status === "failed") {
    return (
      <Button
        size="sm"
        variant="outline"
        className="border-red-300 text-red-700 hover:bg-red-50"
        onClick={(e) => {
          e.stopPropagation();
          retry.mutate(id, { onError: mutationErrorToast("Couldn't retry this payout") });
        }}
        disabled={retry.isPending}
      >
        <IconRefresh size={14} className="mr-1" /> Retry
      </Button>
    );
  }
  return null;
}

function PayoutScheduleCard() {
  const scheduleQ = usePayoutSchedule();
  const updateSchedule = useUpdatePayoutSchedule();
  const [editing, setEditing] = useState(false);
  const [freq, setFreq] = useState<string>("");
  const [minAmount, setMinAmount] = useState("");

  if (scheduleQ.isLoading) return <CenteredSpinner />;
  // Used to silently return null on any fetch error — the whole card just
  // vanished with no indication anything was wrong, unlike every other
  // section on this page which shows a real ErrorState.
  if (scheduleQ.isError) {
    return <ErrorState error={scheduleQ.error} onRetry={scheduleQ.refetch} />;
  }
  if (!scheduleQ.data) return null;

  const s = scheduleQ.data;

  return (
    <Card
      title="Payout Schedule"
      action={
        editing ? (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                // setEditing(false) used to run unconditionally right here,
                // not in onSuccess — a failed save closed the editor and
                // showed the stale old schedule with zero indication the
                // save hadn't actually happened.
                updateSchedule.mutate(
                  {
                    frequency: freq as PayoutSchedule["frequency"],
                    minimum_amount_fils: Number(minAmount),
                  },
                  {
                    onSuccess: () => setEditing(false),
                    onError: mutationErrorToast("Couldn't save the payout schedule"),
                  },
                );
              }}
              disabled={updateSchedule.isPending}
            >
              <IconCheck size={15} className="mr-1" /> Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              <IconX size={15} />
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setFreq(s.frequency);
              setMinAmount(String(s.minimum_amount_fils));
              setEditing(true);
            }}
          >
            <IconEdit size={15} className="mr-1" /> Edit
          </Button>
        )
      }
    >
      {editing ? (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">Frequency</label>
            <Select value={freq} onValueChange={setFreq}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="biweekly">Bi-weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Minimum Amount (fils)</label>
            <Input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
          </div>
        </div>
      ) : (
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          {[
            ["Frequency", s.frequency],
            ["Min. Amount", filsToAed(s.minimum_amount_fils)],
            ["Auto Process", s.auto_process ? "Yes" : "No"],
            ["Next Run", fmtDateTime(s.next_run_at)],
          ].map(([k, v]) => (
            <div key={String(k)}>
              <dt className="text-muted-foreground text-xs uppercase tracking-wider">{k}</dt>
              <dd className="font-medium mt-1">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
}
