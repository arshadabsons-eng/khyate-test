import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/common/DataTable";
import { Card, PageHeader } from "@/components/common/Page";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Stars } from "@/components/common/Avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingCards, LoadingRows, NoData } from "@/components/common/AsyncStates";
import {
  useReviews,
  useReviewAnalytics,
  useModerateReview,
  type ReviewFilters,
} from "@/lib/api/queries/reviews";
import type { ReviewRow } from "@/lib/api/types";
import { fmtDate, fmtNumber, maskName } from "@/lib/format";
import { IconFlag, IconStar, IconEye, IconEyeOff } from "@tabler/icons-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/reviews")({ component: ReviewsPage });

export function ReviewsPage() {
  const [visibility, setVisibility] = useState<"all" | "true" | "false">("all");
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  const filters: ReviewFilters = {
    is_visible: visibility,
    is_flagged: flaggedOnly || undefined,
    page: 1,
    limit: 50,
    sort: "newest",
  };
  const q = useReviews(filters);
  const analyticsQ = useReviewAnalytics();
  const moderate = useModerateReview();

  const act = (id: string, action: "keep" | "hide", hidden_reason?: string) =>
    moderate.mutate(
      { id, action, hidden_reason },
      {
        onSuccess: () => toast.success(action === "keep" ? "Review is visible" : "Review hidden"),
        onError: (e: unknown) => toast.error((e as Error)?.message || "Couldn't update the review"),
      },
    );

  const hide = (id: string) => {
    const reason = window.prompt("Reason for hiding this review (kept in the audit log)?");
    if (reason === null) return;
    act(id, "hide", reason.trim() || undefined);
  };

  const rows = q.data?.data ?? [];
  const kpi = q.data?.kpi;
  const flaggedCount = kpi?.flagged ?? 0;

  const columns = useMemo<ColumnDef<ReviewRow>[]>(
    () => [
      {
        id: "reviewer",
        header: "Reviewer",
        cell: ({ row }) => <span>{maskName(row.original.reviewer.name)}</span>,
      },
      {
        id: "reviewee",
        header: "Reviewee",
        cell: ({ row }) => <span>{row.original.reviewee.name}</span>,
      },
      {
        accessorKey: "rating",
        header: "Rating",
        cell: ({ getValue }) => <Stars rating={getValue<number>()} />,
      },
      {
        id: "review",
        header: "Review",
        cell: ({ row }) => (
          <span className="truncate max-w-[280px] inline-block text-muted-foreground">
            {(row.original as { body?: string }).body || "—"}
          </span>
        ),
      },
      {
        accessorKey: "created_at",
        header: "Date",
        cell: ({ getValue }) => fmtDate(getValue<string>()),
      },
      {
        accessorKey: "is_flagged",
        header: "Flagged",
        cell: ({ getValue, row }) =>
          getValue<boolean>() ? (
            <span className="inline-flex items-center gap-1 text-warning">
              <IconFlag size={14} /> {row.original.flag_count}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
      },
      {
        accessorKey: "is_visible",
        header: "Visible",
        cell: ({ getValue }) => <StatusBadge status={getValue<boolean>() ? "Visible" : "Hidden"} />,
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div className="flex gap-1.5">
              {r.is_visible ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => hide(r.id)}
                  title="Hide from public"
                >
                  <IconEyeOff size={14} className="mr-1" /> Hide
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => act(r.id, "keep")}
                  title="Make visible"
                >
                  <IconEye size={14} className="mr-1" /> Show
                </Button>
              )}
            </div>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reviews"
        description={q.data?.total ? `${fmtNumber(q.data.total)} reviews` : undefined}
      />

      {q.isLoading && !q.data ? (
        <LoadingCards count={5} />
      ) : kpi ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Total" value={fmtNumber(kpi.total)} />
          <StatCard label="Visible" value={fmtNumber(kpi.visible)} />
          <StatCard label="Hidden" value={fmtNumber(kpi.hidden)} />
          <StatCard label="Flagged" value={fmtNumber(kpi.flagged)} />
          <StatCard
            label="Avg Rating"
            value={Number(kpi.avg_rating ?? 0).toFixed(1)}
            suffix="/ 5"
          />
        </div>
      ) : null}

      {flaggedCount > 0 && !flaggedOnly && (
        <Card className="bg-warning/10 border-warning/40">
          <div className="flex items-center gap-3">
            <IconFlag className="text-warning shrink-0" />
            <div className="flex-1 text-sm">
              <span className="font-medium">{flaggedCount}</span> flagged reviews need attention
            </div>
            <Button type="button" size="sm" variant="outline" onClick={() => setFlaggedOnly(true)}>
              Show flagged only
            </Button>
          </div>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 bg-muted rounded p-0.5">
          {(["all", "true", "false"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVisibility(v)}
              className={`px-3 py-1 text-xs rounded font-medium ${
                visibility === v ? "bg-card shadow-sm" : "text-muted-foreground"
              }`}
            >
              {v === "all" ? "All" : v === "true" ? "Visible" : "Hidden"}
            </button>
          ))}
        </div>
        <label className="text-xs flex items-center gap-2">
          <input
            type="checkbox"
            checked={flaggedOnly}
            onChange={(e) => setFlaggedOnly(e.target.checked)}
          />
          Flagged only
        </label>
      </div>

      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} title="Couldn't load reviews" />
      ) : q.isLoading && !q.data ? (
        <div className="border rounded-xl p-4 bg-card">
          <LoadingRows rows={6} cols={7} />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <NoData icon={IconStar} title="No reviews yet" />
        </Card>
      ) : (
        <DataTable data={rows} columns={columns} searchPlaceholder="Search reviews…" />
      )}

      <h3 className="text-lg font-semibold mt-2">Review Analytics</h3>
      {analyticsQ.isError ? (
        <ErrorState
          error={analyticsQ.error}
          onRetry={() => analyticsQ.refetch()}
          title="Couldn't load analytics"
        />
      ) : analyticsQ.isLoading ? (
        <Skeleton className="h-32" />
      ) : analyticsQ.data ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card title="Platform Average">
            <div className="text-3xl font-semibold tabular-nums">
              {Number(analyticsQ.data.platform_avg_rating ?? 0).toFixed(1)}{" "}
              <span className="text-base text-muted-foreground">/ 5</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {analyticsQ.data.distribution.reduce((s, n) => s + n, 0)} reviews total
            </div>
          </Card>
          <Card title="Reviews This Month">
            <div className="text-3xl font-semibold tabular-nums">
              {fmtNumber(analyticsQ.data.volume_this_month)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              vs {fmtNumber(analyticsQ.data.volume_prior_month)} prior month
            </div>
          </Card>
          <Card title="Tailors Below 3.5">
            {analyticsQ.data.tailors_below_threshold.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                None — every tailor is rated 3.5 or above.
              </div>
            ) : (
              <ul className="text-sm space-y-2">
                {analyticsQ.data.tailors_below_threshold.map((t) => (
                  <li key={t.id} className="flex items-center justify-between">
                    <span className="truncate">{t.business_name}</span>
                    <Stars rating={t.rating_avg ?? 0} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
