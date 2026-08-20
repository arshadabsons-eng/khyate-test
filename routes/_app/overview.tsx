import { createFileRoute, Link } from "@tanstack/react-router";
import {
  IconScissors,
  IconUsers,
  IconShoppingBag,
  IconCoin,
  IconCash,
  IconAlertTriangle,
  IconShieldCheck,
  IconBox,
  IconActivity,
  IconRefresh,
  IconUserPlus,
  IconCheck,
  IconChartBar,
  type Icon as TablerIcon,
} from "@tabler/icons-react";
import { useState } from "react";
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  ReferenceLine,
} from "recharts";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { StatCard } from "@/components/common/StatCard";
import { Card, PageHeader } from "@/components/common/Page";
import { Avatar, Stars } from "@/components/common/Avatar";
import { ErrorState, LoadingCards, NoData } from "@/components/common/AsyncStates";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/StatusBadge";
import {
  useOverviewKpis,
  useRevenue,
  useTopTailors,
  useOrderTypeBreakdown,
  useActivityFeed,
  useForecast,
} from "@/lib/api/queries/overview";
import { aedCompact, filsToAed, fmtNumber, relTime, initialsOf } from "@/lib/format";
import type { ActivityEvent } from "@/lib/api/types";

export const Route = createFileRoute("/_app/overview")({ component: Overview });

function Overview() {
  const qc = useQueryClient();
  const [revenuePeriod, setRevenuePeriod] = useState<"day" | "week" | "month" | "year">("month");
  const [topPeriod, setTopPeriod] = useState<"this_month" | "last_month" | "last_90_days">(
    "this_month",
  );

  const kpisQ = useOverviewKpis();
  const revenueQ = useRevenue(revenuePeriod);
  const topQ = useTopTailors(topPeriod);
  const breakdownQ = useOrderTypeBreakdown();
  const activityQ = useActivityFeed();

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["analytics"] });
  };
  // Covers every card on this page (they all queryKey off "analytics") since
  // the header button invalidates+refetches the whole group rather than a
  // single query's own refetch() — there's no single isFetching to read.
  const isRefreshing = useIsFetching({ queryKey: ["analytics"] }) > 0;

  return (
    <div className="space-y-6 kh-section">
      <PageHeader
        title="Overview"
        description={`Today · ${new Date().toLocaleDateString("en-AE", { day: "2-digit", month: "long", year: "numeric" })}`}
        actions={
          <Button size="sm" variant="outline" onClick={refreshAll} disabled={isRefreshing}>
            <IconRefresh size={14} className={`mr-1.5 ${isRefreshing ? "animate-spin" : ""}`} />{" "}
            Refresh
          </Button>
        }
      />

      <KpiCards />

      <RevenueChart period={revenuePeriod} setPeriod={setRevenuePeriod} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OrderTypeCard />
        <TopTailorsCard period={topPeriod} setPeriod={setTopPeriod} />
      </div>

      <ActivityFeed />
    </div>
  );

  function KpiCards() {
    if (kpisQ.isLoading) return <LoadingCards count={8} />;
    if (kpisQ.isError)
      return (
        <ErrorState
          error={kpisQ.error}
          onRetry={() => kpisQ.refetch()}
          title="Couldn't load KPIs"
        />
      );
    const k = kpisQ.data!;
    const cards = [
      {
        label: "Active Tailors",
        value: fmtNumber(k.tailors.active),
        delta: k.tailors.delta_vs_yesterday,
        icon: IconScissors,
      },
      {
        label: "Total Customers",
        value: fmtNumber(k.customers.total),
        delta: k.customers.delta_vs_yesterday,
        icon: IconUsers,
        sub: `+${k.customers.new_today} today`,
      },
      {
        label: "Orders Today",
        value: fmtNumber(k.orders.today_count),
        delta: undefined,
        icon: IconShoppingBag,
      },
      {
        label: "GMV Today",
        value: filsToAed(k.orders.today_gmv_fils),
        delta: k.orders.delta_gmv_vs_yesterday,
        icon: IconCoin,
        money: true,
      },
      {
        // Sourced from analytics.js's unfiltered SUM(commission_fils) — net of
        // refund reversals. Finance's own "Platform Commission" card is
        // explicitly gross-only, with net broken out separately as "Net
        // Revenue" — disambiguated here so the two pages aren't silently
        // comparing net to gross under near-identical labels.
        label: "Platform Revenue Today (net)",
        value: filsToAed(k.orders.today_revenue_fils),
        delta: k.orders.delta_revenue_vs_yesterday,
        icon: IconCash,
        money: true,
      },
      {
        label: "Disputes",
        value: fmtNumber(k.disputes.open_count),
        delta: k.disputes.delta_vs_yesterday,
        icon: IconAlertTriangle,
        sub:
          k.disputes.escalated_count > 0
            ? `${k.disputes.escalated_count} escalated`
            : "none escalated",
      },
      {
        label: "Pending Verifications",
        value: fmtNumber(k.pending_verifications),
        delta: undefined,
        icon: IconShieldCheck,
      },
      {
        label: "Pending Listing Reviews",
        value: fmtNumber(k.pending_listing_reviews),
        delta: undefined,
        icon: IconBox,
      },
    ];
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 kh-stagger">
        {cards.map((c) => (
          <StatCard
            key={c.label}
            label={c.label}
            value={c.value}
            delta={c.delta}
            suffix={c.sub}
            icon={c.icon}
            money={(c as { money?: boolean }).money}
          />
        ))}
      </div>
    );
  }
}

function RevenueChart({
  period,
  setPeriod,
}: {
  period: "day" | "week" | "month" | "year";
  setPeriod: (p: "day" | "week" | "month" | "year") => void;
}) {
  const q = useRevenue(period);
  // Forecast is a 7-day, day-granularity projection — only lines up visually
  // against the day-truncated "week"/"month" buckets (see analytics.js: "day"
  // period truncs to hour, "year" truncs to month).
  const showForecast = period === "week" || period === "month";
  const forecastQ = useForecast();
  const forecastPoints = showForecast && !forecastQ.isError ? (forecastQ.data ?? []) : [];

  const rawData = q.data ?? [];
  const chartData =
    forecastPoints.length && rawData.length
      ? [
          ...rawData.map((r, i) =>
            i === rawData.length - 1
              ? {
                  ...r,
                  projected_gmv_fils: r.gmv_fils,
                  projected_revenue_fils: r.commission_fils,
                }
              : r,
          ),
          ...forecastPoints.map((p) => ({
            date: p.date,
            projected_gmv_fils: p.projected_gmv_fils,
            projected_revenue_fils: p.projected_revenue_fils,
          })),
        ]
      : rawData;

  return (
    <Card
      title="Revenue Overview"
      action={
        <div className="flex items-center gap-1 bg-muted rounded-md p-1">
          {(["day", "week", "month", "year"] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-xs rounded font-medium capitalize transition-colors ${
                period === p ? "bg-card shadow-sm" : "text-muted-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      }
    >
      {q.isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} title="Couldn't load revenue" />
      ) : !q.data?.length ? (
        <NoData
          icon={IconChartBar}
          title="No revenue data"
          description="No orders in the selected period."
        />
      ) : (
        <>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="0" vertical={false} />
                <XAxis
                  dataKey="date"
                  fontSize={12}
                  stroke="var(--color-muted-foreground)"
                  tickFormatter={(v) =>
                    new Date(v).toLocaleDateString("en-AE", { day: "2-digit", month: "short" })
                  }
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  fontSize={12}
                  stroke="var(--color-muted-foreground)"
                  width={80}
                  tickFormatter={(v) => aedCompact(Number(v))}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-popover)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                  }}
                  formatter={(v, name) => [filsToAed(Number(v ?? 0)), name as string]}
                  labelFormatter={(label) => new Date(label as string).toLocaleDateString("en-AE")}
                />
                <ReferenceLine
                  x={new Date().toISOString().slice(0, 10)}
                  stroke="var(--color-muted-foreground)"
                  strokeDasharray="3 3"
                  label={{ value: "Today", position: "top", fontSize: 11 }}
                />
                <Line
                  type="monotone"
                  dataKey="gmv_fils"
                  name="GMV"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="commission_fils"
                  name="Commission"
                  stroke="var(--color-chart-2)"
                  strokeWidth={2}
                  dot={false}
                />
                {forecastPoints.length > 0 && (
                  <>
                    <Line
                      type="monotone"
                      dataKey="projected_gmv_fils"
                      name="GMV (projected)"
                      stroke="var(--color-primary)"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="projected_revenue_fils"
                      name="Commission (projected)"
                      stroke="var(--color-chart-2)"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                      dot={false}
                    />
                  </>
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-3 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-primary" /> GMV
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-chart-2" /> Commission
            </span>
            {forecastPoints.length > 0 && (
              <span className="text-muted-foreground ml-auto">
                Dashed segment: next 7-day projection
              </span>
            )}
            {showForecast && forecastQ.isError && (
              <span className="text-muted-foreground ml-auto">Forecast unavailable right now</span>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

function OrderTypeCard() {
  const q = useOrderTypeBreakdown();
  return (
    <Card title="Orders by Type">
      {q.isLoading ? (
        <Skeleton className="h-60 w-full" />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} title="Couldn't load breakdown" />
      ) : !q.data ? (
        <NoData icon={IconShoppingBag} title="No order data" />
      ) : (
        (() => {
          const segments = [
            {
              name: "Readymade",
              value: q.data.readymade.count,
              fils: q.data.readymade.fils,
              fill: "var(--color-primary)",
              swatch: "bg-primary",
            },
            {
              name: "Custom Stitch",
              value: q.data.custom_stitch.count,
              fils: q.data.custom_stitch.fils,
              fill: "var(--color-chart-2)",
              swatch: "bg-chart-2",
            },
            {
              name: "Material",
              value: q.data.material.count,
              fils: q.data.material.fils,
              fill: "var(--color-primary-soft)",
              swatch: "bg-primary-soft",
            },
            {
              name: "Alteration",
              value: q.data.alteration.count,
              fils: q.data.alteration.fils,
              fill: "var(--color-warning)",
              swatch: "bg-warning",
            },
          ];
          const total = segments.reduce((s, x) => s + Number(x.value), 0);
          if (total === 0)
            return (
              <NoData
                icon={IconShoppingBag}
                title="No order data"
                description="No orders placed yet."
              />
            );
          return (
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="relative w-44 h-44 shrink-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Pie
                      data={segments}
                      dataKey="value"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {segments.map((s) => (
                        <Cell key={s.name} fill={s.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="text-2xl font-semibold tabular-nums">{fmtNumber(total)}</div>
                  <div className="text-xs text-muted-foreground">Total Orders</div>
                </div>
              </div>
              <ul className="flex-1 space-y-3 w-full">
                {segments.map((s) => {
                  const pct = total ? ((s.value / total) * 100).toFixed(1) : "0";
                  return (
                    <li key={s.name} className="flex items-center gap-3">
                      <span className={`w-3 h-3 rounded-sm shrink-0 ${s.swatch}`} />
                      <span className="text-sm flex-1 truncate">{s.name}</span>
                      <span className="text-sm font-medium tabular-nums">{s.value}</span>
                      <span className="text-xs text-muted-foreground tabular-nums w-20 text-right">
                        {filsToAed(s.fils)}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">
                        {pct}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })()
      )}
    </Card>
  );
}

function TopTailorsCard({
  period,
  setPeriod,
}: {
  period: "this_month" | "last_month" | "last_90_days";
  setPeriod: (p: "this_month" | "last_month" | "last_90_days") => void;
}) {
  const q = useTopTailors(period);
  return (
    <Card
      title="Top Tailors"
      action={
        <select
          value={period}
          onChange={(e) =>
            setPeriod(e.target.value as "this_month" | "last_month" | "last_90_days")
          }
          aria-label="Top tailors period"
          title="Top tailors period"
          className="text-xs border rounded px-2 py-1 bg-card"
        >
          <option value="this_month">This Month</option>
          <option value="last_month">Last Month</option>
          <option value="last_90_days">Last 90 Days</option>
        </select>
      }
    >
      {q.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} title="Couldn't load tailors" />
      ) : !q.data?.length ? (
        <NoData icon={IconScissors} title="No tailors yet" />
      ) : (
        <>
          <ul className="divide-y -mx-5">
            {q.data.map((t, i) => (
              <li
                key={t.tailor_id}
                className="flex items-center gap-3 px-5 py-2.5 hover:bg-muted/40"
              >
                <span className="w-5 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                <Avatar initials={initialsOf(t.name)} size={28} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.city}</div>
                </div>
                <Stars rating={t.rating_avg} />
                <div className="text-sm tabular-nums font-medium text-primary w-24 text-right">
                  {filsToAed(t.gmv_fils)}
                </div>
                <StatusBadge status={t.tier} />
              </li>
            ))}
          </ul>
          <div className="mt-3 -mx-5 -mb-5 px-5 py-3 border-t bg-muted/20">
            <Link to="/tailors" className="text-sm text-primary hover:underline">
              View all tailors →
            </Link>
          </div>
        </>
      )}
    </Card>
  );
}

function ActivityFeed() {
  const q = useActivityFeed();
  return (
    <Card
      title="Live Activity"
      action={
        <span className="flex items-center gap-1.5 text-xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
          </span>
          <span className="text-success font-medium">Live</span>
        </span>
      }
    >
      {q.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} title="Couldn't load activity" />
      ) : !q.data?.length ? (
        <NoData
          icon={IconActivity}
          title="No recent activity"
          description="Activity from the last 24 hours appears here."
        />
      ) : (
        <ul className="space-y-3 max-h-96 overflow-y-auto pr-1">
          {q.data.slice(0, 50).map((a) => (
            <ActivityRow key={a.id} event={a} />
          ))}
        </ul>
      )}
    </Card>
  );
}

const ACTIVITY_ICONS: Record<
  ActivityEvent["type"],
  { icon: TablerIcon; bg: string; text: string }
> = {
  tailor_registered: { icon: IconUserPlus, bg: "bg-success/10", text: "text-success" },
  order_placed: { icon: IconShoppingBag, bg: "bg-info/10", text: "text-info" },
  dispute_opened: {
    icon: IconAlertTriangle,
    bg: "bg-warning/15",
    text: "text-[oklch(0.40_0.10_75)]",
  },
  dispute_resolved: { icon: IconCheck, bg: "bg-success/10", text: "text-success" },
};

function ActivityRow({ event }: { event: ActivityEvent }) {
  const cfg = ACTIVITY_ICONS[event.type] ?? {
    icon: IconActivity,
    bg: "bg-muted",
    text: "text-muted-foreground",
  };
  const Icon = cfg.icon;
  return (
    <li className="flex items-start gap-3 animate-in fade-in slide-in-from-top-1">
      <div
        className={`w-9 h-9 rounded-full ${cfg.bg} ${cfg.text} flex items-center justify-center shrink-0`}
      >
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm">
          <span className="font-medium">{event.actor_name}</span> {event.description}
        </div>
        <div className="text-xs text-muted-foreground">{relTime(event.created_at)}</div>
      </div>
    </li>
  );
}
