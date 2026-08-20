import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/common/DataTable";
import { PageHeader } from "@/components/common/Page";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Avatar, Stars } from "@/components/common/Avatar";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingCards, LoadingRows, NoData } from "@/components/common/AsyncStates";
import { ReasonDialog } from "@/components/common/ReasonDialog";
import { useTailors, useBulkTailors, type TailorFilters } from "@/lib/api/queries/tailors";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { TailorRow } from "@/lib/api/types";
import { fmtDate, fmtNumber, initialsOf, downloadCsv } from "@/lib/format";
import { Money } from "@/components/common/Money";
import { toast } from "sonner";
import { auth } from "@/lib/auth";
import { IconClipboardCheck, IconDownload, IconFilter, IconScissors } from "@tabler/icons-react";

export const Route = createFileRoute("/_app/tailors/")({ component: TailorsPage });

const VERIFICATION_STATUSES = ["pending", "under_review", "verified", "rejected"];

function TailorsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TailorFilters["status"]>("all");
  const [verificationFilter, setVerificationFilter] = useState<string[]>([]);

  const debouncedSearch = useDebouncedValue(search, 300);
  const filters: TailorFilters = {
    search: debouncedSearch || undefined,
    status: statusFilter,
    verification_status: verificationFilter.length ? verificationFilter : undefined,
    page: 1,
    limit: 25,
    sort: "newest",
  };

  const q = useTailors(filters);
  const bulk = useBulkTailors();
  // Bulk activate/deactivate/ban are write actions — only operations_admin/
  // super_admin (rank >= 2) may perform them.
  const canWrite = auth.canWrite();

  const toCsv = (list: TailorRow[]) =>
    list.map((t) => ({
      business_name: t.business_name,
      name: t.full_name,
      phone: t.phone,
      city: t.city,
      tier: t.tier,
      status: t.status,
      verification: t.verification_status,
      orders: t.total_orders,
      gmv_aed: ((t.gmv_fils ?? 0) / 100).toFixed(2),
      rating: t.rating_avg,
      joined: t.joined_at,
    }));
  const BULK_VERB: Record<string, string> = {
    activate: "activated",
    deactivate: "deactivated",
    ban: "banned",
  };
  const [bulkDialog, setBulkDialog] = useState<{
    action: "deactivate" | "ban";
    ids: string[];
    clear: () => void;
  } | null>(null);

  const runBulk = (
    ids: string[],
    action: "activate" | "deactivate" | "ban",
    clear: () => void,
    reason?: string,
  ) =>
    bulk.mutate(
      { ids, action, reason },
      {
        // Report the server's real count, not the requested one — activate
        // genuinely filters out tailors with incomplete profiles, so bulk-
        // activating 10 where 3 are skipped previously still toasted
        // "10 tailor(s) activated," and skipped_incomplete was never shown.
        onSuccess: (data) => {
          const skipped = data?.skipped_incomplete ?? [];
          const applied = data?.count ?? ids.length;
          if (skipped.length > 0) {
            toast.success(
              `${applied} tailor(s) ${BULK_VERB[action] ?? action}. ${skipped.length} skipped (incomplete profile).`,
            );
          } else {
            toast.success(`${applied} tailor(s) ${BULK_VERB[action] ?? action}`);
          }
          clear();
        },
        onError: (e: unknown) => toast.error((e as Error)?.message || "Bulk action failed"),
      },
    );

  const columns = useMemo<ColumnDef<TailorRow>[]>(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <input
            type="checkbox"
            aria-label="Select all rows"
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <input
            data-no-row
            type="checkbox"
            aria-label="Select row"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
          />
        ),
        enableSorting: false,
      },
      {
        accessorKey: "full_name",
        header: "Tailor",
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <Avatar initials={initialsOf(row.original.full_name)} />
            <div>
              <div className="font-medium">{row.original.full_name}</div>
              <div className="text-xs text-muted-foreground">{row.original.business_name}</div>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "phone",
        header: "Phone",
        cell: ({ getValue }) => <span className="text-sm tabular-nums">{getValue<string>()}</span>,
      },
      { accessorKey: "city", header: "City" },
      {
        accessorKey: "tier",
        header: "Tier",
        cell: ({ getValue }) => <StatusBadge status={getValue<string>()} />,
      },
      {
        accessorKey: "total_orders",
        header: "Orders",
        cell: ({ getValue }) => (
          <span className="tabular-nums">{fmtNumber(getValue<number>())}</span>
        ),
      },
      {
        accessorKey: "gmv_fils",
        header: "GMV",
        cell: ({ getValue }) => (
          <span className="tabular-nums font-medium">
            <Money fils={getValue<number>()} />
          </span>
        ),
      },
      {
        accessorKey: "rating_avg",
        header: "Rating",
        cell: ({ row }) => (
          <span className="flex items-center gap-1">
            <Stars rating={row.original.rating_avg} />
            <span className="text-xs text-muted-foreground">({row.original.rating_count})</span>
          </span>
        ),
      },
      {
        accessorKey: "verification_status",
        header: "Verification",
        cell: ({ getValue }) => <StatusBadge status={getValue<string>()} />,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => <StatusBadge status={getValue<string>()} />,
      },
      {
        accessorKey: "joined_at",
        header: "Joined",
        cell: ({ getValue }) => <span className="text-sm">{fmtDate(getValue<string>())}</span>,
      },
    ],
    [],
  );

  const kpi = q.data?.kpi;
  const rows = q.data?.data ?? [];
  const total = q.data?.total ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tailor Management"
        description={total ? `${fmtNumber(total)} tailors` : undefined}
      />

      {kpi && kpi.pending_verification > 0 && (
        <Link
          to="/verification"
          className="flex items-center gap-3 px-4 py-3 rounded-lg border border-warning/40 bg-warning/10 hover:bg-warning/15 transition-colors"
        >
          <IconClipboardCheck className="text-warning shrink-0" />
          <div className="flex-1 text-sm">
            <span className="font-medium">{kpi.pending_verification}</span> tailors awaiting
            verification
          </div>
          <span className="text-sm text-primary font-medium">Open queue →</span>
        </Link>
      )}

      {q.isLoading && !q.data ? (
        <LoadingCards count={4} />
      ) : kpi ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Active" value={fmtNumber(kpi.active)} />
          {/* kpi.inactive is precisely COUNT(status='suspended') server-side
              (see backend/src/routes/tailors.js) — "Suspended" here matches
              what it actually counts, distinct from "Pending Verification"
              beside it, which is a different bucket (status='pending'). */}
          <StatCard label="Suspended" value={fmtNumber(kpi.inactive)} />
          <StatCard label="Pending Verification" value={fmtNumber(kpi.pending_verification)} />
          <StatCard label="Blocked" value={fmtNumber(kpi.blocked)} />
        </div>
      ) : null}

      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} title="Couldn't load tailors" />
      ) : (
        <DataTable
          data={rows}
          columns={columns}
          searchPlaceholder="Search by name, business, or phone…"
          onRowClick={(t) => navigate({ to: "/tailors/$id", params: { id: t.id } })}
          emptyMessage={
            q.isLoading
              ? "Loading…"
              : debouncedSearch || verificationFilter.length || statusFilter !== "all"
                ? "No tailors match these filters."
                : "No tailors registered yet."
          }
          filtersSlot={
            <div className="flex items-center gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                aria-label="Search tailors"
                className="text-sm border rounded-md px-3 py-1.5 w-64 hidden md:block"
              />
              <Button
                type="button"
                variant={showFilters ? "default" : "outline"}
                size="sm"
                onClick={() => setShowFilters((v) => !v)}
              >
                <IconFilter size={16} className="mr-1.5" /> Filters
                {verificationFilter.length > 0 && (
                  <span className="ml-2 inline-flex w-5 h-5 rounded-full bg-success text-success-foreground text-[10px] items-center justify-center font-semibold">
                    {verificationFilter.length}
                  </span>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => downloadCsv("tailors.csv", toCsv(rows))}
              >
                <IconDownload size={16} className="mr-1.5" /> Export
              </Button>
            </div>
          }
          bulkActions={(sel, clear) => (
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  downloadCsv("tailors.csv", toCsv(sel));
                  clear();
                }}
              >
                Export CSV ({sel.length})
              </Button>
              {canWrite && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={bulk.isPending}
                  onClick={() =>
                    runBulk(
                      sel.map((s) => s.id),
                      "activate",
                      clear,
                    )
                  }
                >
                  Bulk Activate
                </Button>
              )}
              {canWrite && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={bulk.isPending}
                  onClick={() =>
                    setBulkDialog({ action: "deactivate", ids: sel.map((s) => s.id), clear })
                  }
                >
                  Bulk Deactivate
                </Button>
              )}
              {canWrite && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={bulk.isPending}
                  className="text-destructive hover:bg-destructive/5"
                  onClick={() => setBulkDialog({ action: "ban", ids: sel.map((s) => s.id), clear })}
                >
                  Bulk Ban
                </Button>
              )}
            </>
          )}
        />
      )}

      {showFilters && (
        <div className="border rounded-lg p-4 bg-card space-y-4">
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Verification status
            </div>
            <div className="flex flex-wrap gap-2">
              {VERIFICATION_STATUSES.map((s) => {
                const active = verificationFilter.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() =>
                      setVerificationFilter((cur) =>
                        active ? cur.filter((x) => x !== s) : [...cur, s],
                      )
                    }
                    className={`px-3 py-1 rounded-full text-xs border ${
                      active
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card text-foreground border-border"
                    }`}
                  >
                    {s.replace("_", " ")}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Account status
            </div>
            <div className="flex gap-1 bg-muted rounded p-0.5 w-fit">
              {(["all", "active", "inactive", "blocked"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(s)}
                  className={`px-3 py-1 text-xs rounded font-medium capitalize ${
                    statusFilter === s ? "bg-card shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  {/* Filter value stays "inactive" (backend/src/routes/tailors.js's
                      STATUS_ALIASES maps it to status='suspended') — only the
                      displayed label changes, to match the row badges above. */}
                  {s === "inactive" ? "Suspended" : s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={() => {
                setVerificationFilter([]);
                setStatusFilter("all");
              }}
              className="text-sm text-muted-foreground hover:text-destructive"
            >
              Reset all
            </button>
          </div>
        </div>
      )}

      {q.isLoading && !q.data && (
        <div className="border rounded-xl p-4 bg-card">
          <LoadingRows rows={6} cols={6} />
        </div>
      )}

      {!q.isLoading &&
        !q.isError &&
        rows.length === 0 &&
        !debouncedSearch &&
        verificationFilter.length === 0 &&
        statusFilter === "all" && (
          <NoData
            icon={IconScissors}
            title="No tailors registered yet."
            description="As tailors sign up they'll appear here."
          />
        )}

      <ReasonDialog
        open={bulkDialog !== null}
        onOpenChange={(v) => !v && setBulkDialog(null)}
        title={
          bulkDialog?.action === "ban"
            ? `Ban ${bulkDialog.ids.length} tailor(s)?`
            : `Deactivate ${bulkDialog?.ids.length ?? 0} tailor(s)?`
        }
        description="Their storefronts go offline immediately."
        label="Reason"
        placeholder="e.g. Repeated late deliveries, customer complaints…"
        confirmLabel={bulkDialog?.action === "ban" ? "Ban" : "Deactivate"}
        destructive
        onConfirm={(reason) => {
          if (!bulkDialog) return;
          const { action, ids, clear } = bulkDialog;
          setBulkDialog(null);
          runBulk(ids, action, clear, reason);
        }}
      />
    </div>
  );
}
