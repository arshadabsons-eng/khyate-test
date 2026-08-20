import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type RefObject } from "react";
import { Card, PageHeader } from "@/components/common/Page";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, NoData } from "@/components/common/AsyncStates";
import {
  useNextReviewDocument,
  useReviewDocument,
  useReleaseDocument,
  type KycReviewDocument,
} from "@/lib/api/queries/kyc-review";
import { usePerm } from "@/lib/api/queries/rbac";
import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";
import { OCR_FLAG_LABEL, FLAG_SEVERITY } from "@/lib/ocrFlags";
import {
  IconCheck,
  IconX,
  IconClipboardCheck,
  IconAlertTriangle,
  IconLoader2,
  IconFileText,
  IconPlayerSkipForward,
} from "@tabler/icons-react";

export const Route = createFileRoute("/_app/kyc-review")({ component: KycReviewPage });

function prettify(s: string | null | undefined) {
  if (!s) return "—";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function KycReviewPage() {
  const nextQ = useNextReviewDocument();
  const reviewMut = useReviewDocument();
  const releaseMut = useReleaseDocument();

  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  const payload = nextQ.data;
  const doc = payload && !payload.done ? payload.document : null;
  // Grading a document requires kyc_review:'edit' server-side. Without this the
  // page rendered fully-interactive Approve/Reject/Skip buttons to a view-only
  // reviewer: every grade 403'd, and because fetching the card had already
  // taken the claim-lock, the document was left locked to a reviewer who could
  // never actually grade it.
  const canGrade = usePerm("kyc_review", "edit");
  const busy = reviewMut.isPending || releaseMut.isPending || !canGrade;

  // A fresh card just arrived — close any leftover reject-reason UI from the last one.
  useEffect(() => {
    setRejecting(false);
    setReason("");
  }, [doc?.id]);

  useEffect(() => {
    if (rejecting) reasonRef.current?.focus();
  }, [rejecting]);

  function approve() {
    if (!doc || busy) return;
    reviewMut.mutate(
      { id: doc.id, verdict: "pass" },
      {
        onSuccess: () => toast.success("Approved"),
        onError: (e: unknown) => toast.error((e as Error)?.message || "Couldn't submit review"),
      },
    );
  }

  function submitReject() {
    if (!doc || busy) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      reasonRef.current?.focus();
      return;
    }
    reviewMut.mutate(
      { id: doc.id, verdict: "fail", reason: trimmed },
      {
        onSuccess: () => toast.message("Rejected — tailor notified to re-upload"),
        onError: (e: unknown) => toast.error((e as Error)?.message || "Couldn't submit review"),
      },
    );
  }

  function skip() {
    if (!doc || busy) return;
    releaseMut.mutate(doc.id, {
      onSuccess: () => nextQ.refetch(),
      onError: (e: unknown) => toast.error((e as Error)?.message || "Couldn't release document"),
    });
  }

  // Enter = approve (unless focus is in a text field). Escape = open/focus the
  // reject-reason field; while that field has focus, Enter submits the rejection
  // instead of the global approve — guarded below so approve never double-fires
  // while the reviewer is typing a reason.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!doc || busy) return;
      const target = e.target as HTMLElement | null;
      const inReasonField = target === reasonRef.current;

      if (e.key === "Escape") {
        e.preventDefault();
        if (rejecting) {
          setRejecting(false);
          setReason("");
        } else {
          setRejecting(true);
        }
        return;
      }

      if (e.key === "Enter") {
        if (inReasonField) {
          e.preventDefault();
          submitReject();
          return;
        }
        const tag = target?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) return;
        e.preventDefault();
        approve();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, busy, rejecting, reason]);

  return (
    <div>
      <PageHeader
        title="KYC Review Queue"
        description="Click Approve or press Enter to pass a document · press Escape to reject."
      />

      {nextQ.isError ? (
        <ErrorState
          error={nextQ.error}
          onRetry={() => nextQ.refetch()}
          title="Couldn't load the review queue"
        />
      ) : nextQ.isLoading && !nextQ.data ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
          <Skeleton className="h-[75vh]" />
          <Skeleton className="h-[75vh]" />
        </div>
      ) : !payload || payload.done ? (
        <Card>
          {payload && payload.done && payload.unassigned_reviewer ? (
            <NoData
              icon={IconAlertTriangle}
              title="You're not on a validator team yet"
              description="Documents are split across teams, but you haven't been added to one — ask an admin to add you on the Validator Teams page before you can review."
            />
          ) : (
            <NoData
              icon={IconClipboardCheck}
              title="Queue clear — nothing left to review"
              description="Every submitted document has been graded. Check back soon."
            />
          )}
        </Card>
      ) : doc ? (
        <ReviewCard
          doc={doc}
          reviewersRequired={payload.reviewers_required}
          passesSoFar={payload.passes_so_far}
          teamName={payload.team_name ?? null}
          busy={busy}
          canGrade={canGrade}
          isRefreshing={nextQ.isFetching}
          rejecting={rejecting}
          reason={reason}
          reasonRef={reasonRef}
          onReasonChange={setReason}
          onApprove={approve}
          onOpenReject={() => setRejecting(true)}
          onCancelReject={() => {
            setRejecting(false);
            setReason("");
          }}
          onSubmitReject={submitReject}
          onSkip={skip}
        />
      ) : null}
    </div>
  );
}

function ReviewCard({
  doc,
  reviewersRequired,
  passesSoFar,
  teamName,
  busy,
  canGrade,
  isRefreshing,
  rejecting,
  reason,
  reasonRef,
  onReasonChange,
  onApprove,
  onOpenReject,
  onCancelReject,
  onSubmitReject,
  onSkip,
}: {
  doc: KycReviewDocument;
  reviewersRequired: number;
  passesSoFar: number;
  teamName?: string | null;
  busy: boolean;
  canGrade: boolean;
  isRefreshing: boolean;
  rejecting: boolean;
  reason: string;
  reasonRef: RefObject<HTMLTextAreaElement | null>;
  onReasonChange: (v: string) => void;
  onApprove: () => void;
  onOpenReject: () => void;
  onCancelReject: () => void;
  onSubmitReject: () => void;
  onSkip: () => void;
}) {
  const ocrFields = doc.ocr_fields && typeof doc.ocr_fields === "object" ? doc.ocr_fields : null;
  const ocrFlags = (doc.ocr_flags ?? []).filter(Boolean);
  const declaredExpiry = ocrFields?.declared_expiry;
  const readExpiry = ocrFields?.expiry;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
      {/* Document preview */}
      <Card className="!p-0 overflow-hidden relative">
        <LargeSecureDoc key={doc.id} id={doc.id} />
        {(busy || isRefreshing) && (
          <div className="absolute inset-0 bg-background/60 grid place-items-center">
            <IconLoader2 size={28} className="animate-spin text-muted-foreground" />
          </div>
        )}
      </Card>

      {/* Details + actions */}
      <div className="space-y-4">
        <Card>
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
            {prettify(doc.doc_type)}
          </div>
          <div className="text-lg font-semibold">{doc.business_name || "—"}</div>
          <div className="text-sm text-muted-foreground">
            {[doc.city, doc.partner_name ? `${doc.partner_name} · ${doc.partner_role}` : null]
              .filter(Boolean)
              .join(" · ") || "—"}
          </div>
          {doc.id_number && (
            <div className="text-xs text-muted-foreground mt-2">
              Entered ID: <span className="font-mono">{doc.id_number}</span>
            </div>
          )}
          <div className="mt-3 text-xs font-medium text-muted-foreground">
            Reviewers required: {reviewersRequired} · Passes so far: {passesSoFar}
            {teamName ? ` · ${teamName}` : ""}
          </div>
        </Card>

        {doc.declared_expiry_mismatch && (
          <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2.5">
            <IconAlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>
              Expiry mismatch — the tailor entered <strong>{String(declaredExpiry ?? "—")}</strong>,
              but the document appears to read <strong>{String(readExpiry ?? "unreadable")}</strong>
              .
            </span>
          </div>
        )}

        {ocrFlags.length > 0 && (
          <div className="space-y-1.5">
            {ocrFlags.map((f) => {
              const danger = FLAG_SEVERITY[f] !== "amber";
              return (
                <div
                  key={f}
                  className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border ${
                    danger
                      ? "text-destructive bg-destructive/10 border-destructive/30"
                      : "text-amber-700 bg-amber-50 border-amber-200"
                  }`}
                >
                  <IconAlertTriangle size={13} />
                  {OCR_FLAG_LABEL[f] || f}
                </div>
              );
            })}
          </div>
        )}

        {doc.ocr_status === "done" && ocrFields && Object.keys(ocrFields).length > 0 && (
          <Card title="OCR-extracted fields">
            <dl className="space-y-2">
              {Object.entries(ocrFields).map(([key, value]) => (
                <div key={key} className="flex items-baseline justify-between gap-3 text-sm">
                  <dt className="text-muted-foreground shrink-0">{prettify(key)}</dt>
                  <dd className="font-mono text-right break-all">
                    {value === null || value === undefined || value === "" ? "—" : String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        )}
        {doc.ocr_status && doc.ocr_status !== "done" && (
          <div className="text-xs text-muted-foreground px-1">
            OCR: {prettify(doc.ocr_status)} — compare the document manually.
          </div>
        )}

        {/* Actions */}
        <Card>
          {!canGrade && (
            <div className="mb-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-muted-foreground">
              You have read-only access to KYC validation, so grading is disabled.
              Ask an administrator for <span className="font-medium">KYC Validation: edit</span> to review documents.
            </div>
          )}
          {!rejecting ? (
            <div className="space-y-2">
              <Button
                type="button"
                disabled={busy}
                onClick={onApprove}
                className="w-full h-12 text-base bg-success hover:bg-success/90 text-success-foreground"
              >
                <IconCheck size={20} className="mr-2" /> Approve
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={busy}
                onClick={onOpenReject}
                className="w-full h-12 text-base"
              >
                <IconX size={20} className="mr-2" /> Reject
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={onSkip}
                className="w-full"
              >
                <IconPlayerSkipForward size={14} className="mr-1.5" /> Skip for now
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Why is this document being rejected? (the tailor sees this)
              </label>
              <Textarea
                ref={reasonRef}
                value={reason}
                onChange={(e) => onReasonChange(e.target.value)}
                placeholder="e.g. Photo is blurry, ID number doesn't match…"
                disabled={busy}
                rows={3}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  disabled={busy || !reason.trim()}
                  onClick={onSubmitReject}
                  className="flex-1"
                >
                  <IconX size={16} className="mr-1.5" /> Submit rejection
                </Button>
                <Button type="button" variant="outline" disabled={busy} onClick={onCancelReject}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/** Authenticated large preview of an encrypted KYC document — same auth-fetch →
 *  blob-URL pattern as SecureDocImage (components/tailor/SecureUpload.tsx), but
 *  sized/fitted for a single-document focused review instead of a grid thumbnail
 *  (object-contain so nothing is cropped, and a full-height panel). */
function LargeSecureDoc({ id }: { id: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [mime, setMime] = useState<string>("");
  const [err, setErr] = useState(false);

  useEffect(() => {
    let revoke: string | null = null;
    let alive = true;
    setUrl(null);
    setErr(false);
    apiClient
      .fetchSecureDocUrl(id)
      .then((r) => {
        if (alive) {
          setUrl(r.url);
          setMime(r.mime);
          revoke = r.url;
        }
      })
      .catch(() => alive && setErr(true));
    return () => {
      alive = false;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [id]);

  if (err)
    return (
      <div className="grid place-items-center h-[75vh] bg-muted text-muted-foreground text-sm">
        Couldn't load this document
      </div>
    );
  if (!url)
    return (
      <div className="grid place-items-center h-[75vh] bg-muted">
        <IconLoader2 size={28} className="animate-spin text-muted-foreground" />
      </div>
    );
  if (mime === "application/pdf") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="flex flex-col items-center justify-center gap-2 h-[75vh] bg-muted hover:bg-muted/70 transition-colors"
      >
        <IconFileText size={40} className="text-primary" />
        <span className="text-sm text-primary font-medium">Open PDF in new tab</span>
      </a>
    );
  }
  return (
    <div className="h-[75vh] bg-muted grid place-items-center">
      <img src={url} alt="Document under review" className="max-h-full max-w-full object-contain" />
    </div>
  );
}
