import { createFileRoute } from "@tanstack/react-router";
import {
  IconCash,
  IconCoin,
  IconUsers,
  IconScissors,
  IconShoppingBag,
  IconTrendingUp,
} from "@tabler/icons-react";
import {
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ValueType, NameType } from "recharts/types/component/DefaultTooltipContent";
import { StatCard } from "@/components/common/StatCard";
import { Card, PageHeader } from "@/components/common/Page";
import { ErrorState, LoadingCards } from "@/components/common/AsyncStates";
import { useOwnerMetrics } from "@/lib/api/queries/admins";
import { aedCompact, filsToAed, fmtNumber, fmtDate } from "@/lib/format";

export const Route = createFileRoute("/_app/owner")({ component: OwnerDashboard });

// A deliberately tiny, read-only surface for owners/investors: money + counts only,
// no operational pages, no actions. Commission here is the platform's own revenue.
function OwnerDashboard() {
  const q = useOwnerMetrics();

  return (
    <div className="space-y-6 kh-section">
      <PageHeader
        title="Owner Dashboard"
        description={`Today · ${new Date().toLocaleDateString("en-AE", { day: "2-digit", month: "long", year: "numeric" })}`}
      />

      {q.isLoading ? (
        <LoadingCards count={6} />
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} title="Couldn't load metrics" />
      ) : (
        <Body />
      )}
    </div>
  );

  function Body() {
    const m = q.data!;
    const cards = [
      {
        label: "Platform Revenue · This Month",
        value: filsToAed(m.revenue_fils.mtd),
        icon: IconCash,
        sub: `${filsToAed(m.revenue_fils.today)} today`,
        money: true,
      },
      {
        label: "GMV · This Month",
        value: filsToAed(m.gmv_fils.mtd),
        icon: IconCoin,
        sub: `${filsToAed(m.gmv_fils.today)} today`,
        money: true,
      },
      {
        label: "Revenue · All Time",
        value: filsToAed(m.revenue_fils.total),
        icon: IconTrendingUp,
        money: true,
      },
      { label: "Total Customers", value: fmtNumber(m.customer_count), icon: IconUsers },
      {
        label: "Active Tailors",
        value: fmtNumber(m.tailor_count_active),
        icon: IconScissors,
        sub: `${fmtNumber(m.tailor_count_total)} total`,
      },
      {
        label: "Orders · This Month",
        value: fmtNumber(m.orders.mtd),
        icon: IconShoppingBag,
        sub: `${fmtNumber(m.orders.today)} today`,
      },
    ];
    return (
      <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 kh-stagger">
          {cards.map((c) => (
            <StatCard
              key={c.label}
              label={c.label}
              value={c.value}
              suffix={c.sub}
              icon={c.icon}
              money={(c as { money?: boolean }).money}
            />
          ))}
        </div>

        <Card className="p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold">Revenue & GMV — last 12 weeks</h2>
            <p className="text-sm text-muted-foreground">
              Weekly platform revenue against marketplace volume.
            </p>
          </div>
          {m.trend.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">No activity yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={300} minWidth={0}>
              <AreaChart data={m.trend} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="ownerGmv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="ownerRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="week"
                  tickFormatter={(w) => fmtDate(w)}
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                />
                <YAxis
                  tickFormatter={(v) => aedCompact(v)}
                  tick={{ fontSize: 11 }}
                  stroke="var(--muted-foreground)"
                  width={64}
                />
                <Tooltip
                  formatter={(v: ValueType | undefined, name: NameType | undefined) => [
                    filsToAed(Number(v)),
                    name === "gmv_fils" ? "GMV" : "Revenue",
                  ]}
                  labelFormatter={(w) => fmtDate(w as string)}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Area
                  type="monotone"
                  dataKey="gmv_fils"
                  stroke="var(--chart-1)"
                  fill="url(#ownerGmv)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="revenue_fils"
                  stroke="var(--chart-2)"
                  fill="url(#ownerRev)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>
      </>
    );
  }
}
