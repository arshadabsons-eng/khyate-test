import { createFileRoute, Link, useParams, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Card, PageHeader } from "@/components/common/Page";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Avatar, Stars } from "@/components/common/Avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, NoData } from "@/components/common/AsyncStates";
import {
  useTailor,
  useTailorDocuments,
  useTailorOrders,
  useTailorListings,
  useTailorReviews,
  useTailorEarnings,
  useTailorActivity,
  useBanListing,
  useUnbanListing,
  useApproveTailor,
  useRejectTailor,
  useSuspendTailor,
  useReinstateTailor,
  useDeleteTailor,
  useApproveDocument,
  useRejectDocument,
  useResetTailorPassword,
  useRequestTailorDeletion,
  useCancelTailorDeletionRequest,
} from "@/lib/api/queries/tailors";
import { SecureDocImage } from "@/components/tailor/SecureUpload";
import type {
  VerificationDocument,
  TailorDetail,
  AdminTailorOrderRow,
  AdminTailorListingRow,
  AdminTailorReviewRow,
  AdminTailorLedgerRow,
  AdminTailorActivityEvent,
} from "@/lib/api/types";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/client";
import { auth } from "@/lib/auth";
import { DataTable } from "@/components/common/DataTable";
import { LoadingRows } from "@/components/common/AsyncStates";
import { aed, filsToAed, fmtDate, fmtDateTime, fmtNumber, initialsOf } from "@/lib/format";
import {
  IconCheck,
  IconX,
  IconBan,
  IconRefresh,
  IconFileText,
  IconHistory,
  IconStar,
  IconShoppingBag,
  IconCash,
  IconBox,
  IconShieldCheck,
  IconTrash,
  IconKey,
} from "@tabler/icons-react";
import { ImageCarousel } from "@/components/common/ImageCarousel";
import { LiquidTabs } from "@/components/common/LiquidTabs";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ReasonDialog } from "@/components/common/ReasonDialog";
import { ResetPasswordDialog } from "@/components/common/ResetPasswordDialog";

export const Route = createFileRoute("/_app/tailors/$id")({ component: TailorDetail });

const TABS = [
  { id: "overview", label: "Overview", icon: IconFileText },
  { id: "orders", label: "Orders", icon: IconShoppingBag },
  { id: "listings", label: "Listings", icon: IconBox },
  { id: "reviews", label: "Reviews", icon: IconStar },
  { id: "earnings", label: "Earnings", icon: IconCash },
  { id: "documents", label: "Documents", icon: IconShieldCheck },
  { id: "activity", label: "Activity Log", icon: IconHistory },
] as const;

type TabId = (typeof TABS)[number]["id"];

function TailorDetail() {
  const { id } = useParams({ from: "/_app/tailors/$id" });
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>("overview");
  const q = useTailor(id);
  const approve = useApproveTailor();
  const reject = useRejectTailor();
  const suspend = useSuspendTailor();
  const reinstate = useReinstateTailor();
  const deleteTailor = useDeleteTailor();
  const resetPasswordMutation = useResetTailorPassword();
  const requestDeletion = useRequestTailorDeletion();
  const cancelDeletionRequest = useCancelTailorDeletionRequest();
  // Approve/Reject stay operations_admin/super_admin only (rank >= 2) — final
  // KYC sign-off is deliberately not a helpdesk action. Delete is a step past
  // suspend — super_admin only, and only once the tailor is already suspended
  // (same gate the backend enforces).
  const canWrite = auth.canWrite();
  const isSuperAdmin = auth.user()?.role === "super_admin";
  // Suspend/Reinstate/Reset-password ARE available to helpdesk (backend gates
  // them at SUSPEND/REINSTATE/ADMIN, which include support_agent — see
  // tailors.js) — per the 2026-08-14 product decision: helpdesk gets full
  // day-to-day account control short of deletion. canWrite() alone would
  // incorrectly hide all three from support_agent.
  const canHelpdesk = canWrite || auth.isSupportAgent();
  const [resetPwOpen, setResetPwOpen] = useState(false);
  const ok = (msg: string) => () => toast.success(msg);
  const fail = (e: unknown) => toast.error((e as Error)?.message || "Action failed");

  // Every action here used to drive window.prompt()/window.confirm() — a
  // native browser dialog that looks like a system error/warning box next to
  // the rest of this app's styled UI, and gives no visible label for what
  // it's asking. One piece of dialog state drives a single in-app
  // ReasonDialog/ConfirmDialog instead, reused across suspend/reinstate/
  // approve-override/reject.
  const [dialog, setDialog] = useState<
    | { type: "suspend" }
    | { type: "reject" }
    | { type: "approve-force"; message: string }
    | { type: "reinstate-force"; message: string }
    | { type: "delete" }
    | { type: "request-deletion" }
    | null
  >(null);

  // The backend 409s approve/reinstate when the tailor's documents aren't all
  // approved yet, unless the request includes force:true (an intentional AML
  // guard — see tailors.js). Without a retry path here an admin hit a dead
  // end on a generic error toast; on 409, ask for a reason and retry the same
  // mutation forced, mirroring verification.tsx's doApproveAll.
  const doApprove = () => {
    approve.mutate(
      { id },
      {
        onSuccess: ok("Tailor approved & activated"),
        onError: (e: unknown) => {
          const err = e as ApiError;
          if (err?.status === 409) {
            setDialog({ type: "approve-force", message: err.message });
            return;
          }
          fail(err);
        },
      },
    );
  };
  const doReinstate = () => {
    reinstate.mutate(
      { id },
      {
        onSuccess: ok("Tailor reinstated"),
        onError: (e: unknown) => {
          const err = e as ApiError;
          if (err?.status === 409) {
            setDialog({ type: "reinstate-force", message: err.message });
            return;
          }
          fail(err);
        },
      },
    );
  };
  const doDelete = () => {
    deleteTailor.mutate(id, {
      onSuccess: (res) => {
        toast.success(
          res?.anonymized
            ? "Tailor anonymised (had order/financial history, can't hard-delete)"
            : "Tailor deleted",
        );
        navigate({ to: "/tailors" });
      },
      onError: fail,
    });
  };

  if (q.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-6 w-1/2" />
        <div className="border-b" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  if (q.isError) {
    return <ErrorState error={q.error} onRetry={() => q.refetch()} title="Couldn't load tailor" />;
  }
  if (!q.data) return <NoData title="Tailor not found" />;

  const detail = q.data;
  const tailor = detail.profile;
  const isPending =
    tailor.verification_status === "pending" || tailor.verification_status === "under_review";

  return (
    <>
      <div>
        <PageHeader
          title={tailor.full_name}
          description={
            <Link to="/tailors" className="text-primary hover:underline">
              ← All tailors
            </Link>
          }
          actions={
            <>
              {isPending && canWrite && (
                <Button
                  size="sm"
                  disabled={approve.isPending}
                  className="bg-success hover:bg-success/90 text-success-foreground"
                  onClick={doApprove}
                >
                  <IconCheck size={16} className="mr-1" /> Approve
                </Button>
              )}
              {isPending && canWrite && (
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={reject.isPending}
                  onClick={() => setDialog({ type: "reject" })}
                >
                  <IconX size={16} className="mr-1" /> Reject
                </Button>
              )}
              {tailor.status === "active" && canHelpdesk && (
                <Button
                  size="sm"
                  disabled={suspend.isPending}
                  className="bg-warning hover:bg-warning/90 text-warning-foreground"
                  onClick={() => setDialog({ type: "suspend" })}
                >
                  <IconBan size={16} className="mr-1" /> Suspend
                </Button>
              )}
              {(tailor.status === "blocked" || tailor.status === "suspended") && canHelpdesk && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={reinstate.isPending}
                  onClick={doReinstate}
                >
                  <IconRefresh size={16} className="mr-1" /> Reinstate
                </Button>
              )}
              {tailor.status === "suspended" && isSuperAdmin && (
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={deleteTailor.isPending}
                  onClick={() => setDialog({ type: "delete" })}
                >
                  <IconTrash size={16} className="mr-1" /> Delete
                </Button>
              )}
              {/* Helpdesk can't delete directly — they escalate to a
                  super_admin instead (see the banner below). */}
              {!isSuperAdmin && canHelpdesk && tailor.status === "suspended" && !tailor.deletion_requested_at && (
                <Button size="sm" variant="outline" onClick={() => setDialog({ type: "request-deletion" })}>
                  <IconTrash size={16} className="mr-1" /> Request deletion
                </Button>
              )}
              {canHelpdesk && (
                <Button size="sm" variant="outline" onClick={() => setResetPwOpen(true)}>
                  <IconKey size={16} className="mr-1" /> Reset password
                </Button>
              )}
            </>
          }
        />

        {tailor.deletion_requested_at && (
          <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start justify-between gap-3">
            <div className="text-sm">
              <div className="font-medium text-destructive">Deletion requested</div>
              <div className="text-muted-foreground mt-0.5">
                {tailor.deletion_requested_by_name || "A helpdesk operator"} requested deletion on{" "}
                {fmtDateTime(tailor.deletion_requested_at)}: {tailor.deletion_request_reason}
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
                disabled={cancelDeletionRequest.isPending}
                onClick={() =>
                  cancelDeletionRequest.mutate(id, {
                    onSuccess: ok("Deletion request cancelled"),
                    onError: fail,
                  })
                }
              >
                Cancel request
              </Button>
            )}
          </div>
        )}

        <ResetPasswordDialog
          open={resetPwOpen}
          onOpenChange={setResetPwOpen}
          personName={tailor.full_name}
          reset={(args) => resetPasswordMutation.mutateAsync({ id, ...args })}
        />

        <ReasonDialog
          open={dialog?.type === "request-deletion"}
          onOpenChange={(v) => !v && setDialog(null)}
          title="Request deletion"
          description="A super admin will be notified and can delete or dismiss this request."
          confirmLabel="Request deletion"
          destructive
          onConfirm={(reason) => {
            setDialog(null);
            requestDeletion.mutate(
              { id, reason },
              { onSuccess: ok("Deletion requested — a super admin has been notified"), onError: fail },
            );
          }}
        />

        <LiquidTabs
          tabs={TABS}
          value={tab}
          onChange={(id) => setTab(id as TabId)}
          className="mb-6 -mt-2"
        />

        {tab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2" title="Profile">
              <div className="flex items-center gap-4 mb-6">
                <Avatar initials={initialsOf(tailor.full_name)} size={64} />
                <div>
                  <div className="text-xl font-semibold">{tailor.full_name}</div>
                  <div className="text-sm text-muted-foreground">{tailor.business_name}</div>
                  <div className="flex items-center gap-3 mt-2">
                    <StatusBadge status={tailor.verification_status} />
                    <StatusBadge status={tailor.tier} />
                    <Stars rating={tailor.rating_avg} />
                  </div>
                </div>
              </div>
              <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                {[
                  ["Email", tailor.email],
                  ["Email Verified", tailor.email_verified ? "Yes" : "No"],
                  ["Phone", tailor.phone],
                  ["Phone Verified", tailor.phone_verified ? "Yes" : "No"],
                  ["City", tailor.city],
                  ["Tier", tailor.tier],
                  ["Joined", fmtDate(tailor.joined_at)],
                  ["Total Orders", fmtNumber(tailor.total_orders)],
                  ["GMV", filsToAed(tailor.gmv_fils)],
                  ["Status", tailor.status],
                  ["Commission rate", `${detail.current_commission_rate_pct}%`],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-muted-foreground text-xs uppercase tracking-wider">{k}</dt>
                    <dd className="font-medium mt-0.5">{v}</dd>
                  </div>
                ))}
              </dl>
              {(tailor.bio_en || tailor.bio_ar) && (
                <div className="mt-6 pt-6 border-t space-y-3">
                  {tailor.bio_en && (
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                        Bio (English)
                      </div>
                      <p className="text-sm">{tailor.bio_en}</p>
                    </div>
                  )}
                  {tailor.bio_ar && (
                    <div dir="rtl">
                      <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                        Bio (العربية)
                      </div>
                      <p className="text-sm">{tailor.bio_ar}</p>
                    </div>
                  )}
                </div>
              )}
            </Card>
            <Card title="Stats">
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground uppercase tracking-wider">
                    Active listings
                  </dt>
                  <dd className="text-2xl font-semibold tabular-nums">
                    {detail.listing_counts.active}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground uppercase tracking-wider">
                    In-progress orders
                  </dt>
                  <dd className="text-2xl font-semibold tabular-nums">
                    {detail.order_counts.in_progress}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground uppercase tracking-wider">
                    Available balance
                  </dt>
                  <dd className="text-2xl font-semibold tabular-nums text-primary">
                    {filsToAed(detail.balance.available_fils)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground uppercase tracking-wider">
                    Pending balance
                  </dt>
                  <dd className="text-lg font-medium tabular-nums text-muted-foreground">
                    {filsToAed(detail.balance.pending_fils)}
                  </dd>
                </div>
              </dl>
            </Card>
            <Card className="lg:col-span-3" title="Portfolio">
              {tailor.portfolio_images?.length ? (
                <ImageCarousel
                  images={tailor.portfolio_images}
                  variant="hero"
                  autoPlay={false}
                  className="rounded-2xl"
                />
              ) : (
                <NoData icon={IconBox} title="No portfolio images yet" />
              )}
            </Card>
          </div>
        )}

        {tab === "orders" && <TailorOrdersTab tailorId={id} />}
        {tab === "listings" && <TailorListingsTab tailorId={id} />}
        {tab === "reviews" && <TailorReviewsTab tailorId={id} />}
        {tab === "earnings" && <TailorEarningsTab tailorId={id} detail={detail} />}
        {tab === "activity" && <TailorActivityTab tailorId={id} />}

        {tab === "documents" && <DocumentsTab tailorId={id} />}
      </div>

      <ReasonDialog
        open={dialog?.type === "suspend"}
        onOpenChange={(v) => !v && setDialog(null)}
        title="Suspend this tailor?"
        description="Their storefront goes offline immediately. They can be reinstated later."
        label="Reason for suspension"
        placeholder="e.g. Repeated late deliveries, customer complaints…"
        confirmLabel="Suspend"
        destructive
        onConfirm={(reason) => {
          setDialog(null);
          suspend.mutate({ id, reason }, { onSuccess: ok("Tailor suspended"), onError: fail });
        }}
      />

      <ConfirmDialog
        open={dialog?.type === "reject"}
        onOpenChange={(v) => !v && setDialog(null)}
        title="Reject this tailor's application?"
        description="They'll be notified and can re-submit after addressing the issue."
        confirmLabel="Reject"
        destructive
        onConfirm={() => {
          setDialog(null);
          reject.mutate(id, { onSuccess: ok("Tailor rejected"), onError: fail });
        }}
      />

      <ConfirmDialog
        open={dialog?.type === "delete"}
        onOpenChange={(v) => !v && setDialog(null)}
        title={`Delete ${tailor.business_name || tailor.full_name}?`}
        description="This permanently anonymises their personal data and cannot be undone. If they have any order/financial history, the account is anonymised instead of hard-deleted so those records are retained for tax and compliance."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          setDialog(null);
          doDelete();
        }}
      />

      <ReasonDialog
        open={dialog?.type === "approve-force"}
        onOpenChange={(v) => !v && setDialog(null)}
        title="Approve without full document completeness?"
        description={dialog?.type === "approve-force" ? dialog.message : undefined}
        label="Reason for overriding this check"
        placeholder="Why this is a legitimate exception…"
        confirmLabel="Approve anyway"
        destructive
        onConfirm={(reason) => {
          setDialog(null);
          approve.mutate(
            { id, force: true, reason },
            { onSuccess: ok("Tailor approved & activated (forced override)"), onError: fail },
          );
        }}
      />

      <ReasonDialog
        open={dialog?.type === "reinstate-force"}
        onOpenChange={(v) => !v && setDialog(null)}
        title="Reinstate without full document completeness?"
        description={dialog?.type === "reinstate-force" ? dialog.message : undefined}
        label="Reason for overriding this check"
        placeholder="Why this is a legitimate exception…"
        confirmLabel="Reinstate anyway"
        destructive
        onConfirm={(reason) => {
          setDialog(null);
          reinstate.mutate(
            { id, force: true, reason },
            { onSuccess: ok("Tailor reinstated (forced override)"), onError: fail },
          );
        }}
      />
    </>
  );
}

function DocumentsTab({ tailorId }: { tailorId: string }) {
  const q = useTailorDocuments(tailorId);
  if (q.isLoading) return <Skeleton className="h-64 w-full" />;
  if (q.isError)
    return (
      <ErrorState error={q.error} onRetry={() => q.refetch()} title="Couldn't load documents" />
    );
  const docs: VerificationDocument[] = Array.isArray(q.data) ? q.data : [];
  if (docs.length === 0) return <NoData icon={IconFileText} title="No documents uploaded" />;

  // Group: business-level docs (no partner) first, then one group per partner/owner.
  const business = docs.filter((d) => !d.partner_id);
  const partnerIds = Array.from(new Set(docs.filter((d) => d.partner_id).map((d) => d.partner_id)));
  const groups: { key: string; title: string; subtitle?: string; items: VerificationDocument[] }[] =
    [];
  if (business.length)
    groups.push({ key: "business", title: "Business documents", items: business });
  for (const pid of partnerIds) {
    const items = docs.filter((d) => d.partner_id === pid);
    const first = items[0];
    groups.push({
      key: String(pid),
      title: first.partner_name || "Partner",
      subtitle: [first.partner_role, first.partner_is_primary ? "primary" : null]
        .filter(Boolean)
        .join(" · "),
      items,
    });
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.key} className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="kh-h3 capitalize">{g.title}</h3>
            {g.subtitle && (
              <span className="text-xs text-muted-foreground capitalize">· {g.subtitle}</span>
            )}
          </div>
          {g.items.map((d) => (
            <DocumentCard key={d.id} doc={d} />
          ))}
        </div>
      ))}
    </div>
  );
}

function DocumentCard({ doc: d }: { doc: VerificationDocument }) {
  const approve = useApproveDocument();
  const reject = useRejectDocument();
  const canWrite = auth.canWrite();
  const secure = typeof d.file_url === "string" && d.file_url.includes("/secure-docs/");

  const onReject = () => {
    const reason = window.prompt("Reason for rejection (the tailor will see this):");
    if (reason === null) return;
    reject.mutate(
      { docId: d.id, reason: reason.trim() },
      {
        onSuccess: (r) =>
          toast.success(
            r?.demoted
              ? "Document rejected — this tailor's storefront is now paused until they resubmit."
              : "Document rejected",
          ),
        onError: (e: unknown) => toast.error((e as Error)?.message || "Couldn't reject"),
      },
    );
  };
  const onApprove = () =>
    approve.mutate(d.id, {
      onSuccess: (r) =>
        toast.success(r?.activated ? "Approved — tailor is now active" : "Document approved"),
      onError: (e: unknown) => toast.error((e as Error)?.message || "Couldn't approve"),
    });

  return (
    <Card
      title={(d.document_type ?? "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
    >
      <div className="flex items-start gap-4">
        {secure ? (
          <SecureDocImage
            id={d.id}
            label={(d.document_type ?? "").replace(/_/g, " ")}
            className="w-48 h-32 rounded-md bg-muted shrink-0 overflow-hidden"
          />
        ) : (
          <img
            src={d.file_url}
            alt=""
            className="w-48 h-32 object-cover rounded-md bg-muted shrink-0"
          />
        )}
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <StatusBadge status={d.status} />
            <span className="text-xs text-muted-foreground">Uploaded {fmtDate(d.uploaded_at)}</span>
          </div>
          {d.reviewed_by && (
            <div className="text-xs text-muted-foreground">
              Reviewed by {d.reviewed_by.name} · {fmtDateTime(d.reviewed_at!)}
            </div>
          )}
          {d.rejection_reason && (
            <div className="text-sm text-destructive">{d.rejection_reason}</div>
          )}
          {d.status === "pending" && canWrite && (
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                onClick={onApprove}
                disabled={approve.isPending}
                className="bg-success hover:bg-success/90 text-success-foreground"
              >
                <IconCheck size={14} className="mr-1" />{" "}
                {approve.isPending ? "Approving…" : "Approve"}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={onReject}
                disabled={reject.isPending}
              >
                <IconX size={14} className="mr-1" /> Reject
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function TailorOrdersTab({ tailorId }: { tailorId: string }) {
  const { data, isLoading, isError, error, refetch } = useTailorOrders(tailorId);
  if (isLoading) return <LoadingRows cols={6} rows={8} />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  const rows = data ?? [];
  if (!rows.length) return <NoData icon={IconShoppingBag} title="No orders yet" />;
  return (
    <DataTable
      columns={[
        {
          header: "Order #",
          accessor: (r) => <span className="font-mono text-xs">{r.order_number}</span>,
        },
        { header: "Customer", accessor: (r) => r.customer_name },
        { header: "Type", accessor: (r) => <StatusBadge status={r.order_type} /> },
        { header: "Total", accessor: (r) => aed(r.total_fils) },
        { header: "Status", accessor: (r) => <StatusBadge status={r.status} /> },
        { header: "Date", accessor: (r) => fmtDate(r.created_at) },
      ]}
      rows={rows}
    />
  );
}

function TailorListingsTab({ tailorId }: { tailorId: string }) {
  const { data, isLoading, isError, error, refetch } = useTailorListings(tailorId);
  const ban = useBanListing(tailorId);
  const unban = useUnbanListing(tailorId);
  if (isLoading) return <LoadingRows cols={6} rows={8} />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  const rows = data ?? [];
  if (!rows.length) return <NoData icon={IconBox} title="No listings yet" />;

  const onBan = (r: AdminTailorListingRow) => {
    const reason = window.prompt(
      `Remove "${r.title}" from the marketplace? Enter a reason (shown to the tailor):`,
      "Inappropriate content",
    );
    if (reason === null) return;
    ban.mutate(
      { listingId: r.id, reason },
      {
        onSuccess: () => toast.success("Listing removed"),
        onError: (e: unknown) =>
          toast.error((e as Error)?.message || "Couldn't remove the listing"),
      },
    );
  };
  const onUnban = (r: AdminTailorListingRow) =>
    unban.mutate(r.id, {
      onSuccess: () => toast.success("Listing restored (now hidden — the tailor can re-publish)"),
      onError: (e: unknown) => toast.error((e as Error)?.message || "Couldn't restore the listing"),
    });

  return (
    <DataTable
      columns={[
        { header: "Title", accessor: (r) => <span className="font-medium">{r.title}</span> },
        { header: "Type", accessor: (r) => r.listing_type },
        { header: "Price", accessor: (r) => aed(r.base_price_fils) },
        { header: "Orders", accessor: (r) => r.order_count ?? 0 },
        { header: "Status", accessor: (r) => <StatusBadge status={r.status} /> },
        { header: "Created", accessor: (r) => fmtDate(r.created_at) },
        {
          header: "",
          accessor: (r) =>
            r.status === "rejected" ? (
              <button
                type="button"
                data-no-row
                onClick={() => onUnban(r)}
                disabled={unban.isPending}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-muted disabled:opacity-60"
              >
                <IconRefresh size={14} /> Restore
              </button>
            ) : (
              <button
                type="button"
                data-no-row
                onClick={() => onBan(r)}
                disabled={ban.isPending}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded text-destructive hover:bg-destructive/5 disabled:opacity-60"
              >
                <IconBan size={14} /> Remove
              </button>
            ),
        },
      ]}
      rows={rows}
    />
  );
}

function TailorReviewsTab({ tailorId }: { tailorId: string }) {
  const { data, isLoading, isError, error, refetch } = useTailorReviews(tailorId);
  if (isLoading) return <LoadingRows cols={5} rows={8} />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  const rows = data ?? [];
  if (!rows.length) return <NoData icon={IconStar} title="No reviews yet" />;
  return (
    <DataTable
      columns={[
        {
          header: "Customer",
          accessor: (r) => r.customer_name ?? r.reviewer?.name ?? "—",
        },
        {
          header: "Rating",
          accessor: (r) => (
            <span className="text-amber-500">
              {"★".repeat(r.rating)}
              {"☆".repeat(5 - r.rating)}
            </span>
          ),
        },
        { header: "Title", accessor: (r) => r.title },
        { header: "Visible", accessor: (r) => (r.is_visible ? "Yes" : "Hidden") },
        { header: "Date", accessor: (r) => fmtDate(r.created_at) },
      ]}
      rows={rows}
    />
  );
}

function TailorEarningsTab({ tailorId, detail }: { tailorId: string; detail: TailorDetail }) {
  const { data, isLoading, isError, error, refetch } = useTailorEarnings(tailorId);
  if (isLoading) return <LoadingRows cols={4} rows={6} />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card title="Available Balance">
          <p className="text-2xl font-bold text-primary">
            {filsToAed(detail.balance.available_fils)}
          </p>
        </Card>
        <Card title="Pending Balance">
          <p className="text-2xl font-bold text-muted-foreground">
            {filsToAed(detail.balance.pending_fils)}
          </p>
        </Card>
        <Card title="Last Payout">
          <p className="text-base font-medium">
            {detail.balance.last_payout_at ? fmtDate(detail.balance.last_payout_at) : "—"}
          </p>
        </Card>
      </div>
      {(() => {
        const ledger: AdminTailorLedgerRow[] = Array.isArray(data) ? data : (data?.ledger ?? []);
        return ledger.length ? (
          <DataTable
            columns={[
              {
                header: "Order #",
                accessor: (r) => <span className="font-mono text-xs">{r.order_number}</span>,
              },
              { header: "Gross", accessor: (r) => aed(r.gross_fils) },
              { header: "Commission", accessor: (r) => aed(r.commission_fils) },
              {
                header: "Net",
                accessor: (r) => <span className="font-medium">{aed(r.net_fils)}</span>,
              },
              { header: "Status", accessor: (r) => <StatusBadge status={r.payout_status} /> },
              { header: "Date", accessor: (r) => fmtDate(r.created_at) },
            ]}
            rows={ledger}
          />
        ) : (
          <NoData icon={IconCash} title="No earnings recorded yet" />
        );
      })()}
    </div>
  );
}

function TailorActivityTab({ tailorId }: { tailorId: string }) {
  const { data, isLoading, isError, error, refetch } = useTailorActivity(tailorId);
  if (isLoading) return <LoadingRows cols={3} rows={8} />;
  if (isError) return <ErrorState error={error} onRetry={refetch} />;
  const events: AdminTailorActivityEvent[] = Array.isArray(data) ? data : (data?.data ?? []);
  if (!events.length) return <NoData icon={IconHistory} title="No activity recorded" />;
  return (
    <div className="space-y-0">
      {events.map((ev) => (
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
