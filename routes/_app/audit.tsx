import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGlobalAuditLog } from "@/lib/api/queries/admins";
import { fmtDateTime } from "@/lib/format";
import { CenteredSpinner, ErrorState } from "@/components/common/AsyncStates";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/audit")({ component: AuditPage });

const ENTITY_TYPES = [
  "all",
  "order",
  "dispute",
  "payout",
  "tailor",
  "user",
  "settings",
  "listing",
  "broadcast",
  "role",
  "feature_flag",
  "delivery",
  "promotion",
  "booster_product",
  "tailor_boost",
  "featured_listing",
  "subscription_plan",
  "tailor_document",
  "config",
  "review",
  "flagged_upload",
  "upload",
  "content_report",
  "tailor_material_offering",
];

function AuditPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("all");

  const { data, isLoading, isError, error, refetch } = useGlobalAuditLog(
    page,
    action.trim() || undefined,
    entityType === "all" ? undefined : entityType,
  );
  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const perPage = 50;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Audit Log</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {total.toLocaleString()} entries — all write actions are recorded here
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Filter by action…"
          className="w-56"
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
        />
        <Select
          value={entityType}
          onValueChange={(v) => {
            setEntityType(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Entity type" />
          </SelectTrigger>
          <SelectContent>
            {ENTITY_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t === "all" ? "All types" : t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isError ? (
        <ErrorState error={error} onRetry={() => refetch()} title="Couldn't load the audit log" />
      ) : isLoading ? (
        <CenteredSpinner />
      ) : (
        <div className="border rounded-lg overflow-hidden bg-card">
          <table className="w-full text-sm kh-table">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left py-2.5 px-4 font-medium text-muted-foreground w-44">
                  When
                </th>
                <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">Action</th>
                <th className="text-left py-2.5 px-4 font-medium text-muted-foreground">Summary</th>
                <th className="text-left py-2.5 px-4 font-medium text-muted-foreground w-36">
                  Actor
                </th>
                <th className="text-left py-2.5 px-4 font-medium text-muted-foreground w-28">
                  Entity
                </th>
                <th className="text-left py-2.5 px-4 font-medium text-muted-foreground w-28">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    No audit entries found
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-2 px-4 text-muted-foreground whitespace-nowrap font-mono text-xs">
                      {fmtDateTime(r.created_at)}
                    </td>
                    <td className="py-2 px-4">
                      <span className="inline-block font-mono text-xs bg-muted rounded px-1.5 py-0.5">
                        {r.action}
                      </span>
                    </td>
                    <td
                      className="py-2 px-4 text-muted-foreground max-w-xs truncate"
                      title={r.summary}
                    >
                      {r.summary}
                    </td>
                    <td className="py-2 px-4 truncate">
                      <div className="text-xs font-medium">{r.actor_name ?? "—"}</div>
                      {r.actor_role && (
                        <div className="text-xs text-muted-foreground">{r.actor_role}</div>
                      )}
                    </td>
                    <td className="py-2 px-4 text-xs text-muted-foreground">
                      {r.entity_type || "—"}
                    </td>
                    <td className="py-2 px-4 font-mono text-xs text-muted-foreground">
                      {r.ip ?? r.ip_address ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
