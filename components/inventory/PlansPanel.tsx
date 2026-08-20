import { useState } from "react";
import { IconStar, IconChecks, IconCash } from "@tabler/icons-react";
import { Card } from "@/components/common/Page";
import { StatCard } from "@/components/common/StatCard";
import { ErrorState, NoData } from "@/components/common/AsyncStates";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { usePlans } from "@/lib/api/queries/inventory";
import { filsToAed, fmtNumber, aedCompact } from "@/lib/format";
import type { SubscriptionTier } from "@/lib/api/types";
import { PlanFormDialog } from "@/components/inventory/forms";

/**
 * Subscription plans admin panel. Lives here (not on the Inventory page) so all
 * tailor-facing monetization — plans, boosters, discounts, featured — sits on the
 * single Promotions page and stays easy to adjust in one place.
 */
export function PlansPanel({ canWrite }: { canWrite: boolean }) {
  const q = usePlans();
  const [edit, setEdit] = useState<SubscriptionTier | null>(null);

  if (q.isError)
    return <ErrorState error={q.error} onRetry={() => q.refetch()} title="Couldn't load plans" />;
  if (q.isLoading)
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-80 rounded-xl" />
        ))}
      </div>
    );
  const plans = q.data ?? [];
  if (plans.length === 0)
    return (
      <Card>
        <NoData icon={IconStar} title="No subscription tiers configured" />
      </Card>
    );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Tiers" value={plans.length} icon={IconStar} />
        <StatCard
          label="Active tailors"
          value={fmtNumber(plans.reduce((s, p) => s + Number(p.active_tailor_count), 0))}
          icon={IconChecks}
        />
        <StatCard
          label="Lowest commission"
          value={`${Math.min(...plans.map((p) => p.commission_rate_pct))}%`}
          icon={IconCash}
        />
        <StatCard
          label="Top price"
          value={aedCompact(Math.max(...plans.map((p) => p.monthly_price_fils)))}
          icon={IconCash}
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {plans.map((p) => (
          <PlanCard key={p.id} plan={p} canWrite={canWrite} onEdit={() => setEdit(p)} />
        ))}
      </div>
      {edit && <PlanFormDialog plan={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function PlanCard({
  plan,
  canWrite,
  onEdit,
}: {
  plan: SubscriptionTier;
  canWrite: boolean;
  onEdit: () => void;
}) {
  const accent =
    plan.monthly_price_fils === 0
      ? "text-primary"
      : plan.commission_rate_pct <= 8
        ? "text-warning"
        : "text-foreground";
  return (
    <div className="bg-card border rounded-xl p-6 space-y-4">
      <div>
        <div className="text-lg font-semibold">{plan.name}</div>
        <div className="text-xs text-muted-foreground">{plan.name_ar}</div>
      </div>
      <div>
        <div className={`text-3xl font-bold ${accent}`}>
          {plan.monthly_price_fils === 0 ? "Free" : filsToAed(plan.monthly_price_fils)}
        </div>
        {plan.monthly_price_fils > 0 && (
          <div className="text-xs text-muted-foreground">
            per month · {filsToAed(plan.annual_price_fils)} / year
          </div>
        )}
      </div>
      <div className="text-xs text-muted-foreground">
        <span className="inline-flex w-2 h-2 rounded-full bg-success mr-1" />
        {plan.active_tailor_count} active tailors
      </div>
      <ul className="text-sm space-y-1.5 border-t pt-4">
        <FeatureLine
          on
          label={`Max active listings: ${plan.max_active_listings === null ? "Unlimited" : plan.max_active_listings}`}
        />
        <FeatureLine on label={`Gallery photos: ${plan.max_portfolio_images ?? 5}`} />
        <FeatureLine on label={`Images per listing: ${plan.max_images_per_listing ?? 1}`} />
        <FeatureLine on label={`Commission rate: ${plan.commission_rate_pct}%`} />
        <FeatureLine
          on={plan.can_feature_listings}
          label={`Featured slots: ${plan.max_featured_slots || "None"}`}
        />
        <FeatureLine on={plan.priority_dispute_handling} label="Priority dispute handling" />
        <FeatureLine on={plan.verified_badge} label="Verified badge" />
        <FeatureLine on={plan.female_customer_eligible} label="Female customer access" />
      </ul>
      {canWrite && (
        <Button type="button" variant="outline" className="w-full" onClick={onEdit}>
          Edit Plan
        </Button>
      )}
    </div>
  );
}

function FeatureLine({ on, label }: { on: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className={on ? "text-success" : "text-muted-foreground"}>{on ? "✓" : "✕"}</span>
      <span className={on ? "" : "text-muted-foreground"}>{label}</span>
    </li>
  );
}
