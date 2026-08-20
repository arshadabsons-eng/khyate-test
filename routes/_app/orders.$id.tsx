import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, PageHeader } from "@/components/common/Page";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, NoData } from "@/components/common/AsyncStates";
import {
  useOrder,
  useRefundOrder,
  useForceCancelOrder,
  useEscalateOrder,
  useSaveOrderNote,
  useMarkDelivered,
} from "@/lib/api/queries/orders";
import { filsToAed, fmtDateTime } from "@/lib/format";
import { apiClient } from "@/lib/api/client";
import { auth } from "@/lib/auth";
import { usePerm } from "@/lib/api/queries/rbac";
import { toast } from "sonner";
import { IconCircleCheck, IconCircle, IconShoppingBag, IconFileInvoice } from "@tabler/icons-react";
import type { OrderStatusHistoryEntry } from "@/lib/api/types";

export const Route = createFileRoute("/_app/orders/$id")({ component: OrderDetail });

function OrderDetail() {
  const { id } = useParams({ from: "/_app/orders/$id" });
  const q = useOrder(id);
  const refund = useRefundOrder();
  const forceCancel = useForceCancelOrder();
  const escalate = useEscalateOrder();
  const saveNote = useSaveOrderNote();
  const markDelivered = useMarkDelivered();
  // Refund/Force Cancel/Escalate/Mark Delivered are write actions, gated on the
  // same permission the backend enforces (orders:'edit') rather than a rank.
  const canWrite = usePerm("orders", "edit");
  const mutationErrorToast = (fallback: string) => (e: unknown) =>
    toast.error((e as Error)?.message || fallback);

  const [refundType, setRefundType] = useState<"full" | "partial">("full");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [adminNote, setAdminNote] = useState("");

  // Sync admin note from server when it loads/changes upstream.
  useEffect(() => {
    if (q.data?.admin_notes != null) setAdminNote(q.data.admin_notes);
  }, [q.data?.admin_notes]);

  if (q.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  if (q.isError) {
    return <ErrorState error={q.error} onRetry={() => q.refetch()} title="Couldn't load order" />;
  }
  if (!q.data) {
    return <NoData icon={IconShoppingBag} title="Order not found" />;
  }

  const detail = q.data;
  const o = detail.order;
  const items = detail.items;
  const history = detail.status_history;
  const fullRefundAmount =
    (Number(detail.payment.total_fils) -
      detail.refunds.reduce((s, r) => s + Number(r.amount_fils), 0)) /
    100;

  return (
    <div>
      <PageHeader
        title={o.order_number}
        description={
          <Link to="/orders" className="text-primary hover:underline">
            ← All orders
          </Link>
        }
        actions={
          <>
            <StatusBadge status={o.status} />
            <StatusBadge status={o.payment_status} />
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                apiClient.downloadPdf(`/orders/${id}/invoice`, `invoice-${o.order_number}.pdf`)
              }
            >
              <IconFileInvoice size={14} className="mr-1.5" /> Invoice
            </Button>
            {o.status === "shipped" && canWrite && (
              <Button
                size="sm"
                onClick={() =>
                  markDelivered.mutate(
                    { id },
                    { onError: mutationErrorToast("Couldn't mark this order delivered") },
                  )
                }
                disabled={markDelivered.isPending}
                className="bg-success hover:bg-success/90 text-success-foreground"
              >
                Mark Delivered
              </Button>
            )}
          </>
        }
      />

      <Card title="Status Timeline" className="mb-6">
        {history.length === 0 ? (
          <NoData title="No status history yet" />
        ) : (
          <ol className="space-y-4">
            {history.map((h, i) => (
              <TimelineRow key={h.id} entry={h} isLast={i === history.length - 1} />
            ))}
          </ol>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2" title="Order Items">
          {items.length === 0 ? (
            <NoData title="No line items" />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="text-left py-2">Item</th>
                  <th className="text-left">Variant</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Unit</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t">
                    <td className="py-2 font-medium">{it.title}</td>
                    <td>{it.variant ?? "—"}</td>
                    <td className="text-right tabular-nums">{it.qty}</td>
                    <td className="text-right tabular-nums">{filsToAed(it.unit_fils)}</td>
                    <td className="text-right tabular-nums">{filsToAed(it.total_fils)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {items.some((it) => it.custom_specifications) && (
            <div className="mt-6 pt-6 border-t space-y-4">
              {items.map((it) =>
                it.custom_specifications ? (
                  <div key={`spec-${it.id}`}>
                    <div className="font-medium text-sm mb-2">
                      Custom specifications · {it.title}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                      {Object.entries(it.custom_specifications.measurements).map(([k, v]) => (
                        <div key={k} className="border rounded-md p-2">
                          <div className="text-xs text-muted-foreground capitalize">
                            {k.replace(/_/g, " ")}
                          </div>
                          <div className="font-medium">{v} cm</div>
                        </div>
                      ))}
                    </div>
                    {it.custom_specifications.fabric && (
                      <div className="mt-3 text-sm">
                        <span className="text-muted-foreground">Fabric: </span>
                        <span className="font-medium">
                          {it.custom_specifications.fabric.name}
                        </span>{" "}
                        · {it.custom_specifications.fabric.color} ·{" "}
                        {it.custom_specifications.fabric.meters} m
                      </div>
                    )}
                    {it.custom_specifications.reference_image_urls.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs text-muted-foreground mb-1">Reference images</div>
                        <div className="grid grid-cols-4 gap-2">
                          {it.custom_specifications.reference_image_urls.map((url) => (
                            <img
                              key={url}
                              src={url}
                              alt=""
                              className="aspect-square rounded object-cover w-full bg-muted"
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    {it.custom_specifications.design_notes && (
                      <div className="mt-3 text-sm">
                        <div className="text-xs text-muted-foreground mb-1">Design notes</div>
                        <p>{it.custom_specifications.design_notes}</p>
                      </div>
                    )}
                  </div>
                ) : null,
              )}
            </div>
          )}
        </Card>

        <Card title="Payment Breakdown">
          <dl className="text-sm space-y-2">
            <Row label="Subtotal" value={filsToAed(detail.payment.subtotal_fils)} />
            {detail.payment.discount_fils > 0 && (
              <Row
                label="Discount"
                value={`−${filsToAed(detail.payment.discount_fils)}`}
                valueClass="text-success"
              />
            )}
            {detail.payment.measurement_fee_fils > 0 && (
              <Row
                label={`Measurement fee${detail.payment.measurement_mode ? ` (${detail.payment.measurement_mode})` : ""}`}
                value={filsToAed(detail.payment.measurement_fee_fils)}
              />
            )}
            <Row label="Platform fee" value={filsToAed(detail.payment.platform_fee_fils)} />
            <Row label="Delivery" value={filsToAed(detail.payment.delivery_fee_fils)} />
            <div className="flex justify-between pt-2 border-t font-semibold">
              <dt>Total</dt>
              <dd className="tabular-nums">{filsToAed(detail.payment.total_fils)}</dd>
            </div>
          </dl>
          {detail.payment.stripe_payment_intent_id && (
            <div className="mt-4 pt-4 border-t text-xs space-y-1">
              <div className="text-muted-foreground">Stripe ID</div>
              <div className="font-mono text-[11px] break-all">
                {detail.payment.stripe_payment_intent_id}
              </div>
            </div>
          )}
          {detail.refunds.length > 0 && (
            <div className="mt-4 pt-4 border-t space-y-2">
              <div className="text-xs font-medium">Refunds</div>
              {detail.refunds.map((r) => (
                <div key={r.id} className="text-xs space-y-0.5">
                  <div className="flex justify-between">
                    <span>{filsToAed(r.amount_fils)}</span>
                    <span className="text-muted-foreground">{fmtDateTime(r.created_at)}</span>
                  </div>
                  <div className="text-muted-foreground">{r.reason}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="Admin Notes (internal only)" className="mt-6">
        <Textarea
          value={adminNote}
          onChange={(e) => setAdminNote(e.target.value)}
          onBlur={() => {
            if (adminNote !== detail.admin_notes)
              saveNote.mutate(
                { id, note: adminNote },
                { onError: mutationErrorToast("Couldn't save this note") },
              );
          }}
          placeholder="Add internal notes (auto-saves on blur). Not visible to tailor or customer."
        />
        {saveNote.isPending && <div className="text-xs text-muted-foreground mt-1">Saving…</div>}
      </Card>

      {canWrite && (
        <Card title="Actions" className="mt-6">
          <div className="space-y-4">
            <div className="border rounded-md p-4">
              <div className="font-medium mb-3">Refund</div>
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setRefundType("full")}
                  className={`px-3 py-1.5 rounded text-xs font-medium ${
                    refundType === "full" ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  Full
                </button>
                <button
                  type="button"
                  onClick={() => setRefundType("partial")}
                  className={`px-3 py-1.5 rounded text-xs font-medium ${
                    refundType === "partial" ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}
                >
                  Partial
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  placeholder="Amount AED"
                  value={refundType === "full" ? fullRefundAmount.toFixed(2) : refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  disabled={refundType === "full"}
                />
                <Input
                  placeholder="Reason"
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                />
              </div>
              <Button
                type="button"
                className="mt-3"
                variant="destructive"
                disabled={refund.isPending || !refundReason.trim()}
                onClick={() =>
                  refund.mutate(
                    {
                      id,
                      amount_fils:
                        refundType === "full"
                          ? detail.payment.total_fils
                          : Math.round(parseFloat(refundAmount || "0") * 100),
                      reason: refundReason,
                      refund_type: refundType,
                    },
                    { onError: mutationErrorToast("Couldn't process this refund") },
                  )
                }
              >
                {refund.isPending ? "Processing…" : "Confirm Refund"}
              </Button>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const reason = window.prompt("Cancel reason:");
                  if (!reason) return;
                  forceCancel.mutate(
                    { id, reason, refund_full: true },
                    { onError: mutationErrorToast("Couldn't force-cancel this order") },
                  );
                }}
              >
                Force Cancel
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  const description = window.prompt("Dispute description:");
                  if (!description) return;
                  escalate.mutate(
                    { id, dispute_type: "other", description },
                    { onError: mutationErrorToast("Couldn't escalate this order to a dispute") },
                  );
                }}
              >
                Escalate to Dispute
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function TimelineRow({ entry, isLast }: { entry: OrderStatusHistoryEntry; isLast: boolean }) {
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        {isLast ? (
          <IconCircle size={22} className="text-primary" />
        ) : (
          <IconCircleCheck size={22} className="text-success" />
        )}
        {!isLast && <div className="w-px flex-1 bg-border my-1" />}
      </div>
      <div className="pb-4 flex-1">
        <div className="font-medium capitalize">
          {entry.to_status.replace(/_/g, " ")}{" "}
          <span className="text-xs text-muted-foreground font-normal">by {entry.actor_name}</span>
        </div>
        <div className="text-xs text-muted-foreground">{fmtDateTime(entry.created_at)}</div>
        {entry.note && <div className="text-sm mt-1">{entry.note}</div>}
      </div>
    </li>
  );
}

function Row({
  label,
  value,
  valueClass = "tabular-nums",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={valueClass}>{value}</span>
    </div>
  );
}
