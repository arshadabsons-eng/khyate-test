import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { IconStar, IconStarFilled, IconMessageReply } from "@tabler/icons-react";
import { Card } from "@/components/common/Page";
import { StatCard } from "@/components/common/StatCard";
import { CenteredSpinner, ErrorState, NoData } from "@/components/common/AsyncStates";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useTailorReviews, useRespondReview } from "@/lib/api/queries/tailor";
import { toast } from "sonner";
import { fmtDate } from "@/lib/format";
import type { ReviewRow } from "@/lib/api/types";

export const Route = createFileRoute("/tailor/reviews")({ component: ReviewsPage });

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex">
      {Array.from({ length: 5 }).map((_, i) =>
        i < n ? (
          <IconStarFilled key={i} size={15} className="text-warning" />
        ) : (
          <IconStar key={i} size={15} className="text-muted-foreground" />
        ),
      )}
    </span>
  );
}

function ReviewsPage() {
  const q = useTailorReviews();
  const [respond, setRespond] = useState<ReviewRow | null>(null);

  if (q.isLoading) return <CenteredSpinner />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const rows = q.data ?? [];
  const avg = rows.length ? (rows.reduce((s, r) => s + r.rating, 0) / rows.length).toFixed(1) : "—";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Reviews" value={rows.length} />
        <StatCard label="Average rating" value={avg} suffix="★" />
        <StatCard label="5-star" value={rows.filter((r) => r.rating === 5).length} />
        <StatCard
          label="Needs reply"
          value={rows.filter((r) => !(r as { tailor_reply?: string }).tailor_reply).length}
        />
      </div>

      {rows.length === 0 ? (
        <Card>
          <NoData icon={IconStar} title="No reviews yet" />
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Stars n={r.rating} />
                    <span className="font-medium text-sm">{r.title}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{r.body}</p>
                  <div className="text-xs text-muted-foreground mt-2">
                    {r.reviewer.name} · {fmtDate(r.created_at)}
                  </div>
                  {(r as { tailor_reply?: string }).tailor_reply && (
                    <div className="mt-2 text-sm bg-muted/50 border-l-2 border-primary pl-3 py-1.5 rounded">
                      <span className="text-xs font-medium text-primary">Your reply</span>
                      <p className="text-muted-foreground">
                        {(r as { tailor_reply?: string }).tailor_reply}
                      </p>
                    </div>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={() => setRespond(r)}>
                  <IconMessageReply size={15} className="mr-1" />
                  {(r as { tailor_reply?: string }).tailor_reply ? "Edit reply" : "Respond"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {respond && <RespondDialog review={respond} onClose={() => setRespond(null)} />}
    </div>
  );
}

function RespondDialog({ review, onClose }: { review: ReviewRow; onClose: () => void }) {
  const [text, setText] = useState("");
  const respond = useRespondReview();
  const mutationErrorToast = (fallback: string) => (e: unknown) =>
    toast.error((e as Error)?.message || fallback);
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Respond to {review.reviewer.name}</DialogTitle>
          <DialogDescription className="sr-only">
            Write a public reply to this customer review.
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground italic">"{review.body}"</p>
        <Textarea
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Thank you for your feedback…"
        />
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!text.trim() || respond.isPending}
            onClick={() =>
              respond.mutate(
                { id: review.id, response: text },
                { onSuccess: onClose, onError: mutationErrorToast("Couldn't post that response") },
              )
            }
          >
            {respond.isPending ? "Posting…" : "Post response"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
