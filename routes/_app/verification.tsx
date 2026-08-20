import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, PageHeader } from "@/components/common/Page";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Avatar } from "@/components/common/Avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, NoData } from "@/components/common/AsyncStates";
import {
  useVerificationQueue,
  useVerificationDetail,
  useApproveVerification,
  useRejectVerification,
  useApproveDocument,
  useRejectDocument,
  type VerificationFilter,
} from "@/lib/api/queries/tailors";
import { SecureDocImage } from "@/components/tailor/SecureUpload";
import { ReasonDialog } from "@/components/common/ReasonDialog";
import { fmtDate, fmtNumber, initialsOf } from "@/lib/format";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/client";
import { auth } from "@/lib/auth";
import { usePerm } from "@/lib/api/queries/rbac";
import { OCR_FLAG_LABEL, FLAG_SEVERITY } from "@/lib/ocrFlags";
import {
  IconCheck,
  IconX,
  IconShieldCheck,
  IconArrowDown,
  IconAlertTriangle,
  IconCircleCheck,
} from "@tabler/icons-react";

export const Route = createFileRoute("/_app/verification")({ component: VerificationPage });

// Only the states the backend's GET /verification/queue actually understands —
// every other value used to fall through to its "pending" default, making 4 of
// the previous 5 tabs render an identical list. "Flagged" is derived client-side
// below from has_red_flags (a document that was rejected at least once) rather
// than sent as a fake status param the backend would ignore.
const FILTERS: Array<{ key: VerificationFilter; label: string }> = [
  { key: "pending", label: "Pending" },
  { key: "rejected", label: "Rejected" },
  { key: "active", label: "Verified" },
  { key: "all", label: "All" },
];

function VerificationPage() {
  const [filter, setFilter] = useState<VerificationFilter>("pending");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const queueQ = useVerificationQueue(filter);
  const items = (queueQ.data?.data ?? []).filter((t) => !flaggedOnly || t.has_red_flags);

  // Auto-select the first item in the queue when none is selected.
  useEffect(() => {
    if (!selectedId && items.length > 0) setSelectedId(items[0].tailor_id);
    if (selectedId && !items.find((i) => i.tailor_id === selectedId) && items.length > 0) {
      setSelectedId(items[0].tailor_id);
    }
  }, [items, selectedId]);

  return (
    <div>
      <PageHeader
        title="Verification Queue"
        description={
          items.length ? `${fmtNumber(items.length)} tailors awaiting review` : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex flex-wrap gap-1 bg-muted/40 p-1 rounded-lg w-fit">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded ${
                filter === f.key ? "bg-card shadow-sm" : "text-muted-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setFlaggedOnly((v) => !v)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
            flaggedOnly
              ? "border-destructive/40 bg-destructive/5 text-destructive"
              : "text-muted-foreground hover:bg-muted/40"
          }`}
        >
          <IconAlertTriangle size={13} /> Flagged only
        </button>
      </div>

      {queueQ.isError ? (
        <ErrorState
          error={queueQ.error}
          onRetry={() => queueQ.refetch()}
          title="Couldn't load queue"
        />
      ) : queueQ.isLoading && !queueQ.data ? (
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
          <Skeleton className="h-[70vh]" />
          <Skeleton className="h-[70vh]" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <NoData
            icon={IconShieldCheck}
            title="Queue empty — nice work."
            description="No tailors are awaiting verification right now."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
          <Card className="!p-0 overflow-hidden">
            <ul className="divide-y max-h-[75vh] overflow-y-auto">
              {items.map((t) => {
                const active = selectedId === t.tailor_id;
                const days = t.days_in_queue;
                const ageColor =
                  days < 2
                    ? "text-success"
                    : days <= 4
                      ? "text-warning"
                      : "text-destructive font-semibold";
                return (
                  <li key={t.tailor_id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(t.tailor_id)}
                      className={`w-full text-left p-3 flex items-center gap-3 hover:bg-muted/40 transition-colors ${
                        active ? "bg-primary-soft border-l-4 border-primary pl-2" : ""
                      }`}
                    >
                      <Avatar initials={initialsOf(t.full_name)} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{t.full_name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {t.business_name} · {t.city}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {t.document_count} docs · {fmtDate(t.submitted_at)}
                        </div>
                        {t.needs_reapproval && (
                          <span className="inline-flex items-center mt-1 px-1.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-medium">
                            Re-approval
                          </span>
                        )}
                      </div>
                      {t.has_red_flags && (
                        <IconAlertTriangle size={14} className="text-destructive shrink-0" />
                      )}
                      <span className={`text-xs tabular-nums ${ageColor}`}>{days}d</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          <SelectedTailorPanel selectedId={selectedId} onActioned={() => setSelectedId(null)} />
        </div>
      )}
    </div>
  );
}

function SelectedTailorPanel({
  selectedId,
  onActioned,
}: {
  selectedId: string | null;
  onActioned: () => void;
}) {
  const detailQ = useVerificationDetail(selectedId);
  const approve = useApproveVerification();
  const reject = useRejectVerification();
  const approveDoc = useApproveDocument();
  const rejectDoc = useRejectDocument();
  // Approve all / Reject tailor / per-doc approve-reject are write actions.
  // Gated on the SAME permission the backend enforces (verification:'edit'),
  // not auth.canWrite()'s coarse rank >= 2 — that was wrong in both
  // directions: it hid these from a rank-1 role explicitly granted
  // verification:edit, and showed them to any rank-2 role whose matrix says
  // view/none, who then 403'd on every click.
  const canWrite = usePerm("verification", "edit");

  // Every action here used to drive window.prompt() — a native browser dialog
  // that looks like a system error/warning box next to the rest of this app's
  // styled UI, same cleanup already applied on the tailor detail page. One
  // piece of dialog state drives a single in-app ReasonDialog instead.
  const [dialog, setDialog] = useState<
    | { type: "approve-force"; message: string; tailorId: string }
    | { type: "reject-doc"; docId: string }
    | { type: "reject-tailor"; tailorId: string }
    | null
  >(null);

  if (!selectedId) {
    return (
      <Card>
        <NoData
          icon={IconArrowDown}
          title="Select a tailor"
          description="Pick an item from the queue to review."
        />
      </Card>
    );
  }
  if (detailQ.isLoading) return <Skeleton className="h-[75vh]" />;
  if (detailQ.isError)
    return (
      <ErrorState
        error={detailQ.error}
        onRetry={() => detailQ.refetch()}
        title="Couldn't load tailor"
      />
    );
  if (!detailQ.data) return <NoData title="Not found" />;

  const detail = detailQ.data;
  const docs = detail.documents ?? [];
  const partners = detail.partners ?? [];
  const businessDocs = docs.filter((d) => !d.partner_id);

  const doApproveDoc = (docId: string) =>
    approveDoc.mutate(docId, {
      onSuccess: (r) =>
        toast.success(
          r?.activated ? "Approved — tailor is now verified & live 🎉" : "Document approved",
        ),
      onError: (e: unknown) => toast.error((e as Error)?.message || "Couldn't approve"),
    });
  // The backend rejects activating an incomplete tailor with a 409 unless
  // force:true is explicitly passed (an intentional AML guard, see
  // admin-extra.js) — this "Approve all" button exists specifically for the
  // rare legitimate override case, so a bare 409 with no way to proceed made
  // it non-functional for its whole stated purpose. On 409, ask for a reason
  // and retry forced; any other error just surfaces normally.
  const doApproveAll = (tailorId: string) => {
    approve.mutate(
      { tailorId },
      {
        onSuccess: () => {
          toast.success("Tailor approved & activated");
          onActioned();
        },
        onError: (e: unknown) => {
          const err = e as ApiError;
          if (err?.status === 409) {
            setDialog({ type: "approve-force", message: err.message, tailorId });
            return;
          }
          toast.error(err?.message || "Couldn't approve this tailor");
        },
      },
    );
  };
  const doApproveForce = (tailorId: string, reason: string) => {
    approve.mutate(
      { tailorId, force: true, force_reason: reason },
      {
        onSuccess: () => {
          toast.success("Tailor approved & activated (forced override)");
          onActioned();
        },
        onError: (e2: unknown) =>
          toast.error((e2 as Error)?.message || "Couldn't approve this tailor"),
      },
    );
  };
  const doRejectDoc = (docId: string, reason: string) => {
    rejectDoc.mutate(
      { docId, reason },
      {
        onSuccess: (r) =>
          toast.message(
            r?.demoted
              ? "Document rejected — this tailor's storefront is now paused until they resubmit."
              : "Document rejected — tailor notified to re-upload",
          ),
        onError: (e: unknown) => toast.error((e as Error)?.message || "Couldn't reject"),
      },
    );
  };
  const doRejectTailor = (tailorId: string, reason: string) => {
    reject.mutate(
      { tailorId, reason_code: "documents_unclear", custom_text: reason, can_resubmit: true },
      {
        onSuccess: () => {
          toast.message("Tailor rejected — notified to re-submit");
          onActioned();
        },
        onError: (e: unknown) =>
          toast.error((e as Error)?.message || "Couldn't reject this tailor"),
      },
    );
  };
  const openRejectDoc = (docId: string) => setDialog({ type: "reject-doc", docId });

  return (
    <>
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          <div className="flex items-center gap-4 min-w-0">
            <Avatar initials={initialsOf(detail.full_name)} size={56} />
            <div className="flex-1 min-w-0">
              <div className="text-lg font-semibold flex items-center gap-2 min-w-0">
                <span className="truncate">{detail.full_name}</span>
                {detail.is_complete && (
                  <IconCircleCheck size={18} className="text-success shrink-0" />
                )}
              </div>
              <div className="text-sm text-muted-foreground truncate">
                {detail.business_name} · {detail.email}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {detail.city}
                {detail.phone ? ` · ${detail.phone}` : ""}
              </div>
              {!detail.is_complete && (detail.approval_blockers?.length ?? 0) > 0 && (
                <div className="mt-1.5 inline-flex items-start gap-1.5 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
                  <IconAlertTriangle size={12} className="mt-0.5 shrink-0" />
                  <span>
                    Awaiting from the tailor:{" "}
                    {(detail.approval_blockers ?? [])
                      .map(
                        (b) =>
                          ({
                            email_unverified: "email verification",
                            phone_unverified: "mobile verification",
                            trn_missing: "a valid 15-digit TRN",
                          })[b] || b,
                      )
                      .join(" · ")}
                  </span>
                </div>
              )}
            </div>
          </div>
          {canWrite &&
            (!detail.verified ? (
              <div className="flex gap-2 shrink-0">
                <Button
                  type="button"
                  disabled={approve.isPending}
                  title="Override: activate this tailor now"
                  onClick={() => selectedId && doApproveAll(selectedId)}
                  className="bg-success hover:bg-success/90 text-success-foreground"
                >
                  <IconCheck size={16} className="mr-1" /> Approve all
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={reject.isPending}
                  onClick={() =>
                    selectedId && setDialog({ type: "reject-tailor", tailorId: selectedId })
                  }
                >
                  <IconX size={16} className="mr-1" /> Reject tailor
                </Button>
              </div>
            ) : (
              // Approve/Reject are onboarding-queue decisions — a tailor that's
              // already verified doesn't need either; suspending one instead is
              // a lifecycle action that lives on the tailor's own detail page.
              <span className="text-xs text-muted-foreground shrink-0">Already verified</span>
            ))}
        </div>

        {docs.length === 0 ? (
          <NoData
            title="No documents submitted yet"
            description="The tailor hasn't uploaded their KYC documents."
          />
        ) : (
          <div className="space-y-6">
            {/* Business documents */}
            <DocGroup
              title="Business documents"
              docs={businessDocs}
              busy={approveDoc.isPending || rejectDoc.isPending}
              canWrite={canWrite}
              onApprove={doApproveDoc}
              onReject={openRejectDoc}
            />
            {/* Per-partner documents */}
            {partners.map((p) => (
              <DocGroup
                key={p.id}
                title={`${p.full_name} · ${p.role}`}
                subtitle={[
                  p.email || null,
                  p.emirates_id_number ? `EID: ${p.emirates_id_number}` : null,
                  p.nationality,
                  p.emirates_id_expiry ? `Expires ${fmtDate(p.emirates_id_expiry)}` : null,
                  p.ownership_pct != null ? `${p.ownership_pct}% ownership (self-declared)` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                warning={p.sanctions_flag}
                docs={docs.filter((d) => d.partner_id === p.id)}
                busy={approveDoc.isPending || rejectDoc.isPending}
                canWrite={canWrite}
                onApprove={doApproveDoc}
                onReject={openRejectDoc}
              />
            ))}
          </div>
        )}
      </Card>

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
          if (dialog?.type !== "approve-force") return;
          const { tailorId } = dialog;
          setDialog(null);
          doApproveForce(tailorId, reason);
        }}
      />
      <ReasonDialog
        open={dialog?.type === "reject-doc"}
        onOpenChange={(v) => !v && setDialog(null)}
        title="Reject this document?"
        description="The tailor sees this reason and can re-upload."
        label="Rejection reason"
        confirmLabel="Reject"
        destructive
        onConfirm={(reason) => {
          if (dialog?.type !== "reject-doc") return;
          const { docId } = dialog;
          setDialog(null);
          doRejectDoc(docId, reason);
        }}
      />
      <ReasonDialog
        open={dialog?.type === "reject-tailor"}
        onOpenChange={(v) => !v && setDialog(null)}
        title="Reject this tailor's application?"
        description="They'll be notified and can re-submit after addressing the issue."
        label="Rejection reason"
        confirmLabel="Reject"
        destructive
        onConfirm={(reason) => {
          if (dialog?.type !== "reject-tailor") return;
          const { tailorId } = dialog;
          setDialog(null);
          doRejectTailor(tailorId, reason);
        }}
      />
    </>
  );
}

function DocGroup({
  title,
  subtitle,
  warning,
  docs,
  busy,
  canWrite,
  onApprove,
  onReject,
}: {
  title: string;
  subtitle?: string;
  /** Advisory-only banner (e.g. a sanctions-list name match) — never implies
   *  an automatic block, just a prompt for the reviewer to look closer. */
  warning?: string | null;
  docs: {
    id: string;
    doc_type: string;
    status: string;
    label?: string;
    rejection_reason?: string | null;
    id_number?: string | null;
    ocr_flags?: string[] | null;
    ocr_fields?: { expiry?: string | null; declared_expiry?: string | null } | null;
    declared_expiry_mismatch?: boolean;
  }[];
  busy: boolean;
  canWrite: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <div>
      <div className="mb-2">
        <div className="font-medium text-sm">{title}</div>
        {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
        {warning && (
          <div className="mt-1.5 flex items-start gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
            <IconAlertTriangle size={14} className="mt-0.5 shrink-0" />
            <span>
              Possible sanctions-list match: {warning}. Advisory only — verify manually before
              approving.
            </span>
          </div>
        )}
      </div>
      {docs.length === 0 ? (
        <p className="text-xs text-muted-foreground">No documents in this section.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {docs.map((d) => {
            const otherFlags = (d.ocr_flags ?? []).filter((f) => f !== "expiry_mismatch");
            return (
              <div
                key={d.id}
                className={`border rounded-md p-3 flex flex-col h-full ${d.declared_expiry_mismatch ? "border-destructive/50 bg-destructive/5" : ""}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs uppercase text-muted-foreground tracking-wider">
                    {d.label || d.doc_type.replace(/_/g, " ")}
                  </div>
                  <StatusBadge status={d.status} />
                </div>
                {d.id_number && (
                  <div className="text-xs text-muted-foreground mb-2">
                    Entered ID: <span className="font-mono">{d.id_number}</span>
                  </div>
                )}
                <SecureDocImage
                  id={d.id}
                  label={d.label || d.doc_type.replace(/_/g, " ")}
                  className="aspect-[3/2] w-full rounded bg-muted overflow-hidden"
                />
                {d.declared_expiry_mismatch && (
                  <div className="mt-2 flex items-start gap-1.5 text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded px-2 py-1.5">
                    <IconAlertTriangle size={13} className="mt-0.5 shrink-0" />
                    <span>
                      Expiry mismatch — the tailor entered{" "}
                      <strong>{d.ocr_fields?.declared_expiry || "—"}</strong>, but the document
                      appears to read <strong>{d.ocr_fields?.expiry || "unreadable"}</strong>. Ask
                      the tailor to correct the date and re-upload, or reject with that reason.
                    </span>
                  </div>
                )}
                {otherFlags.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {otherFlags.map((f) => {
                      const danger = FLAG_SEVERITY[f] !== "amber";
                      return (
                        <div
                          key={f}
                          className={`flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-md border ${
                            danger
                              ? "text-destructive bg-destructive/10 border-destructive/30"
                              : "text-amber-700 bg-amber-50 border-amber-200"
                          }`}
                        >
                          <IconAlertTriangle size={12} className="shrink-0" />
                          {OCR_FLAG_LABEL[f] || f}
                        </div>
                      );
                    })}
                  </div>
                )}
                {d.status === "rejected" && d.rejection_reason && (
                  <p className="text-xs text-destructive mt-2">{d.rejection_reason}</p>
                )}
                {canWrite && (
                  <div className="flex gap-2 pt-2 mt-auto">
                    <Button
                      size="sm"
                      disabled={busy || d.status === "approved"}
                      onClick={() => onApprove(d.id)}
                      className="flex-1 bg-success hover:bg-success/90 text-success-foreground disabled:opacity-50"
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={busy || d.status === "rejected"}
                      onClick={() => onReject(d.id)}
                      className="flex-1"
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
