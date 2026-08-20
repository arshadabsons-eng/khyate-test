import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { IconGavel, IconSend, IconCheck, IconChecks, IconMessageCircle } from "@tabler/icons-react";
import { Card } from "@/components/common/Page";
import { CenteredSpinner, ErrorState, NoData } from "@/components/common/AsyncStates";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/common/StatusBadge";
import {
  useTailorDisputes,
  useDisputeThread,
  useSendDisputeMessage,
  useEscalateDispute,
} from "@/lib/api/queries/tailor";
import { toast } from "sonner";
import { fmtDate, relTime } from "@/lib/format";

export const Route = createFileRoute("/tailor/disputes")({ component: DisputesPage });

const STATUS_LABEL: Record<string, string> = {
  open: "Decision pending",
  peer_resolution: "You responded",
  escalated: "With Khyate helpdesk",
  resolved: "Resolved",
  closed: "Closed",
};

function DisputesPage() {
  const q = useTailorDisputes();
  const [selected, setSelected] = useState<string | null>(null);

  if (q.isLoading) return <CenteredSpinner />;
  if (q.isError)
    return (
      <ErrorState error={q.error} onRetry={() => q.refetch()} title="Couldn't load disputes" />
    );
  const list = Array.isArray(q.data) ? q.data : [];

  return (
    <div className="w-full space-y-5">
      <header>
        <h1 className="kh-h1 font-serif">Disputes</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Customers raise issues here. Reply in the chat to resolve it before it's escalated to
          Khyate.
        </p>
      </header>

      {list.length === 0 ? (
        <NoData
          icon={IconGavel}
          title="No disputes"
          description="When a customer opens a dispute about one of your orders, it appears here."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* List */}
          <div className="lg:col-span-1 border rounded-xl divide-y overflow-hidden h-fit">
            {list.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setSelected(d.id)}
                className={`w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors ${selected === d.id ? "bg-primary/5" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium truncate">{d.order_number}</span>
                  {Number(d.unread_count) > 0 && (
                    <span className="text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">
                      {d.unread_count}
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate mt-0.5">
                  {d.customer_name} · {d.reason}
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <StatusBadge status={STATUS_LABEL[d.status] ?? d.status} />
                  <span className="text-[11px] text-muted-foreground">{fmtDate(d.created_at)}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Chat */}
          <div className="lg:col-span-2 border rounded-xl flex flex-col min-h-[28rem]">
            {selected ? (
              <DisputeChat disputeId={selected} />
            ) : (
              <div className="flex-1 grid place-items-center text-muted-foreground">
                <div className="text-center">
                  <IconMessageCircle size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Select a dispute to view the conversation.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DisputeChat({ disputeId }: { disputeId: string }) {
  const q = useDisputeThread(disputeId);
  const send = useSendDisputeMessage();
  const escalate = useEscalateDispute();
  const [text, setText] = useState("");
  const [escalating, setEscalating] = useState(false);
  const [escalateReason, setEscalateReason] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const mutationErrorToast = (fallback: string) => (e: unknown) =>
    toast.error((e as Error)?.message || fallback);

  const messages = q.data?.messages ?? [];
  const me = q.data?.me ?? "";
  const status = q.data?.status ?? "open";
  const canEscalate = status === "open" || status === "peer_resolution";

  const submitEscalate = () => {
    escalate.mutate(
      { disputeId, reason: escalateReason.trim() || undefined },
      {
        onSuccess: () => {
          toast.success("Escalated to the Khyate helpdesk");
          setEscalating(false);
          setEscalateReason("");
        },
        onError: (e: unknown) =>
          toast.error((e as Error)?.message || "Couldn't escalate this dispute."),
      },
    );
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const submit = () => {
    const body = text.trim();
    if (!body) return;
    send.mutate(
      { disputeId, body },
      { onSuccess: () => setText(""), onError: mutationErrorToast("Couldn't send that message") },
    );
  };

  const closed = status === "resolved" || status === "closed" || status === "escalated";

  return (
    <>
      <div className="px-4 py-3 border-b flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-sm truncate">{q.data?.customer_name ?? "Customer"}</div>
          <div className="text-xs text-muted-foreground">{q.data?.order_number}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canEscalate && !escalating && (
            <Button size="sm" variant="outline" onClick={() => setEscalating(true)}>
              Escalate to Khyate
            </Button>
          )}
          <StatusBadge status={STATUS_LABEL[status] ?? status} />
        </div>
      </div>

      {escalating && (
        <div className="px-4 py-3 border-b bg-muted/30 space-y-2">
          <p className="text-xs text-muted-foreground">
            This moves the dispute to the Khyate helpdesk — use it if you and the customer can't
            reach an agreement here.
          </p>
          <Textarea
            rows={2}
            value={escalateReason}
            onChange={(e) => setEscalateReason(e.target.value)}
            placeholder="Optional — what would you like the helpdesk to know?"
            className="resize-none"
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEscalating(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={submitEscalate} disabled={escalate.isPending}>
              {escalate.isPending ? "Escalating…" : "Confirm escalation"}
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[28rem]">
        {q.isLoading ? (
          <CenteredSpinner />
        ) : q.isError ? (
          <ErrorState
            error={q.error}
            onRetry={() => q.refetch()}
            title="Couldn't load this conversation"
          />
        ) : messages.length === 0 ? (
          <NoData title="No messages yet" />
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === me;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                >
                  {!mine && <div className="text-[11px] opacity-70 mb-0.5">{m.sender_name}</div>}
                  <div>{m.body}</div>
                  <div
                    className={`flex items-center gap-1 justify-end mt-0.5 text-[10px] ${mine ? "text-primary-foreground/80" : "text-muted-foreground"}`}
                  >
                    <span>{relTime(m.created_at)}</span>
                    {mine &&
                      (m.read_at ? (
                        <IconChecks size={13} className="text-[#53BDEB]" />
                      ) : m.delivered_at ? (
                        <IconChecks size={13} />
                      ) : (
                        <IconCheck size={13} />
                      ))}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {closed ? (
        <div className="border-t p-3 text-center text-xs text-muted-foreground">
          {STATUS_LABEL[status] ?? status} — this conversation is read-only.
        </div>
      ) : (
        <div className="border-t p-3 flex gap-2">
          <Textarea
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Reply to the customer…"
            className="resize-none flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                submit();
              }
            }}
          />
          <Button onClick={submit} disabled={!text.trim() || send.isPending} className="self-end">
            <IconSend size={16} />
          </Button>
        </div>
      )}
    </>
  );
}
