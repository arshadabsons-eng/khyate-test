import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  IconBell,
  IconSend,
  IconMessageCircle,
  IconRefresh,
  IconUsers,
  IconScissors,
  IconChevronRight,
} from "@tabler/icons-react";
import {
  useBroadcasts,
  useSendBroadcast,
  useMessageThreads,
  useThreadMessages,
  useReplyToThread,
  useCloseThread,
} from "@/lib/api/queries/broadcasts";
import { Card } from "@/components/common/Page";
import { DataTable } from "@/components/common/DataTable";
import { ErrorState, LoadingRows, CenteredSpinner, NoData } from "@/components/common/AsyncStates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModeratedInput } from "@/components/common/ModeratedInput";
import { ModeratedTextarea } from "@/components/common/ModeratedTextarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar } from "@/components/common/Avatar";
import { fmtDate, relTime, initialsOf } from "@/lib/format";
import { auth } from "@/lib/auth";
import { usePerm } from "@/lib/api/queries/rbac";
import { toast } from "sonner";
import { LiquidTabs } from "@/components/common/LiquidTabs";
import type { BroadcastRow, MessageThread } from "@/lib/api/types";

export const Route = createFileRoute("/_app/notifications")({ component: NotificationsPage });

// Sending a broadcast, replying, or closing a thread used to fail silently on
// error (no onError anywhere) and was fully interactive for any role that
// could open this page. Same helper shape as disputes.$id.tsx/payouts.tsx.
const mutationErrorToast = (fallback: string) => (e: unknown) =>
  toast.error((e as Error)?.message || fallback);

const TABS = [
  { id: "broadcast", label: "Broadcast", icon: IconBell },
  { id: "messages", label: "Message Center", icon: IconMessageCircle },
] as const;

type TabId = (typeof TABS)[number]["id"];

function NotificationsPage() {
  const [tab, setTab] = useState<TabId>("broadcast");

  return (
    <div>
      <LiquidTabs tabs={TABS} value={tab} onChange={(id) => setTab(id as TabId)} className="mb-6" />
      {tab === "broadcast" && <BroadcastTab />}
      {tab === "messages" && <MessagesTab />}
    </div>
  );
}

const AUDIENCE_OPTS = [
  { value: "all", label: "All Users", icon: IconUsers },
  { value: "tailors", label: "Tailors Only", icon: IconScissors },
  { value: "customers", label: "Customers Only", icon: IconUsers },
  { value: "specific_tier", label: "Specific Tier", icon: IconUsers },
] as const;

function BroadcastTab() {
  const [form, setForm] = useState({
    title_en: "",
    title_ar: "",
    body_en: "",
    body_ar: "",
    target_audience: "all" as "all" | "tailors" | "customers" | "specific_tier",
    target_tier: "",
  });
  const [broadcastPage, setBroadcastPage] = useState(1);
  const sendMutation = useSendBroadcast();
  const broadcastsQ = useBroadcasts(broadcastPage);
  // Matches the backend's own requirePermission('notifications','edit') rather
  // than a coarse rank check.
  const canWrite = usePerm("notifications", "edit");
  // A broadcast fans out to potentially every user on the platform — the
  // backend independently re-checks all four fields with the identical
  // filter, this is the live front-run so a flagged field is caught before
  // Send is even clickable, not after a 400 comes back.
  const [fieldFlagged, setFieldFlagged] = useState({
    title_en: false,
    title_ar: false,
    body_en: false,
    body_ar: false,
  });
  const anyFlagged = Object.values(fieldFlagged).some(Boolean);

  const isDirty = !!(form.title_en || form.body_en);

  const send = () => {
    if (!canWrite) return;
    if (!form.title_en || !form.body_en) {
      toast.error("Title and body (English) are required.");
      return;
    }
    sendMutation.mutate(
      { ...form, target_tier: form.target_tier || undefined },
      {
        onSuccess: () => {
          toast.success("Broadcast sent successfully");
          setForm({
            title_en: "",
            title_ar: "",
            body_en: "",
            body_ar: "",
            target_audience: "all",
            target_tier: "",
          });
        },
        onError: mutationErrorToast("Couldn't send this broadcast"),
      },
    );
  };

  return (
    <div className="space-y-6">
      {/* Composer */}
      <Card title="New Broadcast">
        <div className="space-y-5">
          {/* Audience */}
          <div className="space-y-1.5">
            <Label>Target Audience</Label>
            <div className="flex flex-wrap gap-2">
              {AUDIENCE_OPTS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setForm({ ...form, target_audience: o.value })}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                    form.target_audience === o.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  <o.icon size={15} /> {o.label}
                </button>
              ))}
            </div>
            {form.target_audience === "specific_tier" && (
              <Select
                value={form.target_tier}
                onValueChange={(v) => setForm({ ...form, target_tier: v })}
              >
                <SelectTrigger className="w-48 mt-2">
                  <SelectValue placeholder="Select tier…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Basic">Basic</SelectItem>
                  <SelectItem value="Professional">Professional</SelectItem>
                  <SelectItem value="Premium">Premium</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Title bilingual */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Title (English)</Label>
              <ModeratedInput
                value={form.title_en}
                onChange={(e) => setForm({ ...form, title_en: e.target.value })}
                onFlaggedChange={(f) => setFieldFlagged((s) => ({ ...s, title_en: f }))}
                placeholder="e.g. Platform maintenance scheduled"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Title (Arabic)</Label>
              <ModeratedInput
                dir="rtl"
                value={form.title_ar}
                onChange={(e) => setForm({ ...form, title_ar: e.target.value })}
                onFlaggedChange={(f) => setFieldFlagged((s) => ({ ...s, title_ar: f }))}
                placeholder="عنوان الإشعار"
              />
            </div>
          </div>

          {/* Body bilingual */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Body (English)</Label>
              <ModeratedTextarea
                rows={4}
                value={form.body_en}
                onChange={(e) => setForm({ ...form, body_en: e.target.value })}
                onFlaggedChange={(f) => setFieldFlagged((s) => ({ ...s, body_en: f }))}
                hideHelperText
                placeholder="Message body…"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Body (Arabic)</Label>
              <ModeratedTextarea
                dir="rtl"
                rows={4}
                value={form.body_ar}
                onChange={(e) => setForm({ ...form, body_ar: e.target.value })}
                onFlaggedChange={(f) => setFieldFlagged((s) => ({ ...s, body_ar: f }))}
                hideHelperText
                placeholder="نص الرسالة…"
              />
            </div>
          </div>
          {anyFlagged && (
            <p className="text-xs text-destructive font-medium">
              One or more fields contain language that isn't allowed — fix the underlined text before sending.
            </p>
          )}

          <div className="flex justify-end">
            <Button
              onClick={send}
              disabled={sendMutation.isPending || !isDirty || !canWrite || anyFlagged}
              title={canWrite ? undefined : "You don't have permission to send broadcasts"}
            >
              <IconSend size={15} className="mr-1.5" />
              {sendMutation.isPending ? "Sending…" : "Send Broadcast"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Recent broadcasts */}
      <Card title="Recent Broadcasts">
        {broadcastsQ.isLoading ? (
          <LoadingRows cols={5} rows={6} />
        ) : broadcastsQ.isError ? (
          <ErrorState error={broadcastsQ.error} onRetry={() => broadcastsQ.refetch()} />
        ) : (
          <DataTable
            columns={[
              {
                header: "Title",
                accessor: (r: BroadcastRow) => <div className="font-medium">{r.title_en}</div>,
              },
              {
                header: "Audience",
                accessor: (r: BroadcastRow) => (
                  <span className="text-xs capitalize">
                    {r.target_audience.replace("_", " ")}
                    {r.target_tier ? ` · ${r.target_tier}` : ""}
                  </span>
                ),
              },
              {
                header: "Sent To",
                accessor: (r: BroadcastRow) => `${r.sent_count.toLocaleString()} users`,
              },
              { header: "Sent By", accessor: (r: BroadcastRow) => r.sent_by_name },
              { header: "Date", accessor: (r: BroadcastRow) => fmtDate(r.sent_at) },
            ]}
            rows={broadcastsQ.data?.data ?? []}
            pagination={{
              page: broadcastsQ.data?.page ?? 1,
              totalPages: broadcastsQ.data?.total_pages ?? 1,
              onPageChange: setBroadcastPage,
            }}
          />
        )}
      </Card>
    </div>
  );
}

function MessagesTab() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedThread, setSelectedThread] = useState<MessageThread | null>(null);
  const threadsQ = useMessageThreads(page, search || undefined);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[600px]">
      {/* Thread list */}
      <div className="lg:col-span-1 border rounded-xl flex flex-col">
        <div className="p-3 border-b">
          <div className="relative">
            <Input
              placeholder="Search threads…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pr-8"
            />
            <button
              type="button"
              aria-label="Refresh threads"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-60"
              onClick={() => threadsQ.refetch()}
              disabled={threadsQ.isFetching}
            >
              <IconRefresh size={15} className={threadsQ.isFetching ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto divide-y">
          {threadsQ.isLoading ? (
            <CenteredSpinner />
          ) : threadsQ.isError ? (
            <ErrorState error={threadsQ.error} onRetry={() => threadsQ.refetch()} />
          ) : !threadsQ.data?.data?.length ? (
            <NoData title="No threads" />
          ) : (
            threadsQ.data.data.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`w-full text-left px-4 py-3 hover:bg-muted/50 flex items-start gap-3 transition-colors ${selectedThread?.id === t.id ? "bg-primary/5" : ""}`}
                onClick={() => setSelectedThread(t)}
              >
                <Avatar initials={initialsOf(t.tailor_name ?? t.customer_name ?? "—")} size={36} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">
                      {t.tailor_name ?? t.customer_name ?? "—"}
                    </span>
                    {t.unread_count > 0 && (
                      <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {t.last_message ?? t.subject}
                  </p>
                  {t.last_at && (
                    <p className="text-xs text-muted-foreground mt-0.5">{relTime(t.last_at)}</p>
                  )}
                </div>
                <IconChevronRight size={14} className="text-muted-foreground shrink-0 mt-1" />
              </button>
            ))
          )}
        </div>
      </div>

      {/* Thread detail */}
      <div className="lg:col-span-2 border rounded-xl flex flex-col">
        {selectedThread ? (
          <ThreadDetail thread={selectedThread} onClose={() => setSelectedThread(null)} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <IconMessageCircle size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">Select a thread to view the conversation.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ThreadDetail({ thread, onClose }: { thread: MessageThread; onClose: () => void }) {
  const [reply, setReply] = useState("");
  const [replyFlagged, setReplyFlagged] = useState(false);
  const messagesQ = useThreadMessages(thread.id);
  const replyMutation = useReplyToThread();
  const closeMutation = useCloseThread();
  const canWrite = auth.canWrite();

  const send = () => {
    if (!canWrite || !reply.trim() || replyFlagged) return;
    replyMutation.mutate(
      { thread_id: thread.id, content: reply },
      {
        onSuccess: () => setReply(""),
        onError: mutationErrorToast("Couldn't send this reply"),
      },
    );
  };

  return (
    <>
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center gap-3">
        <Avatar
          initials={initialsOf(thread.tailor_name ?? thread.customer_name ?? "—")}
          size={36}
        />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{thread.tailor_name ?? thread.customer_name ?? "—"}</p>
          <p className="text-xs text-muted-foreground truncate">
            {thread.subject}
            {thread.order_number ? ` · Order ${thread.order_number}` : ""}
          </p>
        </div>
        {thread.status !== "closed" && canWrite && (
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              closeMutation.mutate(thread.id, {
                onError: mutationErrorToast("Couldn't close this thread"),
              })
            }
            disabled={closeMutation.isPending}
          >
            Close Thread
          </Button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messagesQ.isLoading ? (
          <CenteredSpinner />
        ) : messagesQ.isError ? (
          <ErrorState error={messagesQ.error} onRetry={() => messagesQ.refetch()} />
        ) : !messagesQ.data?.length ? (
          <NoData title="No messages" />
        ) : (
          messagesQ.data.map((msg) => {
            const senderRole = msg.sender_role ?? "";
            const isAdmin =
              senderRole === "admin" ||
              senderRole === "operations_admin" ||
              senderRole === "super_admin" ||
              senderRole === "support_agent";
            return (
              <div key={msg.id} className={`flex gap-2 ${isAdmin ? "flex-row-reverse" : ""}`}>
                <Avatar initials={initialsOf(msg.sender_name ?? "—")} size={28} />
                <div
                  className={`max-w-[70%] ${isAdmin ? "items-end" : "items-start"} flex flex-col`}
                >
                  <div
                    className={`rounded-2xl px-3 py-2 text-sm ${
                      isAdmin ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}
                  >
                    {msg.body ?? ""}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{relTime(msg.created_at)}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Reply */}
      {thread.status !== "closed" && (
        <div className="border-t p-3 flex gap-2">
          <ModeratedTextarea
            rows={2}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onFlaggedChange={setReplyFlagged}
            hideHelperText
            placeholder="Type a reply…"
            className="resize-none flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                send();
              }
            }}
          />
          <Button
            size="sm"
            onClick={send}
            disabled={replyMutation.isPending || !reply.trim() || !canWrite || replyFlagged}
            title={
              !canWrite
                ? "You don't have permission to reply"
                : replyFlagged
                  ? "Remove the flagged language before sending"
                  : undefined
            }
            className="self-end"
          >
            <IconSend size={15} />
          </Button>
        </div>
      )}
    </>
  );
}
