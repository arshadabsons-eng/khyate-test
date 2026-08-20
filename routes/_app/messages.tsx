import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { PageHeader } from "@/components/common/Page";
import { Button } from "@/components/ui/button";
import { ErrorState, CenteredSpinner, NoData } from "@/components/common/AsyncStates";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ModeratedInput } from "@/components/common/ModeratedInput";
import { findBannedWord } from "@/lib/textModeration";
import {
  useSupportThreads,
  useThreadMessages,
  useReplyThread,
  useCloseThread,
  useReopenThread,
  type SupportThread,
  type ThreadMessage,
} from "@/lib/api/queries/messages";
import { useRbacMe } from "@/lib/api/queries/rbac";
import { fmtDate, relTime } from "@/lib/format";
import { toast } from "sonner";
import {
  IconMessageCircle,
  IconLock,
  IconLockOpen,
  IconSend,
  IconCircleDot,
} from "@tabler/icons-react";

export const Route = createFileRoute("/_app/messages")({ component: MessagesPage });

const TAB_STATUSES = ["open", "closed"] as const;

function MessagesPage() {
  const [tabStatus, setTabStatus] = useState<"open" | "closed">("open");
  const [activeId, setActiveId] = useState<string | null>(null);
  const q = useSupportThreads(tabStatus);
  const threads = q.data?.data ?? [];

  // Auto-select first thread when list loads
  useEffect(() => {
    if (!activeId && threads.length > 0) setActiveId(threads[0].id);
  }, [threads.length, activeId]);

  return (
    <div>
      <PageHeader title="Support Inbox" description="Customer and tailor support messages." />

      <div className="flex border rounded-xl overflow-hidden min-h-[calc(100vh-180px)]">
        {/* Left panel: thread list */}
        <div className="w-80 shrink-0 border-r flex flex-col">
          {/* Status tabs */}
          <div className="flex border-b">
            {TAB_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setTabStatus(s);
                  setActiveId(null);
                }}
                className={`flex-1 py-2.5 text-sm font-medium capitalize border-b-2 transition-colors ${
                  tabStatus === s
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}
                {s === "open" && (q.data?.total ?? 0) > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center h-4 w-4 text-[10px] rounded-full bg-primary text-primary-foreground">
                    {Math.min(q.data!.total, 99)}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Thread list */}
          <div className="flex-1 overflow-y-auto divide-y">
            {q.isLoading && <CenteredSpinner />}
            {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
            {!q.isLoading && threads.length === 0 && <NoData title={`No ${tabStatus} threads`} />}
            {threads.map((t) => (
              <ThreadRow
                key={t.id}
                thread={t}
                active={activeId === t.id}
                onClick={() => setActiveId(t.id)}
              />
            ))}
          </div>
        </div>

        {/* Right panel: conversation */}
        <div className="flex-1 flex flex-col">
          {activeId ? (
            <ConversationPanel threadId={activeId} threads={threads} />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <IconMessageCircle size={40} stroke={1.3} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">Select a thread to read</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ThreadRow({
  thread,
  active,
  onClick,
}: {
  thread: SupportThread;
  active: boolean;
  onClick: () => void;
}) {
  const unread = thread.unread_count > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-3 transition-colors hover:bg-muted/50 ${active ? "bg-muted" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {unread && <IconCircleDot size={10} className="text-primary shrink-0 mt-0.5" />}
          <span className={`text-sm truncate ${unread ? "font-semibold" : "font-medium"}`}>
            {thread.subject}
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground shrink-0">
          {relTime(thread.last_at ?? thread.created_at)}
        </span>
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground truncate">
        {thread.customer_name ?? thread.tailor_name ?? "Unknown"} ·{" "}
        {thread.order_number ? `Order ${thread.order_number}` : "Support request"}
      </div>
      {thread.last_message && (
        <p className="mt-0.5 text-xs text-muted-foreground truncate">{thread.last_message}</p>
      )}
    </button>
  );
}

function ConversationPanel({ threadId, threads }: { threadId: string; threads: SupportThread[] }) {
  const mq = useThreadMessages(threadId);
  const reply = useReplyThread();
  const close = useCloseThread();
  const reopen = useReopenThread();
  const [body, setBody] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const bodyFlagged = !!findBannedWord(body);
  const bottomRef = useRef<HTMLDivElement>(null);
  const thread = threads.find((t) => t.id === threadId);
  // Matrix-driven, not a rank floor — the backend's reply/close/reopen
  // endpoints are gated on rbac.requirePermission('messages','edit'), which
  // support_agent is granted by default (DEFAULTS.support_agent in
  // backend/src/lib/rbac.js). 'messages' isn't in MODULE_RANK_FLOOR, so
  // there's no extra rank requirement on top of the matrix — a rank-only
  // check here hid the reply/close controls from the very role the matrix
  // grants them to.
  const rbacMe = useRbacMe();
  const messagesLevel = rbacMe.data?.permissions.messages;
  const canWrite = messagesLevel === "edit" || messagesLevel === "admin";

  const mutationErrorToast = (fallback: string) => (e: unknown) =>
    toast.error((e as Error)?.message || fallback);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mq.data?.length]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || bodyFlagged) return;
    reply.mutate(
      { id: threadId, body: body.trim() },
      { onSuccess: () => setBody(""), onError: mutationErrorToast("Couldn't send that reply") },
    );
  };

  const isClosed = thread?.status === "closed";

  return (
    <>
      {/* Thread header */}
      <div className="flex items-center justify-between px-5 py-3 border-b bg-card shrink-0">
        <div>
          <div className="font-medium text-sm">{thread?.subject ?? "Thread"}</div>
          <div className="text-xs text-muted-foreground">
            {thread?.customer_name ?? thread?.tailor_name ?? "—"}
            {thread?.order_number ? ` · Order ${thread.order_number}` : ""}
            {" · "}
            {fmtDate(thread?.created_at ?? "")}
          </div>
        </div>
        {!isClosed && (
          <Button
            size="sm"
            variant="outline"
            disabled={close.isPending || !canWrite}
            title={canWrite ? undefined : "You don't have permission to close threads"}
            onClick={() => setConfirmClose(true)}
          >
            <IconLock size={14} className="mr-1" /> Close thread
          </Button>
        )}
        {isClosed && (
          <div className="flex items-center gap-2">
            <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">
              Closed
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={reopen.isPending || !canWrite}
              title={canWrite ? undefined : "You don't have permission to reopen threads"}
              onClick={() =>
                reopen.mutate(threadId, {
                  onError: mutationErrorToast("Couldn't reopen this thread"),
                })
              }
            >
              <IconLockOpen size={14} className="mr-1" /> Reopen thread
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmClose}
        onOpenChange={setConfirmClose}
        title="Close this thread?"
        description="The customer or tailor won't be able to reply until the thread is reopened. You can reopen it yourself at any time."
        confirmLabel="Close thread"
        onConfirm={() =>
          close.mutate(threadId, {
            onSuccess: () => setConfirmClose(false),
            onError: (e: unknown) => {
              mutationErrorToast("Couldn't close this thread")(e);
              setConfirmClose(false);
            },
          })
        }
      />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {mq.isLoading && <CenteredSpinner />}
        {mq.isError && <ErrorState error={mq.error} onRetry={() => mq.refetch()} />}
        {!mq.isLoading && (mq.data ?? []).length === 0 && (
          <NoData title="No messages yet" description="Start the conversation below." />
        )}
        {(mq.data ?? []).map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Reply bar */}
      <form onSubmit={send} className="flex gap-2 px-4 py-3 border-t bg-card shrink-0">
        <ModeratedInput
          className="flex-1 text-sm bg-muted rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          placeholder={
            !canWrite
              ? "You don't have permission to reply"
              : isClosed
                ? "Thread is closed"
                : "Write a reply…"
          }
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={isClosed || reply.isPending || !canWrite}
        />
        <Button
          type="submit"
          size="sm"
          disabled={!body.trim() || isClosed || reply.isPending || !canWrite || bodyFlagged}
          title={
            !canWrite
              ? "You don't have permission to reply"
              : bodyFlagged
                ? "Remove the flagged language before sending"
                : undefined
          }
        >
          <IconSend size={14} />
        </Button>
      </form>
    </>
  );
}

function MessageBubble({ msg }: { msg: ThreadMessage }) {
  const isAdmin = ["operations_admin", "super_admin", "support_agent"].includes(msg.sender_role);
  return (
    <div className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[72%] rounded-2xl px-4 py-2.5 ${isAdmin ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-muted rounded-tl-none"}`}
      >
        {!isAdmin && (
          <div className="text-[10px] font-medium opacity-70 mb-1 capitalize">
            {msg.sender_name} ({(msg.sender_role ?? "").replace("_", " ")})
          </div>
        )}
        <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
        <div
          className={`text-[10px] mt-1 ${isAdmin ? "opacity-70 text-right" : "text-muted-foreground"}`}
        >
          {relTime(msg.created_at)}
        </div>
      </div>
    </div>
  );
}
