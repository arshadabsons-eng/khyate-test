import { createFileRoute, Link } from "@tanstack/react-router";
import { StatCard } from "@/components/common/StatCard";
import { Card } from "@/components/common/Page";
import { StatusBadge } from "@/components/common/StatusBadge";
import { CenteredSpinner, ErrorState } from "@/components/common/AsyncStates";
import { useTailorSummary, useTailorEarnings, useTailorOrders } from "@/lib/api/queries/tailor";
import { filsToAed, aedCompact, fmtDate, fmtNumber } from "@/lib/format";
import {
  IconShoppingBag,
  IconClock,
  IconCash,
  IconWallet,
  IconStar,
  IconCalendar,
} from "@tabler/icons-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export const Route = createFileRoute("/tailor/")({ component: TailorDashboard });

// Build a continuous run of the last `n` ISO dates (oldest → newest) so charts
// always render a real, honest baseline (zero where there's no activity) instead
// of collapsing to an empty placeholder for a new tailor.
function lastDays(n: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function TailorDashboard() {
  const summary = useTailorSummary();
  const earnings = useTailorEarnings();
  // Filtered server-side (not client-side) so this agrees with the "Open
  // orders" KPI above — a true COUNT(*) over the same two statuses — instead
  // of silently dropping older pending/confirmed orders once the tailor has
  // 20+ more-recent orders of other statuses.
  const orders = useTailorOrders("pending,confirmed");

  if (summary.isLoading) return <CenteredSpinner />;
  if (summary.isError)
    return <ErrorState error={summary.error} onRetry={() => summary.refetch()} />;
  const s = summary.data;
  const queue = orders.data?.data ?? [];

  // Zero-filled 30-day series — real data merged over a continuous date axis.
  const days = lastDays(30);
  const earnByDate = new Map((earnings.data?.series ?? []).map((p) => [p.date, p.earnings_fils]));
  const earnSeries = days.map((date) => ({ date, earnings_fils: earnByDate.get(date) ?? 0 }));
  const ordByDate = new Map((earnings.data?.orders_series ?? []).map((p) => [p.date, p]));
  const ordSeries = days.map((date) => ({
    date,
    orders: ordByDate.get(date)?.orders ?? 0,
    gmv_fils: ordByDate.get(date)?.gmv_fils ?? 0,
  }));
  const hasEarnings = earnSeries.some((d) => d.earnings_fils > 0);
  const hasOrders = ordSeries.some((d) => d.orders > 0);

  return (
    <div className="space-y-6 kh-stagger">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Open orders" value={s?.open_orders ?? 0} icon={IconShoppingBag} />
        <StatCard label="In progress" value={s?.in_progress ?? 0} icon={IconClock} />
        <StatCard
          label="This month GMV"
          value={aedCompact(s?.month_gmv_fils ?? 0)}
          icon={IconCash}
          money
        />
        <StatCard
          label="Available balance"
          value={filsToAed(s?.available_fils ?? 0)}
          icon={IconWallet}
          money
        />
        <StatCard
          label="Rating"
          value={s?.rating_avg ?? 0}
          suffix={`★ · ${s?.rating_count ?? 0}`}
          icon={IconStar}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Earnings — last 30 days" className="lg:col-span-2">
          <div className="h-64 min-h-64">
            <ResponsiveContainer width="100%" height={256} minWidth={0}>
              <AreaChart data={earnSeries} margin={{ left: 4, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="earn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(d: string) => d.slice(5)}
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => aedCompact(v)}
                  width={60}
                />
                <Tooltip
                  formatter={(v: unknown) => filsToAed(Number(v))}
                  labelFormatter={(l: unknown) => fmtDate(String(l))}
                />
                <Area
                  type="monotone"
                  dataKey="earnings_fils"
                  stroke="var(--color-primary)"
                  fill="url(#earn)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {earnings.isError ? (
            <p className="text-xs text-destructive text-center mt-2">
              Couldn't load earnings —{" "}
              <button className="underline" onClick={() => earnings.refetch()}>
                retry
              </button>
              .
            </p>
          ) : (
            !hasEarnings && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                No earnings in this period yet — completed orders will chart here.
              </p>
            )
          )}
        </Card>

        <Card title="Needs your action">
          <div className="space-y-3">
            <Link
              to="/tailor/appointments"
              className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/40"
            >
              <IconCalendar size={20} className="text-primary" />
              <div className="flex-1">
                <div className="text-sm font-medium">
                  {s?.pending_appointments ?? 0} measurement appointments
                </div>
                <div className="text-xs text-muted-foreground">Upcoming bookings to fulfil</div>
              </div>
            </Link>
            {orders.isError ? (
              <p className="text-sm text-destructive py-4 text-center">
                Couldn't load orders —{" "}
                <button className="underline" onClick={() => orders.refetch()}>
                  retry
                </button>
                .
              </p>
            ) : queue.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No orders awaiting confirmation.
              </p>
            ) : (
              queue.slice(0, 5).map((o) => (
                <Link
                  key={o.id}
                  to="/tailor/orders/$id"
                  params={{ id: o.id }}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/40"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {o.order_number} · {o.customer_name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {filsToAed(o.total_fils)} · {fmtDate(o.created_at)}
                    </div>
                  </div>
                  <StatusBadge status={o.status} />
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Orders — last 30 days">
          <div className="h-56 min-h-56">
            <ResponsiveContainer width="100%" height={224} minWidth={0}>
              <BarChart data={ordSeries} margin={{ left: 4, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(d: string) => d.slice(5)}
                  minTickGap={24}
                />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} width={32} />
                <Tooltip
                  formatter={(v: unknown) => [fmtNumber(Number(v)), "Orders"]}
                  labelFormatter={(l: unknown) => fmtDate(String(l))}
                />
                <Bar dataKey="orders" fill="var(--color-primary)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {earnings.isError ? (
            <p className="text-xs text-destructive text-center mt-2">
              Couldn't load orders —{" "}
              <button className="underline" onClick={() => earnings.refetch()}>
                retry
              </button>
              .
            </p>
          ) : (
            !hasOrders && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                No orders in this period yet.
              </p>
            )
          )}
        </Card>

        <Card title="GMV — last 30 days">
          <div className="h-56 min-h-56">
            <ResponsiveContainer width="100%" height={224} minWidth={0}>
              <AreaChart data={ordSeries} margin={{ left: 4, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="gmv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(d: string) => d.slice(5)}
                  minTickGap={24}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => aedCompact(v)}
                  width={60}
                />
                <Tooltip
                  formatter={(v: unknown) => [filsToAed(Number(v)), "GMV"]}
                  labelFormatter={(l: unknown) => fmtDate(String(l))}
                />
                <Area
                  type="monotone"
                  dataKey="gmv_fils"
                  stroke="var(--chart-2)"
                  fill="url(#gmv)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
