import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { Card, PageHeader } from "@/components/common/Page";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, NoData } from "@/components/common/AsyncStates";
import { Avatar } from "@/components/common/Avatar";
import {
  useDispute,
  usePostDisputeMessage,
  useResolveDispute,
  useClaimDispute,
  useReleaseDispute,
  useFlagGenuine,
  useCloseDispute,
} from "@/lib/api/queries/disputes";
import { fmtDateTime, filsToAed, initialsOf } from "@/lib/format";
import { useRbacMe } from "@/lib/api/queries/rbac";
import { auth } from "@/lib/auth";
import { toast } from "sonner";
import type { ResolutionAction } from "@/lib/api/types";
import { IconAlertTriangle, IconFlag, IconCheck } from "@tabler/icons-react";

export const Route = createFileRoute("/_app/disputes/$id")({ component: DisputeDetail });

const RESOLUTION_OPTIONS: Array<{ value: ResolutionAction; label: string; needsAmount?: boolean }> =
  [
    { value: "full_refund_to_customer", label: "Full Refund to Customer", needsAmount: true },
    { value: "partial_refund", label: "Partial Refund", needsAmount: true },
    { value: "reject_claim", label: "Reject Claim" },
    { value: "require_redo", label: "Require Redo" },
    { value: "issue_warning_to_tailor", label: "Issue Warning to Tailor" },
    { value: "suspend_tailor", label: "Suspend Tailor" },
  ];

function DisputeDetail() {
  const { id } = useParams({ from: "/_app/disputes/$id" });
  const q = useDispute(id);
  const claim = useClaimDispute();
  const release = useReleaseDispute();
  const postMsg = usePostDisputeMessage();
  const resolve = useResolveDispute();
  const closeDispute = useCloseDispute();
  const flagGenuine = useFlagGenuine();
  // Helpdesk (support_agent) can investigate + flag genuine, but only admins
  // issue refunds. Gate on the SAME permission the backend actually enforces —
  // disputes.js's RESOLVE is rbac.requirePermission('finance', 'edit') — rather
  // than auth.canWrite()'s coarse adminRank() >= 2. A custom role explicitly
  // granted finance:edit from Roles & Permissions would have its resolve call
  // accepted by the server but was shown the read-only "an admin will issue the
  // refund" panel instead of the resolution form. Falls back to the rank check
  // only while /rbac/me is still loading, so nothing flashes as forbidden.
  const financeLevel = useRbacMe().data?.permissions.finance;
  const canWrite = financeLevel ? financeLevel === "edit" || financeLevel === "admin" : auth.canWrite();

  const [showInternalOnly, setShowInternalOnly] = useState(false);
  const [reply, setReply] = useState("");
  const [replyInternal, setReplyInternal] = useState(false);
  const [action, setAction] = useState<ResolutionAction>("full_refund_to_customer");
  const [refundAmount, setRefundAmount] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");

  if (q.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  if (q.isError)
    return <ErrorState error={q.error} onRetry={() => q.refetch()} title="Couldn't load dispute" />;
  if (!q.data) return <NoData icon={IconAlertTriangle} title="Dispute not found" />;

  const detail = q.data;
  const d = detail.dispute;
  const isResolved = d.status === "resolved";
  const isClosed = d.status === "closed";
  const isTerminal = isResolved || isClosed;
  // The backend only allows claim/flag-genuine/resolve/close/message-post once
  // a dispute is actually escalated (escalated_at set) — before that it's a
  // peer-to-peer conversation between the customer and tailor, and every one
  // of those calls 409s for an admin. This page used to show all of them
  // regardless of status, with no error handling on most of the mutations, so
  // clicking any of them on a still-open/peer_resolution dispute just did
  // nothing with zero feedback.
  const isEscalated = d.status === "escalated";
  const resolutionOption = RESOLUTION_OPTIONS.find((o) => o.value === action);
  const needsAmount = !!resolutionOption?.needsAmount;
  const mutationErrorToast = (fallback: string) => (e: unknown) =>
    toast.error((e as Error)?.message || fallback);

  return (
    <div>
      <PageHeader
        title={d.dispute_number}
        description={
          <span className="inline-flex items-center gap-3">
            <Link to="/disputes" className="text-primary hover:underline">
              ← All disputes
            </Link>
            <span className="text-muted-foreground">·</span>
            <Link to="/orders/$id" params={{ id: d.order_id }} className="text-primary hover:underline">
              Order {d.order_number}
            </Link>
          </span>
        }
        actions={
          <>
            <StatusBadge status={d.dispute_type} />
            <StatusBadge status={d.status} />
            {detail.flagged_genuine && (
              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-warning/15 text-warning">
                <IconFlag size={13} /> Flagged genuine
              </span>
            )}
            {!d.assigned_to && isEscalated && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={claim.isPending}
                onClick={() =>
                  claim.mutate(id, {
                    onError: mutationErrorToast("Couldn't claim this dispute"),
                  })
                }
              >
                Claim
              </Button>
            )}
            {d.assigned_to && !isTerminal && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={release.isPending}
                onClick={() =>
                  release.mutate(id, {
                    onSuccess: () => toast.success("Dispute released — anyone can claim it now."),
                    onError: mutationErrorToast("Couldn't release this dispute"),
                  })
                }
              >
                Release claim
              </Button>
            )}
            {!isTerminal && !detail.flagged_genuine && isEscalated && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={flagGenuine.isPending}
                onClick={() =>
                  flagGenuine.mutate(id, {
                    onSuccess: () =>
                      toast.success("Flagged as genuine — an admin will issue the refund."),
                    onError: mutationErrorToast("Couldn't flag this dispute"),
                  })
                }
              >
                <IconFlag size={14} className="mr-1.5" /> Flag as genuine
              </Button>
            )}
          </>
        }
      />

      {d.assigned_to && (
        <div className="mb-4 text-sm text-muted-foreground">
          Assigned to <span className="font-medium text-foreground">{d.assigned_to.name}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title={`Customer Claim · ${detail.customer.name}`}>
          <p className="text-sm whitespace-pre-wrap">{detail.customer.claim_text}</p>
          {detail.customer.evidence_urls.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-4">
              {detail.customer.evidence_urls.map((url) => (
                <img
                  key={url}
                  src={url}
                  alt=""
                  className="aspect-square rounded object-cover bg-muted"
                />
              ))}
            </div>
          )}
        </Card>
        <Card title={`Tailor Response · ${detail.tailor.name}`}>
          {detail.tailor.response_text ? (
            <>
              <p className="text-sm whitespace-pre-wrap">{detail.tailor.response_text}</p>
              {detail.tailor.evidence_urls.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mt-4">
                  {detail.tailor.evidence_urls.map((url) => (
                    <img
                      key={url}
                      src={url}
                      alt=""
                      className="aspect-square rounded object-cover bg-muted"
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <NoData
              title="Awaiting tailor response"
              description={`SLA window remaining: ${Math.max(
                0,
                Math.floor(d.time_remaining_seconds / 3600),
              )}h`}
            />
          )}
        </Card>
      </div>

      <Card
        title="Message Thread"
        action={
          <label className="text-xs flex items-center gap-2">
            <input
              type="checkbox"
              checked={showInternalOnly}
              onChange={(e) => setShowInternalOnly(e.target.checked)}
            />{" "}
            Internal notes only
          </label>
        }
        className="mt-6"
      >
        {detail.messages.length === 0 ? (
          <NoData title="No messages yet" />
        ) : (
          <ul className="space-y-3">
            {detail.messages
              .filter((m) => !showInternalOnly || m.is_internal)
              .map((m) => (
                <li
                  key={m.id}
                  className={`flex gap-3 ${m.is_internal ? "border-l-2 border-warning pl-3" : ""}`}
                >
                  <Avatar initials={initialsOf(m.sender_name)} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs">
                      <span className="font-medium">{m.sender_name}</span>
                      <span className="text-muted-foreground ml-2 capitalize">{m.sender_role}</span>
                      <span className="text-muted-foreground ml-2">
                        {fmtDateTime(m.created_at)}
                      </span>
                      {m.is_internal && (
                        <span className="ml-2 text-warning font-medium">Internal</span>
                      )}
                    </div>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{m.body}</p>
                  </div>
                </li>
              ))}
          </ul>
        )}
        {isTerminal ? null : !isEscalated ? (
          <div className="mt-4 border-t pt-4 text-sm text-muted-foreground">
            This dispute is still in peer resolution between the customer and tailor — a
            support/admin reply isn't possible until either side escalates it here.
          </div>
        ) : (
          <div className="mt-4 border-t pt-4">
            <Textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Reply…"
            />
            <div className="flex justify-between items-center mt-2">
              <label className="text-xs flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={replyInternal}
                  onChange={(e) => setReplyInternal(e.target.checked)}
                />{" "}
                Internal note
              </label>
              <Button
                type="button"
                disabled={postMsg.isPending || !reply.trim()}
                onClick={() => {
                  postMsg.mutate(
                    { id, content: reply, is_internal: replyInternal },
                    {
                      onSuccess: () => {
                        setReply("");
                        setReplyInternal(false);
                      },
                      onError: mutationErrorToast("Couldn't send that message"),
                    },
                  );
                }}
              >
                {postMsg.isPending ? "Sending…" : "Send"}
              </Button>
            </div>
          </div>
        )}
      </Card>

      {isResolved ? (
        <Card className="mt-6">
          <div className="bg-success/10 border border-success/30 rounded p-4">
            <div className="font-semibold text-success">Dispute resolved</div>
            {detail.resolution && (
              <div className="text-sm mt-2 space-y-1">
                <div>
                  Outcome:{" "}
                  <span className="font-medium capitalize">
                    {detail.resolution.action.replace(/_/g, " ")}
                  </span>
                </div>
                {detail.resolution.refund_amount_fils != null && (
                  <div>Refund: {filsToAed(detail.resolution.refund_amount_fils)}</div>
                )}
                <div className="text-muted-foreground">{detail.resolution.note}</div>
                <div className="text-xs text-muted-foreground">
                  Resolved by {detail.resolution.resolved_by_name} ·{" "}
                  {fmtDateTime(detail.resolution.resolved_at)}
                </div>
              </div>
            )}
          </div>
        </Card>
      ) : isClosed ? (
        <Card className="mt-6">
          <div className="bg-muted border rounded p-4">
            <div className="font-semibold">Dispute closed</div>
            <p className="text-sm text-muted-foreground mt-1">
              {detail.resolution?.note || "Closed without a refund or further action."}
            </p>
          </div>
        </Card>
      ) : !isEscalated ? (
        <Card title="Resolution" className="mt-6">
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <IconCheck size={18} className="mt-0.5 shrink-0 text-primary" />
            <p>
              This dispute is still in peer resolution between the customer and tailor — it can only
              be claimed, flagged, or resolved by support once either side escalates it.
            </p>
          </div>
        </Card>
      ) : !canWrite ? (
        <Card title="Resolution" className="mt-6">
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <IconCheck size={18} className="mt-0.5 shrink-0 text-primary" />
            <p>
              Refunds and final resolutions are issued by an admin. Investigate, add internal notes,
              and use <span className="font-medium text-foreground">Flag as genuine</span> if the
              claim is valid — an admin will then issue the refund.
            </p>
          </div>
        </Card>
      ) : (
        <Card title="Resolution" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as ResolutionAction)}
              aria-label="Resolution action"
              title="Resolution action"
              className="border rounded-md px-3 py-2 text-sm bg-card"
            >
              {RESOLUTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {needsAmount && (
              <Input
                placeholder="Refund amount AED"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
              />
            )}
            <Input
              placeholder="Resolution note"
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              className="md:col-span-1"
            />
          </div>
          <Button
            type="button"
            disabled={resolve.isPending || resolutionNote.trim().length < 20}
            onClick={() =>
              resolve.mutate(
                {
                  id,
                  action,
                  refund_amount_fils: needsAmount
                    ? Math.round(parseFloat(refundAmount || "0") * 100)
                    : undefined,
                  resolution_note: resolutionNote,
                },
                { onError: mutationErrorToast("Couldn't resolve this dispute") },
              )
            }
            className="mt-4 bg-success hover:bg-success/90 text-success-foreground"
          >
            {resolve.isPending ? "Resolving…" : "Confirm Resolution"}
          </Button>
          {resolutionNote.trim().length > 0 && resolutionNote.trim().length < 20 && (
            <div className="text-xs text-muted-foreground mt-1">
              Note must be at least 20 characters.
            </div>
          )}
          {/* Quick end/close for escalated or stale disputes (no refund). */}
          <div className="mt-3 border-t pt-3">
            <Button
              type="button"
              variant="outline"
              disabled={closeDispute.isPending}
              onClick={() => {
                if (!window.confirm("End this dispute without a refund? It will be marked closed."))
                  return;
                closeDispute.mutate(
                  { id, note: resolutionNote.trim() || undefined },
                  {
                    onSuccess: () => toast.success("Dispute closed"),
                    onError: mutationErrorToast("Couldn't close this dispute"),
                  },
                );
              }}
            >
              {closeDispute.isPending ? "Closing…" : "Close / end dispute"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
