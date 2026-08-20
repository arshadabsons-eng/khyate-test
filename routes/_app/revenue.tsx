import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { ValueType, NameType } from "recharts/types/component/DefaultTooltipContent";
import {
  IconCash,
  IconTrendingUp,
  IconTrendingDown,
  IconReceipt,
  IconDownload,
  IconEdit,
  IconCheck,
  IconX,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import {
  useRevenueKPI,
  useRevenueBreakdown,
  useCommissionConfig,
  useUpdateGlobalCommission,
  useUpdateTierCommission,
  useSetCommissionOverride,
  useDeleteCommissionOverride,
  useExportRevenue,
} from "@/lib/api/queries/revenue";
import { StatCard } from "@/components/common/StatCard";
import { Card } from "@/components/common/Page";
import { ErrorState, LoadingCards, CenteredSpinner } from "@/components/common/AsyncStates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { filsToAed, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import type { RevenuePeriod } from "@/lib/api/queries/revenue";

export const Route = createFileRoute("/_app/revenue")({ component: RevenuePage });

const PERIODS: { value: RevenuePeriod; label: string }[] = [
  { value: "day", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
];

export function RevenuePage() {
  const [period, setPeriod] = useState<RevenuePeriod>("month");
  const kpiQ = useRevenueKPI(period);
  const breakdownQ = useRevenueBreakdown(period);
  const configQ = useCommissionConfig();
  const exportMutation = useExportRevenue();

  const kpi = kpiQ.data;
  const mutationErrorToast = (fallback: string) => (e: unknown) =>
    toast.error((e as Error)?.message || fallback);

  return (
    <div className="space-y-6">
      {/* Period toggle */}
      <div className="flex items-center gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setPeriod(p.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              period === p.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {p.label}
          </button>
        ))}
        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              exportMutation.mutate(period, {
                onError: mutationErrorToast("Couldn't export revenue"),
              })
            }
            disabled={exportMutation.isPending}
          >
            <IconDownload size={15} className="mr-1.5" />
            Export
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      {kpiQ.isLoading && !kpi ? (
        <LoadingCards count={4} />
      ) : kpiQ.isError ? (
        <ErrorState error={kpiQ.error} onRetry={() => kpiQ.refetch()} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Gross Merchandise Value"
            value={filsToAed(kpi!.gmv_fils)}
            icon={IconCash}
            delta={kpi!.gmv_delta_pct}
          />
          <StatCard
            label="Platform Commission"
            value={filsToAed(kpi!.commission_fils)}
            icon={IconReceipt}
            delta={kpi!.commission_delta_pct}
          />
          <StatCard
            label="Refunds Issued"
            value={filsToAed(kpi!.refunds_fils)}
            icon={IconTrendingDown}
            className="border-red-200 bg-red-50"
          />
          <StatCard
            label="Net Revenue"
            value={filsToAed(kpi!.net_revenue_fils)}
            icon={IconTrendingUp}
            className="border-green-200 bg-green-50"
          />
        </div>
      )}

      {/* Breakdown chart */}
      <Card title="Revenue Breakdown">
        {breakdownQ.isLoading ? (
          <CenteredSpinner />
        ) : breakdownQ.isError ? (
          <ErrorState error={breakdownQ.error} onRetry={() => breakdownQ.refetch()} />
        ) : (breakdownQ.data ?? []).length === 0 ? (
          <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
            No revenue in this period yet.
          </div>
        ) : (
          <div className="w-full h-[280px]">
            {/* Numeric height (not "100%") — Recharts v3 mis-measures a percentage
              height inside a flex/tab container and warns width(-1)/height(-1). */}
            <ResponsiveContainer width="100%" height={280} minWidth={0}>
              <AreaChart
                data={breakdownQ.data ?? []}
                margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `AED ${(v / 100).toFixed(0)}`}
                />
                <Tooltip
                  formatter={(v: ValueType | undefined, name: NameType | undefined) => [
                    filsToAed(Number(v)),
                    name,
                  ]}
                  contentStyle={{ fontSize: 12 }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="readymade_fils"
                  name="Readymade"
                  stackId="1"
                  stroke="#2D7A2D"
                  fill="#2D7A2D"
                  fillOpacity={0.3}
                />
                <Area
                  type="monotone"
                  dataKey="custom_stitch_fils"
                  name="Custom Stitch"
                  stackId="1"
                  stroke="#4CAF50"
                  fill="#4CAF50"
                  fillOpacity={0.3}
                />
                <Area
                  type="monotone"
                  dataKey="material_fils"
                  name="Materials"
                  stackId="1"
                  stroke="#81C784"
                  fill="#81C784"
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Commission configuration */}
      {configQ.isLoading ? (
        <CenteredSpinner />
      ) : configQ.isError ? null : (
        <CommissionConfig config={configQ.data!} />
      )}
    </div>
  );
}

function CommissionConfig({
  config,
}: {
  config: NonNullable<ReturnType<typeof useCommissionConfig>["data"]>;
}) {
  const [editingGlobal, setEditingGlobal] = useState(false);
  const [globalRate, setGlobalRate] = useState(String(config.global_default_rate_pct));
  const [editingTier, setEditingTier] = useState<string | null>(null);
  const [tierRate, setTierRate] = useState("");
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overrideTailorId, setOverrideTailorId] = useState("");
  const [overrideRate, setOverrideRate] = useState("");
  const [overrideReason, setOverrideReason] = useState("");

  const updateGlobal = useUpdateGlobalCommission();
  const updateTier = useUpdateTierCommission();
  const setOverride = useSetCommissionOverride();
  const deleteOverride = useDeleteCommissionOverride();

  const mutationErrorToast = (fallback: string) => (e: unknown) =>
    toast.error((e as Error)?.message || fallback);

  return (
    <div className="space-y-6">
      {/* Global rate */}
      <Card title="Commission Configuration">
        <div className="flex items-center gap-4 pb-6 border-b">
          <div className="flex-1">
            <p className="text-sm font-medium">Global Default Rate</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Applies to all tailors without a tier or override rate.
            </p>
          </div>
          {editingGlobal ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={globalRate}
                onChange={(e) => setGlobalRate(e.target.value)}
                className="w-24 text-right"
              />
              <span className="text-sm font-medium">%</span>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  updateGlobal.mutate(Number(globalRate), {
                    onSuccess: () => setEditingGlobal(false),
                    onError: mutationErrorToast("Couldn't update the global commission rate"),
                  });
                }}
              >
                <IconCheck size={16} className="text-green-600" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setEditingGlobal(false)}>
                <IconX size={16} />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold">{config.global_default_rate_pct}%</span>
              <Button size="icon" variant="ghost" onClick={() => setEditingGlobal(true)}>
                <IconEdit size={15} />
              </Button>
            </div>
          )}
        </div>

        {/* Tier rates */}
        <div className="pt-4">
          <p className="text-sm font-medium mb-3">Tier Rates</p>
          <div className="space-y-2">
            {config.tier_rates.map((t) => (
              <div
                key={t.tier_id}
                className="flex items-center gap-3 py-2 rounded-md px-3 hover:bg-muted/50"
              >
                <div className="flex-1">
                  <span className="text-sm font-medium">{t.tier_name}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    ({t.tailor_count} tailors)
                  </span>
                </div>
                {editingTier === t.tier_id ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      value={tierRate}
                      onChange={(e) => setTierRate(e.target.value)}
                      className="w-24 text-right"
                    />
                    <span className="text-sm">%</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        updateTier.mutate(
                          { tier_id: t.tier_id, rate_pct: Number(tierRate) },
                          {
                            onSuccess: () => setEditingTier(null),
                            onError: mutationErrorToast("Couldn't update the tier commission rate"),
                          },
                        );
                      }}
                    >
                      <IconCheck size={16} className="text-green-600" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setEditingTier(null)}>
                      <IconX size={16} />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{t.rate_pct}%</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditingTier(t.tier_id);
                        setTierRate(String(t.rate_pct));
                      }}
                    >
                      <IconEdit size={15} />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Per-tailor overrides */}
      <Card
        title="Per-Tailor Overrides"
        action={
          <Button size="sm" variant="outline" onClick={() => setShowOverrideForm(true)}>
            <IconPlus size={15} className="mr-1" /> Add Override
          </Button>
        }
      >
        {showOverrideForm && (
          <div className="flex flex-wrap items-end gap-3 mb-4 p-3 bg-muted/40 rounded-lg">
            <div className="space-y-1">
              <label className="text-xs font-medium">Tailor ID</label>
              <Input
                value={overrideTailorId}
                onChange={(e) => setOverrideTailorId(e.target.value)}
                placeholder="uuid"
                className="w-64"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Rate (%)</label>
              <Input
                type="number"
                value={overrideRate}
                onChange={(e) => setOverrideRate(e.target.value)}
                className="w-24"
              />
            </div>
            <div className="space-y-1 flex-1">
              <label className="text-xs font-medium">Reason</label>
              <Input
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="e.g. Negotiated rate"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setOverride.mutate(
                    {
                      tailor_id: overrideTailorId,
                      rate_pct: Number(overrideRate),
                      note: overrideReason,
                    },
                    { onError: mutationErrorToast("Couldn't save this override") },
                  );
                  setShowOverrideForm(false);
                  setOverrideTailorId("");
                  setOverrideRate("");
                  setOverrideReason("");
                }}
                disabled={setOverride.isPending}
              >
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowOverrideForm(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
        {config.custom_overrides.length === 0 ? (
          <p className="text-sm text-muted-foreground">No per-tailor overrides set.</p>
        ) : (
          <div className="space-y-2">
            {config.custom_overrides.map((o) => (
              <div
                key={o.tailor_id}
                className="flex items-center gap-3 py-2 px-3 rounded-md hover:bg-muted/50"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{o.tailor_name}</p>
                  {o.note && <p className="text-xs text-muted-foreground">{o.note}</p>}
                </div>
                <span className="text-xs text-muted-foreground">{fmtDate(o.updated_at)}</span>
                <span className="font-semibold w-12 text-right">{o.rate_pct}%</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() =>
                    deleteOverride.mutate(o.tailor_id, {
                      onError: mutationErrorToast("Couldn't remove this override"),
                    })
                  }
                  disabled={deleteOverride.isPending}
                >
                  <IconTrash size={15} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
