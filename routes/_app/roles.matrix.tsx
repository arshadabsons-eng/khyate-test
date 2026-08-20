import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { IconArrowLeft, IconLock, IconDeviceFloppy, IconRotate } from "@tabler/icons-react";
import { Card, PageHeader } from "@/components/common/Page";
import { CenteredSpinner, ErrorState } from "@/components/common/AsyncStates";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { useRbacMatrix, useSetPermissions } from "@/lib/api/queries/rbac";
import { useRbacDraft } from "@/hooks/use-rbac-draft";
import { LevelChips } from "@/components/rbac/LevelChips";
import { MODULE_RANK_FLOOR } from "@/lib/rbac-route-guard";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/roles/matrix")({ component: RolesMatrixPage });

function RolesMatrixPage() {
  const q = useRbacMatrix();
  const setPerm = useSetPermissions();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const matrix = q.data?.matrix ?? {};
  const roles = q.data?.roles ?? [];
  const modules = q.data?.modules ?? [];
  const levels = q.data?.levels ?? [];

  const { draft, setCell, changes, dirty, discard } = useRbacDraft(matrix, roles, modules);

  if (q.isLoading) return <CenteredSpinner />;
  if (q.isError || !q.data)
    return (
      <ErrorState error={q.error} onRetry={() => q.refetch()} title="Couldn't load the matrix" />
    );

  const saveChanges = () => {
    setPerm.mutate(
      changes.map((c) => ({ role_key: c.role_key, module: c.module, level: c.level })),
      {
        onSuccess: () => {
          setConfirmOpen(false);
          toast.success(`Saved ${changes.length} change${changes.length === 1 ? "" : "s"}`);
        },
        onError: (e: unknown) => toast.error((e as Error)?.message || "Couldn't save changes"),
      },
    );
  };

  return (
    <div className="space-y-6 pb-20">
      <PageHeader
        title="Permissions Matrix"
        description="Every role side by side. Click a level chip to change it."
        actions={
          <Button variant="outline" asChild>
            <Link to="/roles">
              <IconArrowLeft size={15} className="mr-1.5" /> Back to roles
            </Link>
          </Button>
        }
      />

      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="text-left py-2.5 px-4 font-medium text-muted-foreground sticky left-0 bg-muted/40 z-10">
                  Module
                </th>
                {roles.map((r) => (
                  <th key={r.key} className="py-2.5 px-3 font-medium text-center min-w-[150px]">
                    <div className="flex items-center justify-center gap-1.5">
                      {r.is_system && <IconLock size={12} className="text-muted-foreground" />}
                      <span>{r.label}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {modules.map((m) => (
                <tr key={m.key} className="hover:bg-muted/20">
                  <td className="py-1.5 px-4 font-medium sticky left-0 bg-card z-10">
                    {m.label}
                    {m.apiOnly && (
                      <span
                        className="ml-1.5 text-[9px] font-normal uppercase tracking-wide text-muted-foreground align-middle"
                        title="This module gates backend endpoints only — no menu item changes when it's edited."
                      >
                        API only
                      </span>
                    )}
                  </td>
                  {roles.map((r) => {
                    const level = draft[r.key]?.[m.key] ?? "none";
                    const locked = r.key === "super_admin";
                    const floor = MODULE_RANK_FLOOR[m.key];
                    const rankCapped = !locked && floor != null && r.rank < floor;
                    return (
                      <td key={r.key} className="py-1.5 px-3 text-center">
                        <LevelChips
                          value={level}
                          onChange={(lvl) => setCell(r.key, m.key, lvl)}
                          levels={levels}
                          locked={locked}
                          rankCappedReason={
                            rankCapped
                              ? `${r.label} is rank ${r.rank} — this page requires rank ${floor}+ regardless of what's granted here, so this can't take effect.`
                              : undefined
                          }
                          compact
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {dirty && (
        <div className="fixed bottom-0 inset-x-0 lg:left-[var(--sidebar-w,220px)] z-30 border-t bg-card/95 backdrop-blur px-4 py-3 flex items-center justify-between gap-3 shadow-[0_-2px_10px_rgba(0,0,0,0.06)]">
          <span className="text-sm">
            <span className="font-semibold text-primary">{changes.length}</span> unsaved permission
            change{changes.length === 1 ? "" : "s"}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={discard}>
              <IconRotate size={15} className="mr-1.5" /> Discard
            </Button>
            <Button onClick={() => setConfirmOpen(true)}>
              <IconDeviceFloppy size={15} className="mr-1.5" /> Review &amp; save
            </Button>
          </div>
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Apply {changes.length} permission change{changes.length === 1 ? "" : "s"}?
            </DialogTitle>
            <DialogDescription>
              This changes what these roles can access immediately. Review before saving.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-72 overflow-y-auto rounded-md border divide-y">
            {changes.map((c) => (
              <div
                key={`${c.role_key}:${c.module}`}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-medium">{c.role_label}</span>
                  <span className="text-muted-foreground"> · {c.module_label}</span>
                </span>
                <span className="flex items-center gap-2 text-xs">
                  <span className="px-1.5 py-0.5 rounded capitalize bg-muted">{c.from}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="px-1.5 py-0.5 rounded capitalize bg-muted">{c.level}</span>
                </span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveChanges} disabled={setPerm.isPending}>
              {setPerm.isPending ? "Saving…" : "Confirm & save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
