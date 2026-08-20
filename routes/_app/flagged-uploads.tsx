import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/common/Page";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/common/DataTable";
import { ErrorState, LoadingRows, NoData } from "@/components/common/AsyncStates";
import { StatCard } from "@/components/common/StatCard";
import {
  useFlaggedUploads,
  useDismissFlaggedUpload,
  useRemoveFlaggedUpload,
  type FlaggedUpload,
} from "@/lib/api/queries/flagged-uploads";
import { usePerm } from "@/lib/api/queries/rbac";
import { fmtDate, relTime } from "@/lib/format";
import { IconFlag, IconCheck, IconBan } from "@tabler/icons-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/flagged-uploads")({ component: FlaggedUploadsPage });

export function FlaggedUploadsPage() {
  const [page, setPage] = useState(1);
  const q = useFlaggedUploads(page);
  const dismiss = useDismissFlaggedUpload();
  const remove = useRemoveFlaggedUpload();
  // Dismiss/Remove require moderation:'edit' server-side. Without this the page
  // showed both actions to a view-only moderator, and every click 403'd.
  const canModerate = usePerm("moderation", "edit");
  const mutationErrorToast = (fallback: string) => (e: unknown) =>
    toast.error((e as Error)?.message || fallback);

  const total = q.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / (q.data?.limit ?? 20)));

  return (
    <div>
      <PageHeader
        title="Flagged Uploads"
        description="Images automatically flagged by content screening, awaiting a human review — a flag is never an auto-takedown, only a queue entry."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 max-w-md">
        <StatCard
          label="Pending"
          value={total}
          icon={IconFlag}
          className={total > 0 ? "border-red-200 bg-red-50" : ""}
        />
      </div>

      {q.isLoading && <LoadingRows cols={4} rows={8} />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {!q.isLoading &&
        !q.isError &&
        (!q.data?.items?.length ? (
          <NoData title="No flagged uploads" description="Nothing pending review right now." />
        ) : (
          <DataTable
            columns={[
              {
                header: "Image",
                accessor: (r: FlaggedUpload) => (
                  <img
                    src={r.upload_url}
                    alt=""
                    className="h-14 w-14 rounded object-cover border border-border"
                  />
                ),
              },
              {
                header: "Reasons",
                accessor: (r: FlaggedUpload) => (
                  <span className="text-sm">
                    {r.reasons && r.reasons.length > 0 ? (
                      r.reasons.join(", ")
                    ) : (
                      <span className="text-muted-foreground italic">No reason given</span>
                    )}
                  </span>
                ),
              },
              {
                header: "Uploaded by",
                accessor: (r: FlaggedUpload) =>
                  r.uploader_name ?? (
                    <span className="text-muted-foreground italic">Unknown user</span>
                  ),
              },
              {
                header: "Flagged",
                accessor: (r: FlaggedUpload) => (
                  <span title={fmtDate(r.created_at)} className="text-muted-foreground text-sm">
                    {relTime(r.created_at)}
                  </span>
                ),
              },
              {
                header: "Actions",
                accessor: (r: FlaggedUpload) => (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={dismiss.isPending || !canModerate}
                      onClick={() =>
                        dismiss.mutate(r.id, {
                          onError: mutationErrorToast("Couldn't dismiss this flag"),
                        })
                      }
                      title={canModerate
                        ? "Dismiss — false positive, no action needed"
                        : "You have read-only access to Moderation"}
                    >
                      <IconCheck size={14} className="mr-1" /> Dismiss
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={remove.isPending || !canModerate}
                      onClick={() => {
                        if (
                          !window.confirm(
                            "Remove this image? It will be deleted from storage immediately.",
                          )
                        )
                          return;
                        remove.mutate(r.id, {
                          onError: mutationErrorToast("Couldn't remove this image"),
                        });
                      }}
                      title={canModerate
                        ? "Confirmed violation — deletes the file"
                        : "You have read-only access to Moderation"}
                    >
                      <IconBan size={14} className="mr-1" /> Remove
                    </Button>
                  </div>
                ),
              },
            ]}
            rows={q.data.items}
            pagination={{ page, totalPages, onPageChange: setPage }}
          />
        ))}
    </div>
  );
}
