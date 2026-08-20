import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  IconRocket,
  IconCheck,
  IconTrendingUp,
  IconUsers,
  IconSparkles,
} from "@tabler/icons-react";
import { Card } from "@/components/common/Page";
import { CenteredSpinner, ErrorState } from "@/components/common/AsyncStates";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  useTailorSubscription,
  useBoosts,
  usePurchaseBoost,
  useChangePlan,
} from "@/lib/api/queries/tailor";
import { usePlans } from "@/lib/api/queries/inventory";
import { filsToAed, fmtDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/tailor/subscription")({ component: SubscriptionPage });

function Bar({ used, max }: { used: number; max: number | null }) {
  const pct = max === null ? 30 : Math.min(100, (used / Math.max(max, 1)) * 100);
  return (
    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
      <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
    </div>
  );
}

function SubscriptionPage() {
  const sub = useTailorSubscription();
  const plans = usePlans();
  const changePlan = useChangePlan();
  // Confirm before switching — a plan change moves the tailor's commission
  // rate and listing caps with one click; previously there was no acknowledgment
  // step at all.
  const [pendingPlan, setPendingPlan] = useState<{ id: string; name: string } | null>(null);

  if (sub.isLoading) return <CenteredSpinner />;
  if (sub.isError) return <ErrorState error={sub.error} onRetry={() => sub.refetch()} />;
  const s = sub.data?.current;
  const u = s?.usage;

  const doSwitch = (id: string, name: string) =>
    changePlan.mutate(id, {
      onSuccess: () => {
        toast.success(`Switched to ${name}`);
        setPendingPlan(null);
      },
      onError: (e: unknown) => {
        toast.error((e as Error)?.message || "Couldn't change plan");
        setPendingPlan(null);
      },
    });

  return (
    <div className="space-y-6">
      <Card title={s ? `Current plan — ${s.tier}` : "No plan yet"}>
        {s ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-muted-foreground">
                {s.billing_cycle}
                {/* current_period_end is only ever populated once the
                    expiry/renewal work lands — showing "renews —" for every
                    tailor was worse than just omitting it. */}
                {s.current_period_end ? ` · renews ${fmtDate(s.current_period_end)}` : ""}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Usage
                label="Active listings"
                used={u?.active_listings ?? 0}
                max={u?.max_active_listings ?? null}
              />
              <Usage
                label="Portfolio images"
                used={u?.portfolio_images ?? 0}
                max={u?.max_portfolio_images ?? 0}
              />
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Choose a plan below to set your commission rate and listing limits.
          </p>
        )}
      </Card>

      <div>
        <h3 className="font-semibold mb-3">Compare plans</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Retired plans can't be switched to (backend rejects with 404),
              so only show them if they're the tailor's current plan. */}
          {(plans.data ?? [])
            .filter((p) => p.is_active || p.name === s?.tier)
            .map((p) => {
              const current = p.name === s?.tier;
              return (
                <div
                  key={p.id}
                  className={`bg-card border rounded-xl p-6 space-y-3 ${current ? "ring-2 ring-primary" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-semibold">{p.name}</div>
                    {current && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary text-primary-foreground">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="text-2xl font-bold">
                    {filsToAed(p.monthly_price_fils)}
                    <span className="text-xs text-muted-foreground font-normal"> /mo</span>
                  </div>
                  <ul className="text-sm space-y-1.5 text-muted-foreground border-t pt-3">
                    <li>{p.commission_rate_pct}% commission</li>
                    <li>
                      {p.max_active_listings === null ? "Unlimited" : p.max_active_listings}{" "}
                      listings
                    </li>
                    <li>{p.max_portfolio_images ?? 5} portfolio photos</li>
                  </ul>
                  {!current && (
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={changePlan.isPending}
                      onClick={() => setPendingPlan({ id: p.id, name: p.name })}
                    >
                      {p.monthly_price_fils >
                      (plans.data?.find((x) => x.name === s?.tier)?.monthly_price_fils ?? 0)
                        ? "Upgrade"
                        : "Switch"}
                    </Button>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      <BoostSection />

      {pendingPlan && (
        <ConfirmDialog
          open
          onOpenChange={(v) => !v && setPendingPlan(null)}
          title={`Switch to ${pendingPlan.name}?`}
          description={`Your commission rate and listing limits will change to match ${pendingPlan.name} immediately. No payment is collected in demo mode.`}
          confirmLabel="Switch plan"
          onConfirm={() => doSwitch(pendingPlan.id, pendingPlan.name)}
        />
      )}
    </div>
  );
}

function BoostSection() {
  const q = useBoosts();
  const purchase = usePurchaseBoost();
  const [pendingBoost, setPendingBoost] = useState<{
    id: string;
    name: string;
    price_fils: number;
  } | null>(null);
  if (q.isLoading) return <CenteredSpinner />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const current = q.data?.current ?? null;
  const products = q.data?.products ?? [];

  const buy = (id: string, name: string) =>
    purchase.mutate(id, {
      onSuccess: () => {
        toast.success(`"${name}" boost is now active`);
        setPendingBoost(null);
      },
      onError: (e: unknown) => {
        toast.error((e as Error)?.message || "Couldn't start boost");
        setPendingBoost(null);
      },
    });

  return (
    <Card title="Featured placement" action={<IconRocket size={18} className="text-gold" />}>
      {/* Upsell hero — sells the value to the tailor as a buyer (tasteful, brand-aligned) */}
      <div className="rounded-2xl border border-primary/10 bg-gradient-to-br from-primary-soft via-ivory to-[#F2EEE4] p-5 sm:p-6 mb-5">
        <span className="inline-block text-[11px] uppercase tracking-[0.16em] text-gold font-medium mb-2">
          Add-on · not part of your plan
        </span>
        <h3 className="font-serif text-xl sm:text-2xl">Get seen first</h3>
        <p className="text-sm text-foreground/80 mt-1.5 max-w-xl">
          For the period you choose, your storefront and pieces appear ahead of others when
          customers browse and search Khyate. Subtle and tasteful — never a loud ad.
        </p>
        <ul className="mt-4 grid sm:grid-cols-3 gap-3 text-sm">
          <Benefit
            icon={IconTrendingUp}
            title="Top of browse & search"
            body="Rank above non-featured tailors."
          />
          <Benefit
            icon={IconUsers}
            title="Reach more shoppers"
            body="More eyes on your work, more orders."
          />
          <Benefit
            icon={IconSparkles}
            title="Premium for the period"
            body="Stays featured the whole time."
          />
        </ul>
      </div>

      {current && (
        <div className="mb-5 rounded-xl border border-primary/30 bg-primary/5 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-primary/15 text-primary grid place-items-center shrink-0">
            <IconCheck size={18} />
          </div>
          <div className="text-sm">
            <div className="font-medium">
              You're featured{current.name ? ` · ${current.name}` : ""}
            </div>
            <div className="text-muted-foreground">Active until {fmtDate(current.ends_at)}</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((p) => {
          const perDay =
            p.duration_days > 0 ? Math.round(p.price_fils / p.duration_days) : p.price_fils;
          return (
            <div key={p.id} className="rounded-xl border bg-card p-5 flex flex-col kh-elevate">
              <div className="font-serif font-semibold">{p.name}</div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-primary">{filsToAed(p.price_fils)}</span>
                <span className="text-xs text-muted-foreground">/ {p.duration_days} days</span>
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                ≈ {filsToAed(perDay)} per day of featuring
              </div>
              <Button
                className="w-full mt-4"
                variant={current ? "outline" : "default"}
                disabled={purchase.isPending}
                onClick={() =>
                  setPendingBoost({ id: p.id, name: p.name, price_fils: p.price_fils })
                }
              >
                {purchase.isPending ? "Starting…" : current ? "Extend featuring" : "Get featured"}
              </Button>
            </div>
          );
        })}
        {products.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No featured-placement options available right now.
          </p>
        )}
      </div>

      {pendingBoost && (
        <ConfirmDialog
          open
          onOpenChange={(v) => !v && setPendingBoost(null)}
          title={current ? "Extend featuring?" : "Get featured?"}
          description={`"${pendingBoost.name}" — ${filsToAed(pendingBoost.price_fils)}. No payment is collected in demo mode.`}
          confirmLabel={current ? "Extend" : "Get featured"}
          onConfirm={() => buy(pendingBoost.id, pendingBoost.name)}
        />
      )}
    </Card>
  );
}

function Benefit({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof IconRocket;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-2.5">
      <Icon size={18} className="text-primary shrink-0 mt-0.5" />
      <div>
        <div className="font-medium text-foreground/90 leading-tight">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{body}</div>
      </div>
    </li>
  );
}

function Usage({ label, used, max }: { label: string; used: number; max: number | null }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">
          {used} / {max === null ? "∞" : max}
        </span>
      </div>
      <Bar used={used} max={max} />
    </div>
  );
}
