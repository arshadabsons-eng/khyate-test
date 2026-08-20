import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { StatCard } from "@/components/common/StatCard";
import { Card } from "@/components/common/Page";
import { StatusBadge } from "@/components/common/StatusBadge";
import { CenteredSpinner, ErrorState, NoData } from "@/components/common/AsyncStates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTailorEarnings, useTailorPayouts, useRequestPayout } from "@/lib/api/queries/tailor";
import { filsToAed, aedCompact, fmtDate } from "@/lib/format";
import { IconWallet, IconHourglass, IconCash, IconBuildingBank, IconX } from "@tabler/icons-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { toast } from "sonner";

export const Route = createFileRoute("/tailor/earnings")({ component: EarningsPage });

function EarningsPage() {
  const q = useTailorEarnings();
  const payouts = useTailorPayouts();
  const request = useRequestPayout();
  const [showDialog, setShowDialog] = useState(false);
  const [bankName, setBankName] = useState("");
  const [iban, setIban] = useState("");

  if (q.isLoading) return <CenteredSpinner />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const e = q.data;
  const availableFils = e?.available_fils ?? 0;
  // Admin-configured minimum (marketplace_settings.payout_minimum_amount_fils),
  // read from the same /tailors/me/earnings response — falls back to the
  // backend's own default (10,000 fils = AED 100) if the field is missing.
  const payoutMinimumFils = e?.payout_minimum_fils ?? 10_000;
  const canRequest = availableFils >= payoutMinimumFils;

  // Zero-filled 30-day series so the chart always renders a real baseline.
  const days: string[] = [];
  {
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
  }
  const byDate = new Map(
    (e?.series ?? []).map((p: { date: string; earnings_fils: number }) => [
      p.date,
      Number(p.earnings_fils) || 0,
    ]),
  );
  const series30 = days.map((date) => ({ date, earnings_fils: byDate.get(date) ?? 0 }));
  const hasEarnings = series30.some((d) => d.earnings_fils > 0);

  // Param named `err` (not `e`) to avoid shadowing the `e` earnings-data
  // variable already in scope on this page.
  const mutationErrorToast = (fallback: string) => (err: unknown) =>
    toast.error((err as Error)?.message || fallback);

  function submitPayout() {
    if (!bankName.trim() || !iban.trim()) return;
    request.mutate(
      {
        amount_fils: availableFils,
        bank_name: bankName.trim(),
        iban: iban.trim().replace(/\s/g, ""),
      },
      {
        onSuccess: () => {
          setShowDialog(false);
          setBankName("");
          setIban("");
        },
        onError: mutationErrorToast("Couldn't submit payout request"),
      },
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Available" value={filsToAed(availableFils)} icon={IconWallet} money />
        <StatCard
          label="Pending"
          value={filsToAed(e?.pending_fils ?? 0)}
          icon={IconHourglass}
          money
        />
        <StatCard
          label="Lifetime earned"
          value={aedCompact(e?.lifetime_fils ?? 0)}
          icon={IconCash}
          money
        />
        <StatCard
          label="Last payout"
          value={e?.last_payout_at ? fmtDate(e.last_payout_at) : "—"}
          icon={IconBuildingBank}
        />
      </div>

      {(e?.debt_fils ?? 0) > 0 && (
        <div className="bg-warning/10 border border-warning/30 rounded-xl px-5 py-3 text-sm">
          <span className="font-medium">Refund adjustment owed: {filsToAed(e!.debt_fils)}.</span> A
          refund was issued on an order after you'd already withdrawn that amount — it's being
          automatically recovered from your next earnings before they become available, no action
          needed from you.
        </div>
      )}

      <div className="flex items-center justify-between bg-card border rounded-xl px-5 py-4">
        <div>
          <div className="font-medium">Request a payout</div>
          <div className="text-xs text-muted-foreground">
            Minimum {filsToAed(payoutMinimumFils)}. Processed within 2–3 business days to your bank
            account.
          </div>
        </div>
        <Button disabled={!canRequest} onClick={() => setShowDialog(true)}>
          {canRequest ? `Withdraw ${filsToAed(availableFils)}` : "Below minimum"}
        </Button>
      </div>

      {/* Payout dialog (inline — no portal needed) */}
      {showDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setShowDialog(false)}
        >
          <div
            className="bg-card border rounded-2xl p-6 w-full max-w-md shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold">Payout request</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setShowDialog(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <IconX size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg px-4 py-3 text-sm">
                <span className="text-muted-foreground">Amount:</span>{" "}
                <span className="font-semibold">{filsToAed(availableFils)}</span>
                <span className="text-xs text-muted-foreground ml-1">(full available balance)</span>
              </div>
              <div>
                <Label htmlFor="bank-name">Bank name</Label>
                <Input
                  id="bank-name"
                  className="mt-1"
                  placeholder="e.g. Emirates NBD"
                  value={bankName}
                  onChange={(ev) => setBankName(ev.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="iban">IBAN</Label>
                <Input
                  id="iban"
                  className="mt-1 font-mono"
                  placeholder="AE00 0000 0000 0000 0000 000"
                  value={iban}
                  onChange={(ev) => setIban(ev.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  UAE IBANs start with AE and are 23 characters.
                </p>
              </div>
              <div className="flex gap-3 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setShowDialog(false)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  disabled={!bankName.trim() || !iban.trim() || request.isPending}
                  onClick={submitPayout}
                >
                  {request.isPending ? "Submitting…" : "Request payout"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <Card title="Earnings — last 30 days">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={series30} margin={{ left: 4, right: 8, top: 8 }}>
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
              <Bar dataKey="earnings_fils" fill="var(--color-primary)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {!hasEarnings && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            No earnings in this period yet — completed, cleared orders will chart here.
          </p>
        )}
      </Card>

      <Card title="Payout history">
        {payouts.isError ? (
          <ErrorState
            error={payouts.error}
            onRetry={() => payouts.refetch()}
            title="Couldn't load payout history"
          />
        ) : payouts.isLoading ? (
          <CenteredSpinner />
        ) : !payouts.data?.length ? (
          <NoData
            icon={IconBuildingBank}
            title="No payouts yet"
            description="Your requested payouts will show up here."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="text-left py-2">Amount</th>
                <th className="text-left">Status</th>
                <th className="text-left">Bank</th>
                <th className="text-left">Requested</th>
                <th className="text-left">Processed</th>
              </tr>
            </thead>
            <tbody>
              {payouts.data.map((p) => (
                <tr key={p.id} className="border-t">
                  <td className="py-2 font-medium">{filsToAed(p.amount_fils)}</td>
                  <td>
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="text-muted-foreground text-xs">{p.bank_name ?? "—"}</td>
                  <td className="text-muted-foreground">{fmtDate(p.requested_at)}</td>
                  <td className="text-muted-foreground">
                    {p.processed_at ? fmtDate(p.processed_at) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
