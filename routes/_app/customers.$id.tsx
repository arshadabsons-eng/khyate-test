import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { Card, PageHeader } from "@/components/common/Page";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Avatar } from "@/components/common/Avatar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ReasonDialog } from "@/components/common/ReasonDialog";
import { ResetPasswordDialog } from "@/components/common/ResetPasswordDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, NoData, LoadingRows } from "@/components/common/AsyncStates";
import { DataTable } from "@/components/common/DataTable";
import {
  useCustomer,
  useCustomerOrders,
  useCustomerDisputes,
  useCustomerReviews,
  useCustomerActivity,
  useSuspendCustomer,
  useReinstateCustomer,
  useFlagCustomer,
  useUnflagCustomer,
  useRevealPhone,
  useDeleteCustomer,
  useResetCustomerPassword,
  useRequestCustomerDeletion,
  useCancelCustomerDeletionRequest,
} from "@/lib/api/queries/customers";
import { auth } from "@/lib/auth";
import { aed, fmtDate, fmtDateTime, relTime, maskName, maskPhone, initialsOf } from "@/lib/format";
import {
  IconUserX,
  IconUserCheck,
  IconFlag,
  IconFlagOff,
  IconPhone,
  IconTrash,
  IconShoppingBag,
  IconAlertTriangle,
  IconStar,
  IconHistory,
  IconLayoutDashboard,
  IconKey,
} from "@tabler/icons-react";
import { StatCard } from "@/components/common/StatCard";
import { LiquidTabs } from "@/components/common/LiquidTabs";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/customers/$id")({ component: CustomerDetail });

const TABS = [
  { id: "overview", label: "Overview", icon: IconLayoutDashboard },
  { id: "orders", label: "Orders", icon: IconShoppingBag },
  { id: "disputes", label: "Disputes", icon: IconAlertTriangle },
  { id: "reviews", label: "Reviews", icon: IconStar },
  { id: "activity", label: "Activity Log", icon: IconHistory },
] as const;

type TabId = (typeof TABS)[number]["id"];

function CustomerDetail() {
  const { id } = useParams({ from: "/_app/customers/$id" });
  const [tab, setTab] = useState<TabId>("overview");
  const [revealedPhone, setRevealedPhone] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [resetPwOpen, setResetPwOpen] = useState(false);
  const navigate = useNavigate();

  const q = useCustomer(id);
  const suspendMutation = useSuspendCustomer();
  const reinstateMutation = useReinstateCustomer();
  const flagMutation = useFlagCustomer();
  const unflagMutation = useUnflagCustomer();
  const revealPhoneMutation = useRevealPhone();
  const deleteMutation = useDeleteCustomer();
  const resetPasswordMutation = useResetCustomerPassword();
  const requestDeletionMutation = useRequestCustomerDeletion();
  const cancelDeletionMutation = useCancelCustomerDeletionRequest();
  const [requestDeleteOpen, setRequestDeleteOpen] = useState(false);
  const isSuperAdmin = auth.user()?.role === "super_admin";
  const canWrite = auth.canWrite();
  // Suspend/reinstate/flag/unflag/reveal-phone/reset-password are all
  // deliberately available to helpdesk too (backend gates them at 'view', not
  // 'edit' — see customers.js HELPDESK const) — canWrite() alone (rank >= 2)
  // would incorrectly hide all of these from support_agent (rank 1). Only
  // permanent deletion stays canWrite-gated (isSuperAdmin, even stricter,
  // below) — see the 2026-08-14 product decision recorded in customers.js.
  const canHelpdesk = canWrite || auth.isSupportAgent();

  if (q.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <div className="border-b" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  if (q.isError)
    return (
      <ErrorState error={q.error} onRetry={() => q.refetch()} title="Couldn't load customer" />
    );
  if (!q.data) return <NoData title="Customer not found" />;

  const { profile, stats, addresses } = q.data;

  return (
    <div>
      <PageHeader
        title={maskName(profile.full_name)}
        description={
          <Link to="/customers" className="text-primary hover:underline">
            ← All customers
          </Link>
        }
        actions={
          <>
            {profile.is_active && canHelpdesk && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() =>
                  suspendMutation.mutate(
                    { id, reason: "Admin action" },
                    {
                      onError: (e: unknown) =>
                        toast.error((e as Error)?.message || "Couldn't suspend this customer"),
                    },
                  )
                }
                disabled={suspendMutation.isPending}
              >
                <IconUserX size={16} className="mr-1" /> Suspend
              </Button>
            )}
            {!profile.is_active && canHelpdesk && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  reinstateMutation.mutate(id, {
                    onError: (e: unknown) =>
                      toast.error((e as Error)?.message || "Couldn't reinstate this customer"),
                  })
                }
                disabled={reinstateMutation.isPending}
              >
                <IconUserCheck size={16} className="mr-1" /> Reinstate
              </Button>
            )}
            {canHelpdesk &&
              (!profile.is_flagged ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-yellow-400 text-yellow-700 hover:bg-yellow-50"
                  onClick={() =>
                    flagMutation.mutate(
                      { id, reason: "Admin flag" },
                      {
                        onError: (e: unknown) =>
                          toast.error((e as Error)?.message || "Couldn't flag this customer"),
                      },
                    )
                  }
                  disabled={flagMutation.isPending}
                >
                  <IconFlag size={16} className="mr-1" /> Flag
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    unflagMutation.mutate(id, {
                      onError: (e: unknown) =>
                        toast.error((e as Error)?.message || "Couldn't unflag this customer"),
                    })
                  }
                  disabled={unflagMutation.isPending}
                >
                  <IconFlagOff size={16} className="mr-1" /> Unflag
                </Button>
              ))}
            {canHelpdesk && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  revealPhoneMutation.mutate(id, {
                    onSuccess: (d) => setRevealedPhone(d.phone),
                    onError: (e: unknown) =>
                      toast.error((e as Error)?.message || "Couldn't reveal phone number"),
                  })
                }
                disabled={revealPhoneMutation.isPending || !!revealedPhone}
              >
                <IconPhone size={16} className="mr-1" />
                {revealedPhone ?? "Reveal Phone"}
              </Button>
            )}
            {canHelpdesk && (
              <Button size="sm" variant="outline" onClick={() => setResetPwOpen(true)}>
                <IconKey size={16} className="mr-1" /> Reset password
              </Button>
            )}
            {isSuperAdmin && !profile.is_active && (
              <Button
                size="sm"
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => setDeleteOpen(true)}
              >
                <IconTrash size={16} className="mr-1" /> Delete account
              </Button>
            )}
            {/* Helpdesk can't delete directly — they escalate to a super_admin
                instead, who sees the request banner below and either deletes
                (above, unaffected by this) or dismisses it. */}
            {!isSuperAdmin && canHelpdesk && !profile.is_active && !profile.deletion_requested_at && (
              <Button size="sm" variant="outline" onClick={() => setRequestDeleteOpen(true)}>
                <IconTrash size={16} className="mr-1" /> Request deletion
              </Button>
            )}
          </>
        }
      />

      {profile.deletion_requested_at && (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start justify-between gap-3">
          <div className="text-sm">
            <div className="font-medium text-destructive">Deletion requested</div>
            <div className="text-muted-foreground mt-0.5">
              {profile.deletion_requested_by_name || "A helpdesk operator"} requested deletion on{" "}
              {fmtDateTime(profile.deletion_requested_at)}: {profile.deletion_request_reason}
            </div>
            {!isSuperAdmin && (
              <div className="text-xs text-muted-foreground mt-1">
                Awaiting a super admin to delete or dismiss this request.
              </div>
            )}
          </div>
          {canHelpdesk && (
            <Button
              size="sm"
              variant="ghost"
              disabled={cancelDeletionMutation.isPending}
              onClick={() =>
                cancelDeletionMutation.mutate(id, {
                  onSuccess: () => toast.success("Deletion request cancelled"),
                  onError: (e: unknown) => toast.error((e as Error)?.message || "Couldn't cancel"),
                })
              }
            >
              Cancel request
            </Button>
          )}
        </div>
      )}

      {/* Tabs */}
      <LiquidTabs
        tabs={TABS}
        value={tab}
        onChange={(id) => setTab(id as TabId)}
        className="mb-6 -mt-2"
      />

      {tab === "overview" && (
        <OverviewTab
          profile={profile}
          stats={stats}
          addresses={addresses}
          revealedPhone={revealedPhone}
        />
      )}
      {tab === "orders" && <OrdersTab customerId={id} />}
      {tab === "disputes" && <DisputesTab customerId={id} />}
      {tab === "reviews" && <ReviewsTab customerId={id} />}
      {tab === "activity" && <ActivityTab customerId={id} />}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${profile.full_name}'s account?`}
        description="This permanently anonymises their personal data (name, email, phone) and cannot be undone. Order/financial history is retained for tax and compliance."
        confirmLabel="Delete account"
        destructive
        onConfirm={() => {
          setDeleteOpen(false);
          deleteMutation.mutate(id, {
            onSuccess: () => navigate({ to: "/customers" }),
            onError: (e: unknown) =>
              toast.error((e as Error)?.message || "Couldn't delete this account"),
          });
        }}
      />

      <ResetPasswordDialog
        open={resetPwOpen}
        onOpenChange={setResetPwOpen}
        personName={profile.full_name}
        reset={(args) => resetPasswordMutation.mutateAsync({ id, ...args })}
      />

      <ReasonDialog
        open={requestDeleteOpen}
        onOpenChange={setRequestDeleteOpen}
        title="Request deletion"
        description="A super admin will be notified and can delete or dismiss this request."
        placeholder="Why should this account be deleted?"
        confirmLabel="Request deletion"
        destructive
        onConfirm={(reason) => {
          setRequestDeleteOpen(false);
          requestDeletionMutation.mutate(
            { id, reason },
            {
              onSuccess: () => toast.success("Deletion requested — a super admin has been notified"),
              onError: (e: unknown) => toast.error((e as Error)?.message || "Couldn't request deletion"),
            },
          );
        }}
      />
    </div>
  );
}

function OverviewTab({
  profile,
  stats,
  addresses,
  revealedPhone,
}: {
  profile: NonNullable<ReturnType<typeof useCustomer>["data"]>["profile"];
  stats: NonNullable<ReturnType<typeof useCustomer>["data"]>["stats"];
  addresses: NonNullable<ReturnType<typeof useCustomer>["data"]>["addresses"];
  revealedPhone: string | null;
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Orders" value={stats.total_orders} icon={IconShoppingBag} />
        <StatCard label="Total Spent" value={aed(stats.total_spent_fils)} icon={IconShoppingBag} />
        <StatCard
          label="Open Disputes"
          value={stats.open_disputes}
          icon={IconAlertTriangle}
          className={stats.open_disputes > 0 ? "border-red-200 bg-red-50" : ""}
        />
        <StatCard label="Reviews Written" value={stats.total_reviews} icon={IconStar} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Profile">
          <div className="flex items-center gap-4 mb-6">
            <Avatar initials={initialsOf(profile.full_name)} size={56} />
            <div>
              <div className="text-lg font-semibold">{maskName(profile.full_name)}</div>
              <StatusBadge status={profile.status} />
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
            {[
              ["Phone", revealedPhone ?? maskPhone(profile.phone)],
              ["Phone Verified", profile.is_phone_verified ? "Yes" : "No"],
              ["Email", profile.email ?? "—"],
              ["Email Verified", profile.is_email_verified ? "Yes" : "No"],
              ["City", profile.city],
              ["Language", profile.preferred_language === "ar" ? "العربية" : "English"],
              ["Joined", fmtDate(profile.joined_at)],
              ["Last Active", relTime(profile.last_active_at)],
              ["Avg Order Value", aed(stats.avg_order_value_fils)],
              ["Cancelled", stats.cancelled_orders],
            ].map(([k, v]) => (
              <div key={String(k)}>
                <dt className="text-muted-foreground text-xs uppercase tracking-wider">{k}</dt>
                <dd className="font-medium mt-0.5">{v}</dd>
              </div>
            ))}
          </dl>
          {profile.is_flagged && profile.flag_reason && (
            <div className="mt-4 p-3 rounded-md bg-yellow-50 border border-yellow-200 text-sm">
              <span className="font-medium text-yellow-800">Flag reason:</span>{" "}
              <span className="text-yellow-700">{profile.flag_reason}</span>
            </div>
          )}
        </Card>

        <Card title="Delivery Addresses">
          {addresses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No saved addresses.</p>
          ) : (
            <ul className="space-y-3">
              {addresses.map((addr) => (
                <li key={addr.id} className="flex items-start gap-2 text-sm">
                  <span className="font-medium min-w-[80px]">{addr.label}</span>
                  <span className="text-muted-foreground flex-1">
                    {addr.full_address}, {addr.city}
                  </span>
                  {addr.is_default && (
                    <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full shrink-0">
                      Default
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function OrdersTab({ customerId }: { customerId: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError, error, refetch } = useCustomerOrders(customerId, page);

  if (isLoading) return <LoadingRows cols={6} rows={8} />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;

  return (
    <DataTable
      columns={[
        {
          header: "Order #",
          accessor: (r) => <span className="font-mono text-xs">{r.order_number}</span>,
        },
        { header: "Tailor", accessor: (r) => r.tailor_name },
        { header: "Type", accessor: (r) => <StatusBadge status={r.order_type} /> },
        { header: "Total", accessor: (r) => aed(r.total_fils) },
        { header: "Status", accessor: (r) => <StatusBadge status={r.status} /> },
        { header: "Date", accessor: (r) => fmtDate(r.created_at) },
      ]}
      rows={data?.data ?? []}
      pagination={{
        page: data?.page ?? 1,
        totalPages: data?.total_pages ?? 1,
        onPageChange: setPage,
      }}
    />
  );
}

function DisputesTab({ customerId }: { customerId: string }) {
  const { data, isLoading, isError, error, refetch } = useCustomerDisputes(customerId);

  if (isLoading) return <LoadingRows cols={5} rows={6} />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  if (!data?.data?.length) return <NoData title="No disputes found" />;

  return (
    <DataTable
      columns={[
        {
          header: "Dispute #",
          accessor: (r) => <span className="font-mono text-xs">{r.dispute_number}</span>,
        },
        {
          header: "Order",
          accessor: (r) => <span className="font-mono text-xs">{r.order_number}</span>,
        },
        { header: "Type", accessor: (r) => (r.dispute_type ?? "").replace(/_/g, " ") || "—" },
        { header: "Status", accessor: (r) => <StatusBadge status={r.status} /> },
        { header: "Raised", accessor: (r) => fmtDate(r.raised_at) },
      ]}
      rows={data.data}
    />
  );
}

function ReviewsTab({ customerId }: { customerId: string }) {
  const { data, isLoading, isError, error, refetch } = useCustomerReviews(customerId);

  if (isLoading) return <LoadingRows cols={5} rows={6} />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  if (!data?.data?.length) return <NoData title="No reviews written yet" />;

  return (
    <DataTable
      columns={[
        // reviewee/is_visible now come from a real join+alias on the backend
        // (matching how GET /reviews already does it) — previously this
        // endpoint returned raw reviews.* with neither field, so Reviewee
        // showed "—" and Visible showed "Hidden" on every row regardless of
        // the review's actual state. reviews has no `title` column at all
        // (only `body`), so that column is a content snippet instead.
        { header: "Reviewee", accessor: (r) => r.reviewee?.name ?? "—" },
        {
          header: "Rating",
          accessor: (r) => (
            <span className="text-amber-500">
              {"★".repeat(r.rating)}
              {"☆".repeat(5 - r.rating)}
            </span>
          ),
        },
        {
          header: "Comment",
          accessor: (r) =>
            r.body ? (r.body.length > 60 ? `${r.body.slice(0, 60)}…` : r.body) : "—",
        },
        { header: "Visible", accessor: (r) => (r.is_visible ? "Yes" : "Hidden") },
        { header: "Date", accessor: (r) => fmtDate(r.created_at) },
      ]}
      rows={data.data}
    />
  );
}

function ActivityTab({ customerId }: { customerId: string }) {
  const { data, isLoading, isError, error, refetch } = useCustomerActivity(customerId);

  if (isLoading) return <LoadingRows cols={3} rows={8} />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  if (!data?.length) return <NoData title="No activity yet" />;

  return (
    <div className="space-y-0">
      {data.map((ev) => (
        <div key={ev.id} className="flex items-start gap-3 py-3 border-b last:border-b-0">
          <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm">{ev.description}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{fmtDateTime(ev.created_at)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
