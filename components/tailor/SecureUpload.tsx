import { useEffect, useRef, useState } from "react";
import {
  IconUpload,
  IconCheck,
  IconClockHour4,
  IconAlertTriangle,
  IconFileText,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import { apiClient } from "@/lib/api/client";
import { useUploadSecureDoc, useDeleteSecureDoc } from "@/lib/api/queries/tailor";
import type { TailorDocument } from "@/lib/api/types";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { IconZoomIn } from "@tabler/icons-react";
import { toast } from "sonner";

/** Authenticated preview of an encrypted KYC document (admin or owner).
 *  Images render inline via an object-URL; PDFs show an "Open" button.
 *  The inline preview is a cropped thumbnail (object-cover) — clicking it opens
 *  a full-size, uncropped (object-contain) viewer so a reviewer can actually
 *  read the whole document before approving. Reviewers must be able to see
 *  every edge of a licence/ID, not just whatever survives the thumbnail crop. */
export function SecureDocImage({
  id,
  className = "",
  label,
}: {
  id: string;
  className?: string;
  /** Shown as the full-size viewer's title (e.g. "Trade licence"). */
  label?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [mime, setMime] = useState<string>("");
  const [err, setErr] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let revoke: string | null = null;
    let alive = true;
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
      <div
        className={`grid place-items-center bg-muted text-muted-foreground text-xs ${className}`}
      >
        Couldn't load
      </div>
    );
  if (!url)
    return (
      <div className={`grid place-items-center bg-muted ${className}`}>
        <span className="kh-shimmer w-full h-full" />
      </div>
    );
  if (mime === "application/pdf") {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className={`grid place-items-center bg-muted hover:bg-muted/70 transition-colors ${className}`}
      >
        <span className="inline-flex items-center gap-1.5 text-sm text-primary">
          <IconFileText size={18} /> Open PDF
        </span>
      </a>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="View full document"
        className={`relative group block ${className}`}
      >
        <img src={url} alt={label || "Document"} className="w-full h-full object-cover" />
        <span className="absolute inset-0 grid place-items-center bg-black/0 group-hover:bg-black/35 opacity-0 group-hover:opacity-100 transition-all">
          <IconZoomIn size={20} className="text-white drop-shadow" />
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[96vw] sm:max-w-5xl p-3 sm:p-4">
          <DialogTitle className="text-sm font-medium pr-8">
            {label || "Document"}
          </DialogTitle>
          <div className="grid place-items-center bg-muted rounded-md overflow-auto">
            <img
              src={url}
              alt={label || "Document"}
              className="max-h-[82vh] max-w-full object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

const STATUS_UI = {
  pending: {
    icon: IconClockHour4,
    label: "Under review",
    cls: "text-amber-600 bg-amber-50 border-amber-200",
  },
  approved: {
    icon: IconCheck,
    label: "Approved",
    cls: "text-green-700 bg-green-50 border-green-200",
  },
  rejected: {
    icon: IconAlertTriangle,
    label: "Re-upload needed",
    cls: "text-destructive bg-destructive/5 border-destructive/30",
  },
  expired: {
    icon: IconAlertTriangle,
    label: "Expired — upload a renewed copy",
    cls: "text-destructive bg-destructive/5 border-destructive/30",
  },
  // Not expected here in practice (the tailor's own onboarding view excludes
  // superseded rows server-side — see tailor-me.js GET /onboarding) but kept
  // for type-safety since DocStatus includes it for admin audit views.
  superseded: {
    icon: IconClockHour4,
    label: "Replaced",
    cls: "text-muted-foreground bg-muted border-border",
  },
} as const;

/** A single labelled KYC upload slot. Shows the current document's status (with
 *  a preview + reject reason) and lets the tailor upload or replace it. */
export function SecureUpload({
  docType,
  label,
  required,
  partnerId,
  doc,
  expiryDate,
  requiresExpiry,
  history,
}: {
  docType: string;
  label: string;
  required?: boolean;
  partnerId?: string | null;
  doc?: TailorDocument;
  /** The expiry date already declared elsewhere (e.g. the partner's Emirates ID
   *  expiry field) — sent with the upload so the backend can cross-check it
   *  against what OCR actually reads off the document. Leave undefined (not
   *  even an empty string) for a document type that has no such external
   *  field — this component then owns its own expiry-date input below. */
  expiryDate?: string | null;
  /** This document type is legally time-bound (trade licence, Ejari, Emirates
   *  ID, passport, residence visa) — the backend rejects an upload with no
   *  expiry date for these. See backend/src/lib/kyc.js DOC_TYPES. */
  requiresExpiry?: boolean;
  /** Past versions of this exact slot (same doc_type + partner), replaced by a
   *  later renewal upload — view-only, never deletable. Newest first. */
  history?: TailorDocument[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadSecureDoc();
  const del = useDeleteSecureDoc();
  const status = doc?.status;
  const [confirmRemove, setConfirmRemove] = useState(false);
  // Only used when the caller doesn't already manage this doc's expiry date
  // elsewhere (expiryDate === undefined) — see the prop doc above.
  const [ownExpiry, setOwnExpiry] = useState("");
  const managesOwnExpiry = requiresExpiry && expiryDate === undefined;
  const effectiveExpiry = managesOwnExpiry ? ownExpiry : expiryDate;

  const remove = () => {
    if (!doc) return;
    del.mutate(doc.id, {
      onSuccess: () => toast.success(`${label} removed`),
      onError: (err: unknown) =>
        toast.error((err as Error)?.message || "Couldn't remove the document"),
    });
  };
  const ui = status ? STATUS_UI[status] : null;
  // Once a document has ever been confirmed as real (approved, since expired,
  // or superseded by a renewal) it's part of the verification record and the
  // backend refuses to delete it — only an unreviewed upload (pending) or one
  // a reviewer already sent back (rejected) can still be removed outright.
  const canRemove = status === "pending" || status === "rejected";

  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (managesOwnExpiry && !ownExpiry) {
      toast.error("Enter the expiry date printed on this document first.");
      return;
    }
    upload.mutate(
      { file, docType, partnerId: partnerId ?? null, expiryDate: effectiveExpiry ?? null },
      {
        onSuccess: () => {
          toast.success(`${label} uploaded`);
          setOwnExpiry("");
        },
        onError: (err: unknown) => toast.error((err as Error)?.message || "Upload failed"),
      },
    );
  };

  return (
    <div className="rounded-xl border bg-card p-3.5">
      <div className="flex items-start gap-3">
        {doc ? (
          <SecureDocImage
            id={doc.id}
            className="w-14 h-14 rounded-lg overflow-hidden shrink-0 border"
          />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-muted grid place-items-center shrink-0 text-muted-foreground">
            <IconFileText size={20} />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{label}</span>
            {required && (
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Required
              </span>
            )}
          </div>
          {ui ? (
            <span
              className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full border text-xs font-medium ${ui.cls}`}
            >
              <ui.icon size={12} /> {ui.label}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground mt-1 block">Not uploaded yet</span>
          )}
          {status === "rejected" && doc?.rejection_reason && (
            <p className="text-xs text-destructive mt-1">{doc.rejection_reason}</p>
          )}
          {/* Heads-up as soon as our automated check spots a mismatch, before a
              human reviewer even gets to it — lets the tailor fix it right away
              instead of waiting a full review cycle to find out. */}
          {status === "pending" && doc?.declared_expiry_mismatch && (
            <p className="text-xs text-warning-foreground mt-1">
              The expiry date you entered ({doc.ocr_fields?.declared_expiry || "—"}) doesn't match
              what we read on the document ({doc.ocr_fields?.expiry || "unreadable"}). Double-check
              and re-upload if it needs correcting — this may otherwise delay approval.
            </p>
          )}
          {managesOwnExpiry && (
            <div className="mt-2 max-w-[200px]">
              <label className="text-[11px] text-muted-foreground block mb-1">
                Expiry date on the document
              </label>
              <input
                type="date"
                value={ownExpiry}
                onChange={(e) => setOwnExpiry(e.target.value)}
                className="w-full text-xs border rounded-md px-2 py-1 bg-card"
              />
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-muted transition-colors disabled:opacity-60"
        >
          {doc ? <IconRefresh size={14} /> : <IconUpload size={14} />}
          {upload.isPending ? "Uploading…" : doc ? "Replace" : "Upload"}
        </button>
        {doc && canRemove && (
          <button
            type="button"
            title="Remove document"
            onClick={() => setConfirmRemove(true)}
            disabled={del.isPending}
            className="shrink-0 inline-flex items-center justify-center p-1.5 rounded-lg border text-destructive hover:bg-destructive/5 transition-colors disabled:opacity-60"
          >
            <IconTrash size={14} />
          </button>
        )}
        <ConfirmDialog
          open={confirmRemove}
          onOpenChange={setConfirmRemove}
          title={`Remove ${label}?`}
          description="You'll need to upload it again to stay verified."
          confirmLabel="Remove"
          destructive
          onConfirm={remove}
        />
        <input
          ref={inputRef}
          type="file"
          title={`Upload ${label}`}
          accept="image/*,application/pdf"
          className="hidden"
          onChange={pick}
        />
      </div>
      {history && history.length > 0 && (
        <div className="mt-3 pt-3 border-t space-y-1.5">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Previous versions (view only)
          </p>
          {history.map((h) => (
            <div key={h.id} className="flex items-center gap-2.5 opacity-70">
              <SecureDocImage id={h.id} className="w-9 h-9 rounded-md overflow-hidden shrink-0 border" />
              <div className="min-w-0 text-xs">
                <span className="text-muted-foreground">
                  Replaced {new Date(h.created_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
