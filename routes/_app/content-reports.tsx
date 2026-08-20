import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/common/Page";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/common/DataTable";
import { ErrorState, LoadingRows, NoData } from "@/components/common/AsyncStates";
import { StatCard } from "@/components/common/StatCard";
import {
  useContentReports,
  useDismissReport,
  useActionReport,
  type ContentReport,
} from "@/lib/api/queries/content-reports";
import { fmtDate, relTime } from "@/lib/format";
import { IconFlag, IconCheck, IconBan, IconEye } from "@tabler/icons-react";
import { LiquidTabs } from "@/components/common/LiquidTabs";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/content-reports")({ component: ContentReportsPage });

const ENTITY_TYPES = [
  "all",
  "review",
  "listing",
  "tailor_profile",
  "message",
  "portfolio_image",
  "material_offering_image",
] as const;
const STATUS_TABS = ["open", "dismissed", "actioned"] as const;

export function ContentReportsPage() {
  const [entityType, setEntityType] = useState<string>("all");
  const [status, setStatus] = useState<string>("open");
  const [page, setPage] = useState(1);

  const dismiss = useDismissReport();
  const action = useActionReport();
  const mutationErrorToast = (fallback: string) => (e: unknown) =>
    toast.error((e as Error)?.message || fallback);

  const q = useContentReports({
    entity_type: entityType === "all" ? undefined : entityType,
    status,
    page,
  });

  const kpi = q.data?.kpi;

  return (
    <div>
      <PageHeader
        title="Content Reports"
        description="User-flagged reviews, listings, and profiles awaiting review."
      />

      {/* KPI strip */}
      {kpi && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <StatCard
            label="Open"
            value={kpi.open}
            icon={IconFlag}
            className={parseInt(kpi.open) > 0 ? "border-red-200 bg-red-50" : ""}
          />
          <StatCard label="Dismissed" value={kpi.dismissed} icon={IconCheck} />
          <StatCard label="Actioned" value={kpi.actioned} icon={IconBan} />
          <StatCard label="Reviews" value={kpi.reviews} icon={IconFlag} />
          <StatCard label="Listings" value={kpi.listings} icon={IconFlag} />
          <StatCard label="Profiles" value={kpi.tailor_profiles} icon={IconFlag} />
        </div>
      )}

      {/* Status tabs */}
      <LiquidTabs
        className="mb-4"
        tabs={STATUS_TABS.map((s) => ({ id: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
        value={status}
        onChange={(id) => {
          setStatus(id as (typeof STATUS_TABS)[number]);
          setPage(1);
        }}
      />

      {/* Entity type filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {ENTITY_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setEntityType(t);
              setPage(1);
            }}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              entityType === t
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:border-foreground"
            }`}
          >
            {t === "all" ? "All types" : t.replaceAll("_", " ")}
          </button>
        ))}
      </div>

      {q.isLoading && <LoadingRows cols={5} rows={8} />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {!q.isLoading &&
        !q.isError &&
        (!q.data?.data?.length ? (
          <NoData
            title="No reports"
            description={`No ${status} reports${entityType !== "all" ? ` for ${entityType}s` : ""}.`}
          />
        ) : (
          <DataTable
            columns={[
              {
                header: "Type",
                accessor: (r: ContentReport) => (
                  <span className="capitalize text-sm">{r.entity_type.replaceAll("_", " ")}</span>
                ),
              },
              {
                header: "Content",
                accessor: (r: ContentReport) => {
                  const p = r.preview;
                  const text = p?.snippet ?? p?.title ?? p?.business_name ?? null;
                  if (!p) {
                    return (
                      <span className="font-mono text-xs text-muted-foreground">
                        {r.entity_id.slice(0, 12)}…
                      </span>
                    );
                  }
                  return (
                    <div className="flex items-center gap-2 max-w-[260px]">
                      {p.thumb && (
                        <img
                          src={p.thumb}
                          alt=""
                          className="h-9 w-9 rounded object-cover shrink-0 border border-border"
                        />
                      )}
                      <span className="text-sm truncate">
                        {text ?? <span className="text-muted-foreground italic">—</span>}
                        {typeof p.rating === "number" && (
                          <span className="text-muted-foreground"> · {p.rating}★</span>
                        )}
                      </span>
                    </div>
                  );
                },
              },
              {
                header: "Reason",
                accessor: (r: ContentReport) => (
                  <span className="text-sm">
                    {r.reason ?? (
                      <span className="text-muted-foreground italic">No reason given</span>
                    )}
                  </span>
                ),
              },
              {
                header: "Reporter",
                accessor: (r: ContentReport) =>
                  r.reporter_name ?? (
                    <span className="text-muted-foreground italic">anonymous</span>
                  ),
              },
              {
                header: "Reported",
                accessor: (r: ContentReport) => (
                  <span title={fmtDate(r.created_at)} className="text-muted-foreground text-sm">
                    {relTime(r.created_at)}
                  </span>
                ),
              },
              {
                header: "Status",
                accessor: (r: ContentReport) => <StatusBadge status={r.status} />,
              },
              {
                header: "Actions",
                accessor: (r: ContentReport) =>
                  r.status === "open" ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={dismiss.isPending}
                        onClick={() =>
                          dismiss.mutate(r.id, {
                            onError: mutationErrorToast("Couldn't dismiss this report"),
                          })
                        }
                        title="Dismiss — report unfounded, no action needed"
                      >
                        <IconCheck size={14} className="mr-1" /> Dismiss
                      </Button>
                      {(r.entity_type === "review" ||
                        r.entity_type === "listing" ||
                        r.entity_type === "tailor_profile" ||
                        r.entity_type === "message" ||
                        r.entity_type === "portfolio_image" ||
                        r.entity_type === "material_offering_image") && (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={action.isPending}
                          onClick={() => {
                            const isProfile = r.entity_type === "tailor_profile";
                            const isImage =
                              r.entity_type === "portfolio_image" ||
                              r.entity_type === "material_offering_image";
                            const isMessage = r.entity_type === "message";
                            const msg = isProfile
                              ? "Remove this tailor's profile & banner picture? It will be cleared from public view."
                              : isImage
                                ? "Remove this photo? It will be deleted from public view."
                                : isMessage
                                  ? "Hide this message? It will no longer be visible to either party."
                                  : `Hide this ${r.entity_type}? It will be removed from public view.`;
                            if (!window.confirm(msg)) return;
                            action.mutate(r.id, {
                              onError: mutationErrorToast("Couldn't action this report"),
                            });
                          }}
                          title={
                            r.entity_type === "tailor_profile"
                              ? "Remove the reported picture"
                              : "Hide the reported content"
                          }
                        >
                          <IconBan size={14} className="mr-1" />
                          {r.entity_type === "tailor_profile" ? "Remove picture" : "Hide"}
                        </Button>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  ),
              },
            ]}
            rows={q.data.data}
            pagination={{
              page: q.data.page,
              totalPages: q.data.total_pages,
              onPageChange: setPage,
            }}
          />
        ))}
    </div>
  );
}
