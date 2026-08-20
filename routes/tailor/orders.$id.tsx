import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  IconArrowLeft,
  IconTruck,
  IconAlertTriangle,
  IconFileInvoice,
  IconSend,
  IconFlag,
} from "@tabler/icons-react";
import { Card } from "@/components/common/Page";
import { StatusBadge } from "@/components/common/StatusBadge";
import { CenteredSpinner, ErrorState } from "@/components/common/AsyncStates";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ModeratedTextarea } from "@/components/common/ModeratedTextarea";
import { findCircumventionSpans } from "@/lib/textModeration";
import { toast } from "sonner";
import {
  useTailorOrder,
  useAdvanceOrderStatus,
  useTailorRespondDispute,
  useOrderThreadId,
  useThreadMessages,
  useReplyThread,
  useReportMessage,
  useOrderInvoicePdf,
} from "@/lib/api/queries/tailor";
import { filsToAed, fmtDateTime } from "@/lib/format";
import { labelize } from "@/components/inventory/options";
import type { OrderStatus } from "@/lib/api/types";

export const Route = createFileRoute("/tailor/orders/$id")({ component: OrderDetail });

// Allowed forward transition for the tailor. 'pending' -> 'confirmed'
// deliberately has NO entry: the backend only ever makes that transition
// itself, the instant Stripe confirms payment (markOrderPaid, either via the
// webhook or demo mode) — there is no tailor action that could legitimately
// "confirm" an order. A "Confirm order" button used to render here anyway,
// calling POST .../status with to_status: 'confirmed', which the backend
// correctly rejects every time (TAILOR_SETTABLE_STATUS excludes it) — so the
// primary action on the single most common order state could never succeed.
const NEXT: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  confirmed: { to: "in_progress", label: "Start stitching" },
  in_progress: { to: "ready", label: "Mark ready for pickup" },
  ready: { to: "shipped", label: "Ship / hand to courier" },
  shipped: { to: "delivered", label: "Mark delivered" },
};

function OrderDetail() {
  const { id } = Route.useParams();
  const q = useTailorOrder(id);
  const advance = useAdvanceOrderStatus();
  const respondDispute = useTailorRespondDispute();
  const [shipDialogOpen, setShipDialogOpen] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [pickupDialogOpen, setPickupDialogOpen] = useState(false);
  const [pickupNotes, setPickupNotes] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [disputeResponse, setDisputeResponse] = useState("");
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const invoice = useOrderInvoicePdf(id, invoiceOpen);

  const mutationErrorToast = (fallback: string) => (e: unknown) =>
    toast.error((e as Error)?.message || fallback);

  if (q.isLoading) return <CenteredSpinner />;
  if (q.isError || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;

  // The backend returns a FLAT order row plus items / timeline / dispute
  // (no separate `order`/`payment`/`messages` keys), so map it here.
  const order = q.data;
  const items = order.items ?? [];
  const status_history = order.timeline ?? [];
  const payment = order; // payment fields live on the order row; filsToAed guards undefined
  const next = NEXT[order.status as OrderStatus];

  function handleNextClick() {
    if (next?.to === "shipped") {
      setTrackingNumber("");
      setShipDialogOpen(true);
    } else if (next?.to === "ready" && order.requires_delivery) {
      setPickupNotes("");
      setPickupDate("");
      setPickupDialogOpen(true);
    } else if (next) {
      advance.mutate(
        { id, to_status: next.to },
        { onError: mutationErrorToast("Couldn't update the order status") },
      );
    }
  }

  function confirmShip(selfDeliver: boolean) {
    setShipDialogOpen(false);
    const tn = trackingNumber.trim();
    advance.mutate(
      {
        id,
        to_status: "shipped",
        ...(selfDeliver || !tn ? {} : { tracking_number: tn }),
      },
      { onError: mutationErrorToast("Couldn't mark this order as shipped") },
    );
  }

  function confirmPickup() {
    if (!pickupNotes.trim() || !pickupDate) return;
    setPickupDialogOpen(false);
    advance.mutate(
      { id, to_status: "ready", pickup_notes: pickupNotes.trim(), pickup_date: pickupDate },
      { onError: (e: unknown) => toast.error((e as Error)?.message || "Couldn't mark ready") },
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <Link
        to="/tailor/orders"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
      >
        <IconArrowLeft size={15} /> Back to orders
      </Link>

      {/* Ship dialog — enter tracking number or mark self-deliver */}
      <Dialog open={shipDialogOpen} onOpenChange={setShipDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconTruck size={18} /> Ship order
            </DialogTitle>
            <DialogDescription className="sr-only">
              Enter tracking number and carrier details to mark this order as shipped.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Enter a courier tracking number, or leave blank if you are delivering it yourself.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="tracking">Tracking number (optional)</Label>
            <Input
              id="tracking"
              placeholder="e.g. 1Z999AA10123456784"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
            />
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="flex-1" onClick={() => confirmShip(true)}>
              Self-deliver
            </Button>
            <Button className="flex-1" onClick={() => confirmShip(false)}>
              {trackingNumber.trim() ? "Ship with tracking" : "Ship"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pickup dialog — collect courier pickup instructions + date for
          delivery-required orders before marking the order ready. */}
      <Dialog open={pickupDialogOpen} onOpenChange={setPickupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule pickup</DialogTitle>
            <DialogDescription>
              Tell the courier where to collect this order and when.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Pickup instructions</Label>
              <Textarea
                rows={3}
                value={pickupNotes}
                onChange={(e) => setPickupNotes(e.target.value)}
                placeholder="e.g. Collect from the back entrance after 2pm"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Pickup date</Label>
              <Input
                type="date"
                value={pickupDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setPickupDate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Pickups don't run on Sundays.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPickupDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={confirmPickup}
              disabled={!pickupNotes.trim() || !pickupDate || advance.isPending}
            >
              {advance.isPending ? "Saving…" : "Confirm & mark ready"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice preview — the REAL invoice for this exact order, generated live,
          not a sample. Lets you spot and fix a branding/detail issue (wrong TRN,
          missing signature) before the customer ever downloads it themselves. */}
      <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
        <DialogContent className="max-w-3xl p-0 gap-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <IconFileInvoice size={18} /> Invoice — {order.order_number}
            </DialogTitle>
            <DialogDescription className="sr-only">
              A live preview of this order's actual invoice PDF.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 pt-2">
            {invoice.isError ? (
              <ErrorState
                error={invoice.error}
                onRetry={() => invoice.refetch()}
                title="Couldn't build this invoice"
              />
            ) : !invoice.url ? (
              <div className="min-h-[70vh] grid place-items-center">
                <CenteredSpinner label="Building the invoice…" />
              </div>
            ) : (
              <iframe
                src={invoice.url}
                title={`Invoice ${order.order_number}`}
                className="w-full min-h-[70vh] border rounded-lg block"
              />
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Something look off — logo, signature, TRN? Fix it under{" "}
              <Link to="/tailor/documents" className="text-primary hover:underline">
                Documents → Invoice branding
              </Link>
              , then reopen this preview.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">{order.order_number}</h2>
          <p className="text-sm text-muted-foreground">
            {order.customer_name} · {labelize(order.order_type)} · {filsToAed(order.total_fils)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={order.status} />
          <Button size="sm" variant="outline" onClick={() => setInvoiceOpen(true)}>
            <IconFileInvoice size={14} className="mr-1.5" /> Invoice
          </Button>
          {next && (
            <Button size="sm" disabled={advance.isPending} onClick={handleNextClick}>
              {advance.isPending ? "Saving…" : next.label}
            </Button>
          )}
          {order.status === "pending" && (
            <span className="text-xs text-muted-foreground italic">
              Awaiting payment confirmation
            </span>
          )}
        </div>
      </div>

      {order.dispute &&
        order.dispute.status !== "escalated" &&
        order.dispute.status !== "resolved" &&
        order.dispute.status !== "closed" &&
        (() => {
          const dispute = order.dispute!; // narrowed by the checks above; captured so it survives into the onClick closure below
          return (
            <Card title="Dispute open">
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
                    Customer claim
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{dispute.reason}</p>
                </div>
                {dispute.tailor_response ? (
                  <div className="bg-muted/40 rounded-lg p-3 text-sm">
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
                      Your response (sent)
                    </p>
                    <p className="whitespace-pre-wrap">{dispute.tailor_response}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Awaiting customer acceptance or escalation.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      Respond to the customer's claim. If you can resolve it directly, explain how —
                      the customer can then accept or escalate to Khyate.
                    </p>
                    <Textarea
                      placeholder="Explain your position or the resolution you're offering…"
                      value={disputeResponse}
                      onChange={(e) => setDisputeResponse(e.target.value)}
                      rows={3}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={respondDispute.isPending || disputeResponse.trim().length < 10}
                      onClick={() =>
                        respondDispute.mutate(
                          { disputeId: dispute.id, response_text: disputeResponse.trim() },
                          {
                            onSuccess: () => setDisputeResponse(""),
                            onError: (e: unknown) =>
                              toast.error(
                                (e as Error)?.message ||
                                  "Couldn't send your response — this dispute may already be closed.",
                              ),
                          },
                        )
                      }
                    >
                      {respondDispute.isPending ? "Sending…" : "Send response"}
                    </Button>
                    {disputeResponse.trim().length > 0 && disputeResponse.trim().length < 10 && (
                      <p className="text-xs text-muted-foreground">
                        Response must be at least 10 characters.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </Card>
          );
        })()}

      {order.dispute?.status === "escalated" && (
        <Card title="Escalated to Khyate support">
          <p className="text-sm text-muted-foreground">
            The customer escalated this dispute. A Khyate support agent will review and make a final
            decision. No further action is needed from you unless support contacts you.
          </p>
        </Card>
      )}

      {(order.delivery || order.tracking_number) && (
        <Card title="Delivery">
          <div className="space-y-2 text-sm">
            {order.delivery && (
              <div className="flex items-center gap-2">
                <IconTruck size={16} className="text-muted-foreground shrink-0" />
                <StatusBadge status={order.delivery.status} />
                {order.delivery.courier_name ? (
                  <span className="text-muted-foreground">via {order.delivery.courier_name}</span>
                ) : order.delivery.partner && order.delivery.partner !== "manual" ? (
                  <span className="text-muted-foreground">
                    via {labelize(order.delivery.partner)}
                  </span>
                ) : null}
              </div>
            )}
            {order.delivery?.tracking_url ? (
              <div className="flex items-center gap-2 pl-6">
                <span className="text-muted-foreground">Tracking:</span>
                <a
                  href={order.delivery.tracking_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono font-medium text-primary hover:underline truncate"
                >
                  {order.delivery.tracking_url}
                </a>
              </div>
            ) : order.tracking_number ? (
              <div className="flex items-center gap-2 pl-6">
                <span className="text-muted-foreground">Tracking:</span>
                <span className="font-mono font-medium">{order.tracking_number}</span>
              </div>
            ) : null}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card title="Items">
            <div className="space-y-3">
              {items.map((it) => (
                <div key={it.id} className="border-b last:border-0 pb-3 last:pb-0">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm">
                      {it.listing_title}
                      {it.variant_label ? ` · ${it.variant_label}` : ""}
                    </div>
                    <div className="text-sm">{filsToAed(it.total_price_fils)}</div>
                  </div>
                  {it.custom_specifications && (
                    <div className="mt-2 text-xs text-muted-foreground space-y-1 bg-muted/40 rounded-lg p-3">
                      <div>
                        <b>Fabric:</b> {it.custom_specifications.fabric.name} ·{" "}
                        {it.custom_specifications.fabric.color} ·{" "}
                        {it.custom_specifications.fabric.meters}m
                      </div>
                      <div>
                        <b>Measurements:</b>{" "}
                        {Object.entries(it.custom_specifications.measurements)
                          .map(([k, v]) => `${k} ${v}`)
                          .join(" · ")}
                      </div>
                      {it.custom_specifications.design_notes && (
                        <div>
                          <b>Notes:</b> {it.custom_specifications.design_notes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <OrderChat orderId={id} customerName={order.customer_name} />
        </div>

        <div className="space-y-5">
          <Card title="Payment">
            <div className="text-sm space-y-1.5">
              <Row label="Subtotal" value={filsToAed(payment.subtotal_fils)} />
              {payment.discount_fils > 0 && (
                <Row label="Discount" value={`-${filsToAed(payment.discount_fils)}`} />
              )}
              {payment.measurement_fee_fils > 0 && (
                <Row
                  label={`Measurement fee${payment.measurement_mode ? ` (${payment.measurement_mode})` : ""}`}
                  value={filsToAed(payment.measurement_fee_fils)}
                />
              )}
              <Row label="Delivery" value={filsToAed(payment.delivery_fee_fils)} />
              <div className="border-t pt-1.5 flex justify-between font-medium">
                <span>Total</span>
                <span>{filsToAed(payment.total_fils)}</span>
              </div>
              {payment.refund_fils > 0 && (
                <div className="border-t pt-1.5">
                  <div className="flex justify-between text-destructive font-medium">
                    <span>Refunded</span>
                    <span>-{filsToAed(payment.refund_fils)}</span>
                  </div>
                  {payment.refund_reason && (
                    <p className="text-xs text-muted-foreground mt-0.5">{payment.refund_reason}</p>
                  )}
                </div>
              )}
            </div>
          </Card>
          <Card title="Timeline">
            <div className="space-y-3">
              {status_history.map((h, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                  <div>
                    <div>{labelize(h.to_status ?? h.status ?? "")}</div>
                    <div className="text-xs text-muted-foreground">
                      {h.actor_name ?? "System"} · {fmtDateTime(h.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}

// Order chat — the tailor talks to the customer about this order (party-aware
// /me/* thread endpoints). Mirrors the customer's mobile chat.
function OrderChat({ orderId, customerName }: { orderId: string; customerName?: string }) {
  const threadQ = useOrderThreadId(orderId);
  const threadId = threadQ.data;
  const msgsQ = useThreadMessages(threadId);
  const reply = useReplyThread();
  const report = useReportMessage();
  const [text, setText] = useState("");
  const [flagged, setFlagged] = useState(false);
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const messages = msgsQ.data ?? [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const send = () => {
    const body = text.trim();
    if (!body || !threadId || flagged) return;
    reply.mutate({ threadId, body }, { onSuccess: () => setText("") });
  };

  const confirmReport = () => {
    if (!reportTarget) return;
    report.mutate(
      { messageId: reportTarget },
      {
        onSuccess: () => toast.success("Reported to Khyate for review."),
        onError: (e: unknown) => toast.error((e as Error)?.message || "Couldn't send the report"),
      },
    );
    setReportTarget(null);
  };

  return (
    <Card title={`Chat with ${customerName ?? "customer"}`}>
      <Dialog open={!!reportTarget} onOpenChange={(open) => !open && setReportTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconFlag size={18} /> Report this message
            </DialogTitle>
            <DialogDescription>
              Flags this message to Khyate's moderation team for review. Use this for abusive,
              fraudulent, or off-platform-payment attempts — not for ordinary disagreements.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReportTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={report.isPending} onClick={confirmReport}>
              {report.isPending ? "Reporting…" : "Report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="max-h-72 overflow-y-auto space-y-2.5 mb-3">
        {threadQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Opening conversation…</p>
        ) : threadQ.isError || msgsQ.isError ? (
          <ErrorState
            error={threadQ.error ?? msgsQ.error}
            onRetry={() => (threadQ.isError ? threadQ.refetch() : msgsQ.refetch())}
            title="Couldn't load this conversation"
          />
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No messages yet. Say hello or ask about their measurements.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.mine === true || m.sender_role === "tailor";
            return (
              <div key={m.id} className={`group flex items-end gap-1 ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[78%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                >
                  {!mine && <div className="text-[11px] opacity-70 mb-0.5">{m.sender_name}</div>}
                  <div>{m.body}</div>
                </div>
                {!mine && (
                  <button
                    type="button"
                    title="Report this message"
                    onClick={() => setReportTarget(m.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity shrink-0 mb-1"
                  >
                    <IconFlag size={14} />
                  </button>
                )}
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
      <div className="flex gap-2">
        <ModeratedTextarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFlaggedChange={setFlagged}
          extraSpansFinder={findCircumventionSpans}
          hideHelperText
          placeholder="Message the customer…"
          className="resize-none flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              send();
            }
          }}
        />
        <Button
          onClick={send}
          disabled={!text.trim() || !threadId || reply.isPending || flagged}
          className="self-end"
          title={flagged ? "Remove flagged language before sending" : undefined}
        >
          <IconSend size={16} />
        </Button>
      </div>
      {flagged && (
        <p className="text-xs text-destructive font-medium mt-1.5">
          This message contains language that can't be sent — please rephrase.
        </p>
      )}
    </Card>
  );
}
