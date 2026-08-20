import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  IconSettings,
  IconUserCheck,
  IconFileText,
  IconShieldLock,
  IconPlug,
  IconCheck,
  IconRefresh,
  IconX,
  IconBuildingStore,
  IconCrown,
  IconPencil,
  IconPlus,
  IconChevronDown,
} from "@tabler/icons-react";
import {
  usePlatformSettings,
  useOnboardingSettings,
  usePolicySettings,
  useSecuritySettings,
  useIntegrationSettings,
  useMarketplaceSettings,
  useUpdatePlatformSettings,
  useUpdateOnboardingSettings,
  useUpdatePolicySettings,
  useUpdateSecuritySettings,
  useUpdateIntegrationSettings,
  useUpdateMarketplaceSettings,
  useTestIntegration,
} from "@/lib/api/queries/settings";
import {
  useSubscriptionPlansAll,
  useSubscriptionStats,
  useCreateSubscriptionPlan,
  useUpdateSubscriptionPlan,
} from "@/lib/api/queries/subscriptions";
import { Card } from "@/components/common/Page";
import { CenteredSpinner, ErrorState } from "@/components/common/AsyncStates";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { filsToAed } from "@/lib/format";
import { LiquidTabs } from "@/components/common/LiquidTabs";
import type {
  PlatformSettings,
  OnboardingSettings,
  PolicySettings,
  SecuritySettings,
  IntegrationSettings,
  MarketplaceSettings,
  SubscriptionPlan,
  MaintenanceScope,
} from "@/lib/api/types";

export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });

const TABS = [
  { id: "platform", label: "Platform", icon: IconSettings },
  { id: "onboarding", label: "Onboarding", icon: IconUserCheck },
  { id: "marketplace", label: "Marketplace", icon: IconBuildingStore },
  { id: "subscriptions", label: "Subscriptions", icon: IconCrown },
  { id: "policies", label: "Policies", icon: IconFileText },
  { id: "security", label: "Security", icon: IconShieldLock },
  { id: "integrations", label: "Integrations", icon: IconPlug },
] as const;

type TabId = (typeof TABS)[number]["id"];

function SettingsPage() {
  const [tab, setTab] = useState<TabId>("platform");

  return (
    <div>
      <LiquidTabs tabs={TABS} value={tab} onChange={(id) => setTab(id as TabId)} className="mb-6" />

      {tab === "platform" && <PlatformTab />}
      {tab === "onboarding" && <OnboardingTab />}
      {tab === "marketplace" && <MarketplaceTab />}
      {tab === "subscriptions" && <SubscriptionsTab />}
      {tab === "policies" && <PoliciesTab />}
      {tab === "security" && <SecurityTab />}
      {tab === "integrations" && <IntegrationsTab />}
    </div>
  );
}

// <input type="datetime-local"> speaks local wall-clock time with no zone;
// we persist ISO/UTC so the backend and every client agree on the instant.
function toLocalInput(iso: string | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(v: string): string {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function useDirty<T extends Record<string, unknown>>(original: T | undefined) {
  const [local, setLocal] = useState<T | null>(null);
  useEffect(() => {
    if (original && !local) setLocal(original);
  }, [original]);
  const isDirty = local !== null && JSON.stringify(local) !== JSON.stringify(original);
  return { local, setLocal, isDirty };
}

// ── Platform ─────────────────────────────────────────────────────────────────

function PlatformTab() {
  const q = usePlatformSettings();
  const update = useUpdatePlatformSettings();
  const { local, setLocal, isDirty } = useDirty<PlatformSettings>(q.data);
  const [confirmMaintenance, setConfirmMaintenance] = useState(false);

  if (q.isLoading) return <CenteredSpinner />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!local) return null;

  const save = () =>
    update.mutate(local, { onSuccess: () => toast.success("Platform settings saved") });

  return (
    <>
      <div className="w-full space-y-6">
        <Card title="General">
          <div className="space-y-4">
            <Field label="Platform Name">
              <Input
                value={local.platform_name}
                onChange={(e) => setLocal({ ...local, platform_name: e.target.value })}
              />
            </Field>
            <Field label="Support Email">
              <Input
                type="email"
                value={local.support_email}
                onChange={(e) => setLocal({ ...local, support_email: e.target.value })}
              />
            </Field>
            <Field label="Support Phone">
              <Input
                value={local.support_phone}
                onChange={(e) => setLocal({ ...local, support_phone: e.target.value })}
              />
            </Field>
          </div>
        </Card>
        <Card title="Image limits">
          <p className="text-sm text-muted-foreground">
            Image caps are set per subscription plan, not globally — see{" "}
            <Link to="/promotions" className="text-primary hover:underline">
              Promotions → Subscription Plans
            </Link>{" "}
            (opens on the Subscription Plans tab) to change how many listing/portfolio photos each
            tier allows.
          </p>
        </Card>

        <Card title="Scheduled maintenance">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Plan downtime in advance. Users see a countdown banner (&quot;unavailable from … to
              …&quot;) before it starts, instead of hitting an unexpected wall. Admins and staff are
              never blocked.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Starts">
                <Input
                  type="datetime-local"
                  value={toLocalInput(local.maintenance_scheduled_start)}
                  onChange={(e) =>
                    setLocal({
                      ...local,
                      maintenance_scheduled_start: fromLocalInput(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Ends">
                <Input
                  type="datetime-local"
                  value={toLocalInput(local.maintenance_scheduled_end)}
                  onChange={(e) =>
                    setLocal({
                      ...local,
                      maintenance_scheduled_end: fromLocalInput(e.target.value),
                    })
                  }
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Who is affected">
                <Select
                  value={local.maintenance_scope}
                  onValueChange={(v) =>
                    setLocal({ ...local, maintenance_scope: v as MaintenanceScope })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="customers">Customers only (tailors keep working)</SelectItem>
                    <SelectItem value="tailors">Tailors only (shopfront stays open)</SelectItem>
                    <SelectItem value="both">Everyone (full marketplace shutdown)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Warn users this many hours ahead">
                <Input
                  type="number"
                  min={0}
                  value={local.maintenance_notice_hours}
                  onChange={(e) =>
                    setLocal({ ...local, maintenance_notice_hours: Number(e.target.value) || 0 })
                  }
                />
              </Field>
            </div>
            <Field label="Message shown to users (optional)">
              <Input
                value={local.maintenance_message}
                onChange={(e) => setLocal({ ...local, maintenance_message: e.target.value })}
                placeholder="We're upgrading Khyate — back shortly."
              />
            </Field>
            {local.maintenance_scheduled_start && local.maintenance_scheduled_end && (
              <p className="text-xs text-muted-foreground">
                Scheduled: {new Date(local.maintenance_scheduled_start).toLocaleString()} →{" "}
                {new Date(local.maintenance_scheduled_end).toLocaleString()}. Clear both dates to
                cancel.
              </p>
            )}
          </div>
        </Card>

        <Card title="Emergency shutdown">
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4">
            <div className="flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  Take the platform offline now
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  Immediate and indefinite, with no advance warning to users — for incidents only.
                  For planned work, use Scheduled maintenance above. Respects the same &quot;who is
                  affected&quot; setting; admins are never blocked.
                </p>
              </div>
              <Switch
                checked={local.maintenance_mode}
                onCheckedChange={(v) => {
                  if (v) {
                    setConfirmMaintenance(true);
                  } else {
                    setLocal({ ...local, maintenance_mode: false });
                  }
                }}
              />
            </div>
            {local.maintenance_mode && (
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mt-3 flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                Platform is currently offline (
                {local.maintenance_scope === "both" ? "everyone" : local.maintenance_scope} blocked)
              </p>
            )}
          </div>
        </Card>

        <Card title="Mobile app updates">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The customer app checks its build number on launch. Below{" "}
              <span className="font-medium text-foreground">Min. required build</span> it's
              force-blocked until updated; below{" "}
              <span className="font-medium text-foreground">Latest build</span> it's nudged but can
              be dismissed. Leave both at 1 to never prompt anyone.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Min. required build" description="Forces an update below this build.">
                <Input
                  type="number"
                  min={1}
                  value={local.app_min_build}
                  onChange={(e) =>
                    setLocal({ ...local, app_min_build: Number(e.target.value) || 1 })
                  }
                  className="w-32"
                />
              </Field>
              <Field label="Latest build" description="Nudges an optional update below this build.">
                <Input
                  type="number"
                  min={1}
                  value={local.app_latest_build}
                  onChange={(e) =>
                    setLocal({ ...local, app_latest_build: Number(e.target.value) || 1 })
                  }
                  className="w-32"
                />
              </Field>
            </div>
            <Field
              label="Update URL"
              description="Where the update prompt sends users (store listing)."
            >
              <Input
                value={local.app_update_url}
                onChange={(e) => setLocal({ ...local, app_update_url: e.target.value })}
              />
            </Field>
            <Field label="Update message (optional)">
              <Input
                value={local.app_update_message}
                onChange={(e) => setLocal({ ...local, app_update_message: e.target.value })}
                placeholder="A new version of Khyate is available."
              />
            </Field>
          </div>
        </Card>

        <Card title="Staff perks">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Waive delivery fee for staff</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                When on, any admin/staff account flagged as a perk recipient (set per-person from
                the Admins page) has their delivery fee waived when they check out as a customer.
                Never affects a tailor&apos;s own earnings — only the platform&apos;s own delivery
                charge. Off by default; flip this to disable the perk everywhere instantly,
                regardless of who's flagged.
              </p>
            </div>
            <Switch
              checked={local.staff_discount_enabled}
              onCheckedChange={(v) => setLocal({ ...local, staff_discount_enabled: v })}
            />
          </div>
        </Card>

        <SaveBar
          dirty={isDirty}
          onSave={save}
          onReset={() => setLocal(q.data!)}
          saving={update.isPending}
        />
      </div>

      <ConfirmDialog
        open={confirmMaintenance}
        onOpenChange={setConfirmMaintenance}
        title="Enable maintenance mode?"
        description="This will be staged — click Save Changes below to apply it. Once saved, it blocks all customer and tailor access; only admins will be able to log in. Make sure you have communicated downtime before saving."
        confirmLabel="Yes, take platform offline"
        destructive
        onConfirm={() => {
          setLocal((l) => l && { ...l, maintenance_mode: true });
          setConfirmMaintenance(false);
        }}
      />
    </>
  );
}

// ── Onboarding ────────────────────────────────────────────────────────────────

function OnboardingTab() {
  const q = useOnboardingSettings();
  const update = useUpdateOnboardingSettings();
  const { local, setLocal, isDirty } = useDirty<OnboardingSettings>(q.data);

  if (q.isLoading) return <CenteredSpinner />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!local) return null;

  return (
    <div className="w-full space-y-6">
      <Card title="Document Requirements">
        <div className="space-y-3">
          <SwitchField
            label="Require Trade License"
            checked={local.require_trade_license}
            onChange={(v) => setLocal({ ...local, require_trade_license: v })}
          />
          <SwitchField
            label="Require National ID"
            checked={local.require_national_id}
            onChange={(v) => setLocal({ ...local, require_national_id: v })}
          />
          <SwitchField
            label="Require Portfolio Certificate"
            checked={local.require_portfolio_certificate}
            onChange={(v) => setLocal({ ...local, require_portfolio_certificate: v })}
          />
          <SwitchField
            label="Require Phone Verification"
            description="Phone SMS verification costs money per message with every provider (D7, Twilio, Firebase). Turn off to require only a verified email for tailor activation."
            checked={local.require_phone_verification}
            onChange={(v) => setLocal({ ...local, require_phone_verification: v })}
          />
          <SwitchField
            label="Require Email Verification"
            description="Email verification is sent via SMTP. If the relay isn't configured yet, no tailor can ever complete this — turn off only as a temporary bridge while SMTP is being set up, and turn back on once real mail delivery is confirmed working."
            checked={local.require_email_verification}
            onChange={(v) => setLocal({ ...local, require_email_verification: v })}
          />
          <SwitchField
            label="Require Customer Email Verification"
            description="Separate from tailor verification above — gates a customer's first order (not signup or browsing) on a verified email. Turn off only as a temporary bridge while SMTP is being set up."
            checked={local.require_customer_email_verification}
            onChange={(v) => setLocal({ ...local, require_customer_email_verification: v })}
          />
          <SwitchField
            label="Auto-Approve Verified Tailors"
            description="Automatically approve re-submissions from previously verified tailors."
            checked={local.auto_approve_verified_tailors}
            onChange={(v) => setLocal({ ...local, auto_approve_verified_tailors: v })}
          />
        </div>
      </Card>
      <Card title="Requirements">
        <div className="space-y-4">
          <Field label="Min. Portfolio Images">
            <Input
              type="number"
              value={local.min_portfolio_images}
              onChange={(e) => setLocal({ ...local, min_portfolio_images: Number(e.target.value) })}
              className="w-32"
            />
          </Field>
          <Field label="Welcome Message (English)">
            <Textarea
              rows={3}
              value={local.welcome_message_en}
              onChange={(e) => setLocal({ ...local, welcome_message_en: e.target.value })}
            />
          </Field>
          <Field label="Welcome Message (Arabic)">
            <Textarea
              rows={3}
              dir="rtl"
              value={local.welcome_message_ar}
              onChange={(e) => setLocal({ ...local, welcome_message_ar: e.target.value })}
            />
          </Field>
        </div>
      </Card>
      <SaveBar
        dirty={isDirty}
        onSave={() =>
          update.mutate(local, { onSuccess: () => toast.success("Onboarding settings saved") })
        }
        onReset={() => setLocal(q.data!)}
        saving={update.isPending}
      />
    </div>
  );
}

// ── Marketplace ───────────────────────────────────────────────────────────────

function MarketplaceTab() {
  const q = useMarketplaceSettings();
  const update = useUpdateMarketplaceSettings();
  const { local, setLocal, isDirty } = useDirty<MarketplaceSettings>(q.data);

  if (q.isLoading) return <CenteredSpinner />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!local) return null;

  return (
    <div className="w-full space-y-6">
      <Card title="Promotions & Discounts">
        <p className="text-xs text-muted-foreground mb-4">
          Tailors create their own promotions; the platform caps how long and how deep they can go.
        </p>
        <div className="space-y-4">
          <Field
            label="Max Promotion Duration (days)"
            description="Longest a tailor's promotion may run."
          >
            <Input
              type="number"
              value={local.max_promotion_duration_days}
              onChange={(e) =>
                setLocal({ ...local, max_promotion_duration_days: Number(e.target.value) })
              }
              className="w-32"
            />
          </Field>
          <Field label="Max Discount (%)" description="Ceiling on any single tailor discount.">
            <Input
              type="number"
              value={local.max_discount_percentage}
              onChange={(e) =>
                setLocal({ ...local, max_discount_percentage: Number(e.target.value) })
              }
              className="w-32"
            />
          </Field>
        </div>
      </Card>

      <Card title="Material Sales">
        <SwitchField
          label="Require Approval for Material Sales"
          description="Tailors must be approved before selling fabrics by the metre. They can still stitch with catalog materials freely."
          checked={local.tailor_material_sale_requires_approval}
          onChange={(v) => setLocal({ ...local, tailor_material_sale_requires_approval: v })}
        />
      </Card>

      <Card title="Measurements">
        <div className="space-y-3">
          <SwitchField
            label="Measurement Appointments"
            description="Customers can book an in-shop slot for a tailor to measure them."
            checked={local.measurement_appointments_enabled}
            onChange={(v) => setLocal({ ...local, measurement_appointments_enabled: v })}
          />
          <SwitchField
            label="Home-Visit Measurements"
            description="Allow tailors to offer measurement at the customer's home."
            checked={local.home_visit_measurement_enabled}
            onChange={(v) => setLocal({ ...local, home_visit_measurement_enabled: v })}
          />
          <Field
            label="Platform cut on home-visit fee (%)"
            description="Khyate's share of the tailor's home-visit fee. In-shop measurement is always free. Set 0 to take nothing."
          >
            <Input
              type="number"
              min={0}
              max={100}
              value={local.home_service_platform_cut_pct ?? 0}
              onChange={(e) =>
                setLocal({
                  ...local,
                  home_service_platform_cut_pct: Math.min(
                    100,
                    Math.max(0, Number(e.target.value) || 0),
                  ),
                })
              }
              className="w-32"
            />
          </Field>
        </div>
      </Card>

      <Card title="Delivery">
        <div className="space-y-3">
          <SwitchField
            label="Enable Delivery"
            description="Use partner couriers to move garments between tailor and customer."
            checked={local.delivery_enabled}
            onChange={(v) => setLocal({ ...local, delivery_enabled: v })}
          />
          <SwitchField
            label="Customer Pays Delivery Surcharge"
            description="Charge the customer for delivery instead of absorbing it."
            checked={local.delivery_customer_pays_surcharge}
            onChange={(v) => setLocal({ ...local, delivery_customer_pays_surcharge: v })}
          />
          <Field
            label="Max Delivery Surcharge (AED)"
            description="Cap on the courier fee passed to customers."
          >
            <Input
              type="number"
              value={local.max_delivery_surcharge_fils / 100 || 0}
              onChange={(e) =>
                setLocal({
                  ...local,
                  max_delivery_surcharge_fils: Math.round(Number(e.target.value) * 100),
                })
              }
              className="w-32"
            />
          </Field>
        </div>
      </Card>

      <SaveBar
        dirty={isDirty}
        onSave={() =>
          update.mutate(local, { onSuccess: () => toast.success("Marketplace settings saved") })
        }
        onReset={() => setLocal(q.data!)}
        saving={update.isPending}
      />
    </div>
  );
}

// ── Subscriptions ─────────────────────────────────────────────────────────────

type PlanFormState = {
  id?: string;
  name: string;
  name_ar: string;
  tagline: string;
  tagline_ar: string;
  price_fils_monthly: number;
  price_fils_yearly: number;
  benefits: string[];
  is_active: boolean;
  sort_order: number;
};

const EMPTY_PLAN: PlanFormState = {
  name: "",
  name_ar: "",
  tagline: "",
  tagline_ar: "",
  price_fils_monthly: 0,
  price_fils_yearly: 0,
  benefits: [""],
  is_active: true,
  sort_order: 0,
};

function SubscriptionsTab() {
  const mktQ = useMarketplaceSettings();
  const mktUpdate = useUpdateMarketplaceSettings();
  const plansQ = useSubscriptionPlansAll();
  const statsQ = useSubscriptionStats();
  const createPlan = useCreateSubscriptionPlan();
  const updatePlan = useUpdateSubscriptionPlan();

  const [confirmToggle, setConfirmToggle] = useState<{ open: boolean; enabling: boolean }>({
    open: false,
    enabling: false,
  });
  const [planDialog, setPlanDialog] = useState<{ open: boolean; form: PlanFormState }>({
    open: false,
    form: EMPTY_PLAN,
  });
  const [confirmPlanToggle, setConfirmPlanToggle] = useState<{
    open: boolean;
    plan: SubscriptionPlan | null;
    activating: boolean;
  }>({ open: false, plan: null, activating: false });

  const enabled = mktQ.data?.subscriptions_enabled ?? false;

  if (mktQ.isLoading) return <CenteredSpinner />;
  if (mktQ.isError) return <ErrorState error={mktQ.error} onRetry={() => mktQ.refetch()} />;

  const handleToggleEnable = (v: boolean) => {
    setConfirmToggle({ open: true, enabling: v });
  };

  const confirmEnableToggle = () => {
    const enabling = confirmToggle.enabling;
    mktUpdate.mutate(
      { ...mktQ.data!, subscriptions_enabled: enabling },
      {
        onSuccess: () =>
          toast.success(enabling ? "Khyate Plus subscriptions enabled" : "Subscriptions disabled"),
      },
    );
    setConfirmToggle({ open: false, enabling: false });
  };

  const openNewPlan = () => setPlanDialog({ open: true, form: { ...EMPTY_PLAN } });
  const openEditPlan = (p: SubscriptionPlan) =>
    setPlanDialog({ open: true, form: { ...p, benefits: p.benefits.length ? p.benefits : [""] } });

  const savePlan = () => {
    const { id, ...rest } = planDialog.form;
    if (!rest.name.trim()) {
      toast.error("Plan name is required");
      return;
    }
    const benefits = rest.benefits.filter((b) => b.trim());
    const payload = { ...rest, benefits };
    if (id) {
      updatePlan.mutate(
        { id, ...payload },
        {
          onSuccess: () => {
            toast.success("Plan updated");
            setPlanDialog({ open: false, form: EMPTY_PLAN });
          },
        },
      );
    } else {
      createPlan.mutate(payload as Partial<SubscriptionPlan>, {
        onSuccess: () => {
          toast.success("Plan created");
          setPlanDialog({ open: false, form: EMPTY_PLAN });
        },
      });
    }
  };

  const stats = statsQ.data;
  const plans = plansQ.data ?? [];

  return (
    <>
      <div className="w-full space-y-6">
        {/* Feature toggle */}
        <Card title="Khyate Plus">
          <div
            className={`rounded-lg border p-4 ${enabled ? "border-amber-300 bg-amber-50 dark:bg-amber-950/20" : "border-border bg-muted/30"}`}
          >
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <IconCrown
                    size={16}
                    className={enabled ? "text-amber-600" : "text-muted-foreground"}
                  />
                  Customer subscription programme
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  When enabled, customers can subscribe to Khyate Plus from the mobile app for free
                  delivery, priority support, and exclusive member benefits. Configure plans below.
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={handleToggleEnable} />
            </div>
            {enabled && (
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mt-3 flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-500" />
                Live — customers can subscribe now
              </p>
            )}
          </div>
        </Card>

        {/* Stats */}
        {stats && (
          <Card title="Subscription metrics">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Active members", value: stats.active_count.toLocaleString() },
                { label: "Monthly recurring", value: filsToAed(stats.mrr_fils) },
                { label: "New this month", value: stats.new_this_month.toLocaleString() },
                { label: "Cancelled", value: stats.cancelled_count.toLocaleString() },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border bg-card p-3">
                  <p className="text-lg font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Plans list */}
        <Card title="Plans">
          <div className="space-y-3">
            {plansQ.isLoading && <CenteredSpinner />}
            {plansQ.isError && (
              <ErrorState
                error={plansQ.error}
                onRetry={() => plansQ.refetch()}
                title="Couldn't load plans"
              />
            )}
            {!plansQ.isLoading && !plansQ.isError && plans.length === 0 && (
              <p className="text-sm text-muted-foreground">No plans configured yet.</p>
            )}
            {plans.map((p) => (
              <div key={p.id} className="flex items-start gap-3 rounded-lg border bg-card p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">{p.name}</p>
                    {p.name_ar && (
                      <span className="text-muted-foreground text-xs" dir="rtl">
                        {p.name_ar}
                      </span>
                    )}
                    <Badge variant={p.is_active ? "default" : "secondary"} className="text-xs">
                      {p.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{p.tagline}</p>
                  <div className="flex gap-4 mt-2 text-xs">
                    <span>
                      <span className="font-medium">{filsToAed(p.price_fils_monthly)}</span>/mo
                    </span>
                    <span>
                      <span className="font-medium">{filsToAed(p.price_fils_yearly)}</span>/yr
                    </span>
                  </div>
                  <ul className="mt-2 space-y-0.5">
                    {p.benefits.map((b, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                        <IconCheck size={11} className="text-primary shrink-0" /> {b}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => openEditPlan(p)}>
                    <IconPencil size={13} className="mr-1" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setConfirmPlanToggle({ open: true, plan: p, activating: !p.is_active })
                    }
                    className={
                      p.is_active
                        ? "text-destructive border-destructive/40 hover:bg-destructive/5"
                        : ""
                    }
                  >
                    {p.is_active ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={openNewPlan} className="w-full">
              <IconPlus size={14} className="mr-1" /> Add plan
            </Button>
          </div>
        </Card>
      </div>

      {/* Enable/disable feature confirm */}
      <ConfirmDialog
        open={confirmToggle.open}
        onOpenChange={(v) => setConfirmToggle({ open: v, enabling: confirmToggle.enabling })}
        title={confirmToggle.enabling ? "Enable Khyate Plus?" : "Disable subscriptions?"}
        description={
          confirmToggle.enabling
            ? "Customers will be able to subscribe from the mobile app. Make sure you have configured at least one active plan below before enabling."
            : "New subscriptions will stop. Existing active subscribers will continue until their billing period ends — you will not lose any current revenue."
        }
        confirmLabel={
          confirmToggle.enabling ? "Yes, enable subscriptions" : "Yes, disable subscriptions"
        }
        destructive={!confirmToggle.enabling}
        onConfirm={confirmEnableToggle}
      />

      {/* Plan activate/deactivate confirm */}
      <ConfirmDialog
        open={confirmPlanToggle.open}
        onOpenChange={(v) =>
          setConfirmPlanToggle({
            open: v,
            plan: confirmPlanToggle.plan,
            activating: confirmPlanToggle.activating,
          })
        }
        title={
          confirmPlanToggle.activating
            ? `Activate "${confirmPlanToggle.plan?.name}"?`
            : `Deactivate "${confirmPlanToggle.plan?.name}"?`
        }
        description={
          confirmPlanToggle.activating
            ? "This plan will become available to new subscribers."
            : "No new customers will be able to subscribe to this plan. Existing subscribers are unaffected."
        }
        confirmLabel={confirmPlanToggle.activating ? "Activate plan" : "Deactivate plan"}
        destructive={!confirmPlanToggle.activating}
        onConfirm={() => {
          if (!confirmPlanToggle.plan) return;
          updatePlan.mutate(
            { ...confirmPlanToggle.plan, is_active: confirmPlanToggle.activating },
            {
              onSuccess: () =>
                toast.success(`Plan ${confirmPlanToggle.activating ? "activated" : "deactivated"}`),
            },
          );
          setConfirmPlanToggle({ open: false, plan: null, activating: false });
        }}
      />

      {/* Plan edit / create dialog */}
      <Dialog
        open={planDialog.open}
        onOpenChange={(v) => setPlanDialog({ open: v, form: planDialog.form })}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{planDialog.form.id ? "Edit plan" : "New plan"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Name (English)</Label>
                <Input
                  className="mt-1"
                  value={planDialog.form.name}
                  onChange={(e) =>
                    setPlanDialog({
                      ...planDialog,
                      form: { ...planDialog.form, name: e.target.value },
                    })
                  }
                  placeholder="Khyate Plus"
                />
              </div>
              <div>
                <Label className="text-xs">Name (Arabic)</Label>
                <Input
                  className="mt-1"
                  dir="rtl"
                  value={planDialog.form.name_ar}
                  onChange={(e) =>
                    setPlanDialog({
                      ...planDialog,
                      form: { ...planDialog.form, name_ar: e.target.value },
                    })
                  }
                  placeholder="خياطة بلس"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tagline (English)</Label>
                <Input
                  className="mt-1"
                  value={planDialog.form.tagline}
                  onChange={(e) =>
                    setPlanDialog({
                      ...planDialog,
                      form: { ...planDialog.form, tagline: e.target.value },
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Tagline (Arabic)</Label>
                <Input
                  className="mt-1"
                  dir="rtl"
                  value={planDialog.form.tagline_ar}
                  onChange={(e) =>
                    setPlanDialog({
                      ...planDialog,
                      form: { ...planDialog.form, tagline_ar: e.target.value },
                    })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Monthly price (AED)</Label>
                <Input
                  className="mt-1"
                  type="number"
                  min="0"
                  step="0.01"
                  value={planDialog.form.price_fils_monthly / 100 || ""}
                  onChange={(e) =>
                    setPlanDialog({
                      ...planDialog,
                      form: {
                        ...planDialog.form,
                        price_fils_monthly: Math.round(Number(e.target.value) * 100),
                      },
                    })
                  }
                  placeholder="49.00"
                />
              </div>
              <div>
                <Label className="text-xs">Yearly price (AED)</Label>
                <Input
                  className="mt-1"
                  type="number"
                  min="0"
                  step="0.01"
                  value={planDialog.form.price_fils_yearly / 100 || ""}
                  onChange={(e) =>
                    setPlanDialog({
                      ...planDialog,
                      form: {
                        ...planDialog.form,
                        price_fils_yearly: Math.round(Number(e.target.value) * 100),
                      },
                    })
                  }
                  placeholder="499.00"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs mb-2 block">Benefits (one per line)</Label>
              <div className="space-y-2">
                {planDialog.form.benefits.map((b, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={b}
                      onChange={(e) => {
                        const updated = [...planDialog.form.benefits];
                        updated[i] = e.target.value;
                        setPlanDialog({
                          ...planDialog,
                          form: { ...planDialog.form, benefits: updated },
                        });
                      }}
                      placeholder={`Benefit ${i + 1}`}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={() => {
                        const updated = planDialog.form.benefits.filter((_, j) => j !== i);
                        setPlanDialog({
                          ...planDialog,
                          form: { ...planDialog.form, benefits: updated.length ? updated : [""] },
                        });
                      }}
                    >
                      <IconX size={14} />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPlanDialog({
                      ...planDialog,
                      form: { ...planDialog.form, benefits: [...planDialog.form.benefits, ""] },
                    })
                  }
                >
                  <IconPlus size={13} className="mr-1" /> Add benefit
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={planDialog.form.is_active}
                onCheckedChange={(v) =>
                  setPlanDialog({ ...planDialog, form: { ...planDialog.form, is_active: v } })
                }
              />
              <Label className="text-sm">Active (visible to subscribers)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setPlanDialog({ open: false, form: EMPTY_PLAN })}
            >
              Cancel
            </Button>
            <Button onClick={savePlan} disabled={createPlan.isPending || updatePlan.isPending}>
              {createPlan.isPending || updatePlan.isPending ? "Saving…" : "Save plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Policies ──────────────────────────────────────────────────────────────────

function PoliciesTab() {
  const q = usePolicySettings();
  const update = useUpdatePolicySettings();
  const { local, setLocal, isDirty } = useDirty<PolicySettings>(q.data);

  if (q.isLoading) return <CenteredSpinner />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!local) return null;

  const fields: Array<[keyof PolicySettings, string, string]> = [
    [
      "dispute_sla_hours",
      "Dispute SLA (hours)",
      "Max hours to resolve a dispute before escalation.",
    ],
    [
      "return_window_days",
      "Refund Window (days)",
      "Days after delivery a customer can request a refund.",
    ],
    [
      "review_edit_window_hours",
      "Review Edit Window (hours)",
      "Hours after posting a review the user can still edit it.",
    ],
    [
      "auto_complete_delivered_days",
      "Auto-Complete Delivered (days)",
      "Days after delivery an unconfirmed order auto-completes and the tailor's earnings release.",
    ],
    [
      "commission_dispute_window_days",
      "Commission Dispute Window (days)",
      "Days a tailor has to dispute a commission deduction.",
    ],
    [
      "payout_hold_days",
      "Payout Hold (days)",
      "Days funds are held before becoming available for payout.",
    ],
    [
      "max_active_disputes_per_customer",
      "Max Active Disputes / Customer",
      "Block new disputes above this threshold.",
    ],
  ];

  return (
    <div className="w-full space-y-6">
      <Card title="Dispute routing">
        <Field
          label="Where a new dispute goes"
          description="Change any time. 'Tailor first' lets the tailor respond before it can be escalated to you; 'Platform helpdesk' sends every dispute straight to your team."
        >
          <select
            aria-label="Dispute routing"
            value={local.dispute_routing ?? "tailor_first"}
            onChange={(e) =>
              setLocal({
                ...local,
                dispute_routing: e.target.value as PolicySettings["dispute_routing"],
              })
            }
            className="border rounded-md px-3 py-2 text-sm bg-card w-full sm:w-72"
          >
            <option value="tailor_first">Tailor first (then escalate to helpdesk)</option>
            <option value="helpdesk_direct">Straight to platform helpdesk</option>
          </select>
        </Field>
      </Card>
      <Card title="Time & Threshold Policies">
        <div className="space-y-4">
          {fields.map(([key, label, desc]) => (
            <Field key={key} label={label} description={desc}>
              <Input
                type="number"
                value={local[key] as number}
                onChange={(e) => setLocal({ ...local, [key]: Number(e.target.value) })}
                className="w-32"
              />
            </Field>
          ))}
        </div>
      </Card>
      <SaveBar
        dirty={isDirty}
        onSave={() =>
          update.mutate(local, { onSuccess: () => toast.success("Policy settings saved") })
        }
        onReset={() => setLocal(q.data!)}
        saving={update.isPending}
      />
    </div>
  );
}

// ── Security ──────────────────────────────────────────────────────────────────

function SecurityTab() {
  const q = useSecuritySettings();
  const update = useUpdateSecuritySettings();
  const { local, setLocal, isDirty } = useDirty<SecuritySettings>(q.data);
  const [ipInput, setIpInput] = useState("");

  if (q.isLoading) return <CenteredSpinner />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!local) return null;

  const addIp = () => {
    if (!ipInput.trim()) return;
    setLocal({ ...local, admin_ip_allowlist: [...local.admin_ip_allowlist, ipInput.trim()] });
    setIpInput("");
  };

  return (
    <div className="w-full space-y-6">
      <Card title="Access Control">
        <div className="space-y-4">
          <SwitchField
            label="Require 2FA for All Admins"
            description="Force all admin accounts to set up TOTP before accessing the dashboard."
            checked={local.require_totp_for_all_admins}
            onChange={(v) => setLocal({ ...local, require_totp_for_all_admins: v })}
          />
          <Field label="Session Timeout (minutes)">
            <Input
              type="number"
              value={local.session_timeout_minutes}
              onChange={(e) =>
                setLocal({ ...local, session_timeout_minutes: Number(e.target.value) })
              }
              className="w-32"
            />
          </Field>
          <Field label="Max Login Attempts">
            <Input
              type="number"
              value={local.max_login_attempts}
              onChange={(e) => setLocal({ ...local, max_login_attempts: Number(e.target.value) })}
              className="w-32"
            />
          </Field>
          <Field label="Lockout Duration (minutes)">
            <Input
              type="number"
              value={local.lockout_duration_minutes}
              onChange={(e) =>
                setLocal({ ...local, lockout_duration_minutes: Number(e.target.value) })
              }
              className="w-32"
            />
          </Field>
        </div>
      </Card>

      <Card title="Admin IP Allowlist">
        <p className="text-xs text-muted-foreground mb-3">
          Leave empty to allow all IPs. Add CIDRs or exact IPs.
        </p>
        <div className="flex gap-2 mb-3">
          <Input
            value={ipInput}
            onChange={(e) => setIpInput(e.target.value)}
            placeholder="e.g. 212.1.1.0/24"
            className="flex-1"
            onKeyDown={(e) => e.key === "Enter" && addIp()}
          />
          <Button type="button" variant="outline" size="sm" onClick={addIp}>
            Add
          </Button>
        </div>
        <div className="space-y-1.5">
          {local.admin_ip_allowlist.map((ip) => (
            <div
              key={ip}
              className="flex items-center gap-2 py-1.5 px-3 bg-muted/50 rounded text-sm font-mono"
            >
              <span className="flex-1">{ip}</span>
              <button
                type="button"
                title={`Remove ${ip}`}
                aria-label={`Remove ${ip}`}
                className="text-muted-foreground hover:text-destructive"
                onClick={() =>
                  setLocal({
                    ...local,
                    admin_ip_allowlist: local.admin_ip_allowlist.filter((x) => x !== ip),
                  })
                }
              >
                <IconX size={14} />
              </button>
            </div>
          ))}
          {local.admin_ip_allowlist.length === 0 && (
            <p className="text-sm text-muted-foreground italic">All IPs allowed.</p>
          )}
        </div>
      </Card>

      <SaveBar
        dirty={isDirty}
        onSave={() =>
          update.mutate(local, { onSuccess: () => toast.success("Security settings saved") })
        }
        onReset={() => setLocal(q.data!)}
        saving={update.isPending}
      />
    </div>
  );
}

// ── Integrations ──────────────────────────────────────────────────────────────

function IntegrationsTab() {
  const q = useIntegrationSettings();
  const update = useUpdateIntegrationSettings();
  const testMutation = useTestIntegration();
  const { local, setLocal, isDirty } = useDirty<IntegrationSettings>(q.data);

  if (q.isLoading) return <CenteredSpinner />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!local) return null;

  function test(provider: string) {
    testMutation.mutate(provider, { onSuccess: (r) => toast(r.message) });
  }

  return (
    <div className="w-full space-y-6">
      <Card title="Observability">
        <div className="space-y-3">
          <StatusField
            label="Sentry Error Tracking"
            description="Live — reflects whether SENTRY_DSN is actually set in the server/app environment, not a switch."
            connected={local.sentry_connected}
          />
          <StatusField
            label="PostHog Analytics"
            description="Not integrated yet — there's no PostHog code in the app, so this can't be turned on here."
            connected={local.posthog_connected}
          />
        </div>
      </Card>

      <Card title="Live connection status">
        <div className="space-y-3">
          <StatusFieldWithTest
            label="Stripe"
            connected={local.stripe_connected}
            onTest={() => test("stripe")}
            testing={testMutation.isPending}
          />
          <StatusFieldWithTest
            label="Firebase (phone auth / push)"
            connected={local.firebase_connected}
            onTest={() => test("firebase")}
            testing={testMutation.isPending}
          />
          <StatusFieldWithTest
            label="SMS (D7 / Twilio)"
            connected={local.sms_provider}
            onTest={() => test("sms")}
            testing={testMutation.isPending}
          />
          <StatusFieldWithTest
            label="Email (SMTP)"
            connected={local.email_provider}
            onTest={() => test("email")}
            testing={testMutation.isPending}
          />
          <StatusField
            label="KYC Document Encryption"
            description={
              local.kyc_encryption_connected
                ? "KYC_MASTER_KEY is set — Emirates ID / trade licence uploads encrypt correctly."
                : "KYC_MASTER_KEY is NOT set — every KYC document upload will fail until it's added to /etc/khyate.env."
            }
            connected={local.kyc_encryption_connected}
          />
        </div>
      </Card>

      <SaveBar
        dirty={isDirty}
        onSave={() =>
          update.mutate(local, { onSuccess: () => toast.success("Integration settings saved") })
        }
        onReset={() => setLocal(q.data!)}
        saving={update.isPending}
      />
    </div>
  );
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function Field({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4">
      <div className="flex-1 min-w-0">
        <Label className="text-sm font-medium">{label}</Label>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="w-full sm:w-auto sm:shrink-0">{children}</div>
    </div>
  );
}

// Read-only — for status that's computed server-side from real credentials,
// never a value someone can toggle without it meaning anything.
function StatusField({
  label,
  description,
  connected,
}: {
  label: string;
  description?: string;
  connected: boolean;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
          connected ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"
        }`}
      >
        {connected ? "Connected" : "Not connected"}
      </span>
    </div>
  );
}

// Same live/read-only status as StatusField, plus a "Test" button that hits
// the real check (POST /settings/integrations/:provider/test) instead of just
// trusting the cached connected flag — useful right after adding credentials,
// before this page's own query has refetched.
function StatusFieldWithTest({
  label,
  connected,
  onTest,
  testing,
}: {
  label: string;
  connected: boolean;
  onTest: () => void;
  testing: boolean;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
      </div>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
          connected ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground"
        }`}
      >
        {connected ? "Connected" : "Not connected"}
      </span>
      <Button size="sm" variant="outline" onClick={onTest} disabled={testing}>
        Test
      </Button>
    </div>
  );
}

function SwitchField({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex-1">
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function SaveBar({
  dirty,
  onSave,
  onReset,
  saving,
}: {
  dirty: boolean;
  onSave: () => void;
  onReset: () => void;
  saving: boolean;
}) {
  if (!dirty) return null;
  return (
    <div className="sticky bottom-4 flex items-center gap-3 bg-card border rounded-xl px-5 py-3 shadow-lg">
      <p className="text-sm text-muted-foreground flex-1">You have unsaved changes.</p>
      <Button variant="ghost" size="sm" onClick={onReset} disabled={saving}>
        <IconX size={15} className="mr-1" /> Discard
      </Button>
      <Button size="sm" onClick={onSave} disabled={saving}>
        <IconCheck size={15} className="mr-1" />
        {saving ? "Saving…" : "Save Changes"}
      </Button>
    </div>
  );
}
