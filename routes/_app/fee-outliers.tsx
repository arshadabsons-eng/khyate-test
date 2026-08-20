import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { IconAlertTriangle, IconCash, IconUsers } from "@tabler/icons-react";
import { PageHeader } from "@/components/common/Page";
import { StatCard } from "@/components/common/StatCard";
import { Money } from "@/components/common/Money";
import { ErrorState, LoadingCards, LoadingRows, NoData } from "@/components/common/AsyncStates";
import { useFeeOutliers } from "@/lib/api/queries/tailors";
import type { FeeOutlierRow } from "@/lib/api/types";
import { fmtNumber, filsToAed } from "@/lib/format";

export const Route = createFileRoute("/_app/fee-outliers")({ component: FeeOutliersPage });

// Stable reference so `rows` doesn't change identity on every render while loading
// (a fresh `[]` literal there would defeat the `sorted` memo below).
const EMPTY_ROWS: FeeOutlierRow[] = [];

function FeeOutliersPage() {
  const q = useFeeOutliers();
  const rows = q.data?.data ?? EMPTY_ROWS;
  const median = q.data?.median_home_visit_fee_fils ?? 0;
  const threshold = q.data?.outlier_threshold_fils ?? 0;
  const thresholdRatio = median > 0 ? (threshold / median).toFixed(1) : null;

  // Outliers first (the ones that actually need a look), then the rest by fee — the
  // backend only sorts by fee, which can bury a flagged tailor past the fold.
  const sorted = useMemo<FeeOutlierRow[]>(
    () =>
      [...rows].sort((a, b) => {
        if (a.is_outlier !== b.is_outlier) return a.is_outlier ? -1 : 1;
        return b.home_visit_fee_fils - a.home_visit_fee_fils;
      }),
    [rows],
  );

  const outlierCount = rows.filter((r) => r.is_outlier).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Home-visit fee review"
        description={
          <>
            There's deliberately no automatic cap on what a tailor charges for a home visit — this
            is a manual review queue for unusually high fees so the team can follow up directly.
            {thresholdRatio && (
              <>
                {" "}
                Fees above <Money fils={threshold} className="mx-0.5" /> ({thresholdRatio}x the
                platform median) are flagged below.
              </>
            )}
          </>
        }
      />

      {q.isLoading && !q.data ? (
        <LoadingCards count={3} />
      ) : q.data ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Platform median fee" value={filsToAed(median)} icon={IconCash} money />
          <StatCard
            label="Outliers flagged"
            value={fmtNumber(outlierCount)}
            icon={IconAlertTriangle}
            className={outlierCount > 0 ? "border-destructive/30 bg-destructive/5" : undefined}
          />
          <StatCard
            label="Tailors with a home-visit fee"
            value={fmtNumber(rows.length)}
            icon={IconUsers}
          />
        </div>
      ) : null}

      {q.isError ? (
        <ErrorState
          error={q.error}
          onRetry={() => q.refetch()}
          title="Couldn't load the fee review"
        />
      ) : q.isLoading && !q.data ? (
        <div className="border rounded-xl p-4 bg-card">
          <LoadingRows rows={6} cols={6} />
        </div>
      ) : rows.length === 0 ? (
        <NoData
          icon={IconCash}
          title="No home-visit fees set yet"
          description="Once tailors start setting a fee for home-visit measurements, unusually high ones will be flagged here for review."
        />
      ) : (
        <div className="border rounded-lg overflow-hidden bg-card">
          <table className="w-full text-sm kh-table">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">Tailor</th>
                <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">City</th>
                <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">Contact</th>
                <th className="text-right py-2.5 px-4 font-medium text-muted-foreground">
                  Home-visit fee
                </th>
                <th className="text-right py-2.5 px-4 font-medium text-muted-foreground">
                  vs. median
                </th>
                <th className="text-left py-2.5 px-4 font-medium text-muted-foreground w-28">
                  Flag
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sorted.map((r) => (
                <tr
                  key={r.id}
                  className={`hover:bg-muted/30 transition-colors ${
                    r.is_outlier ? "bg-destructive/5" : ""
                  }`}
                >
                  <td className="py-2.5 px-4 font-medium">{r.business_name}</td>
                  <td className="py-2.5 px-4 text-muted-foreground">{r.city || "—"}</td>
                  <td className="py-2.5 px-4">
                    <a
                      href={`mailto:${r.email}`}
                      className="text-primary hover:underline text-xs block"
                    >
                      {r.email}
                    </a>
                    <div className="text-xs text-muted-foreground">{r.phone}</div>
                  </td>
                  <td className="py-2.5 px-4 text-right font-medium tabular-nums">
                    <Money fils={r.home_visit_fee_fils} />
                  </td>
                  <td className="py-2.5 px-4 text-right tabular-nums text-muted-foreground">
                    {r.ratio_to_median != null ? `${r.ratio_to_median.toFixed(1)}x median` : "—"}
                  </td>
                  <td className="py-2.5 px-4">
                    {r.is_outlier ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-destructive/15 text-destructive border-destructive/30">
                        <IconAlertTriangle size={12} /> Outlier
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
