import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, PageHeader } from "@/components/common/Page";
import { CenteredSpinner, ErrorState, NoData } from "@/components/common/AsyncStates";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import { auth } from "@/lib/auth";
import { useRbacMe } from "@/lib/api/queries/rbac";
import {
  useValidatorTeams,
  useValidatorCandidates,
  useSetReviewersRequired,
  useCreateValidatorTeam,
  useRenameValidatorTeam,
  useDeleteValidatorTeam,
  useAddTeamMember,
  useRemoveTeamMember,
  useRebalanceValidatorTeams,
} from "@/lib/api/queries/validator-teams";
import type { ValidatorTeam } from "@/lib/api/types";
import { IconUsersGroup, IconPlus, IconTrash, IconPencil, IconRefresh, IconX } from "@tabler/icons-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/validator-teams")({ component: ValidatorTeamsPage });

function ValidatorTeamsPage() {
  const teamsQ = useValidatorTeams();
  const rbacQ = useRbacMe();
  // Structural control (create/rename/delete a team, move people between
  // teams, change the quorum target) mirrors the backend's MANAGE gate
  // (kyc_review:admin) — everyone with kyc_review:edit-or-above can still see
  // the roster and queue sizes read-only (the page renders for them either
  // way; only the mutating controls below are hidden).
  const canManage = auth.isSuperAdmin() || rbacQ.data?.permissions?.kyc_review === "admin";
  const candidatesQ = useValidatorCandidates(canManage);

  const [newTeamOpen, setNewTeamOpen] = useState(false);

  if (teamsQ.isLoading) return <CenteredSpinner />;
  if (teamsQ.isError || !teamsQ.data)
    return <ErrorState error={teamsQ.error} onRetry={() => teamsQ.refetch()} title="Couldn't load validator teams" />;

  const { teams, reviewers_required, unassigned_pending_count } = teamsQ.data;
  const candidates = candidatesQ.data ?? [];

  return (
    <div className="w-full space-y-6">
      <PageHeader
        title="Validator Teams"
        description="Split KYC document review across fixed teams so each team works its own slice of the backlog, instead of everyone pulling from one shared pool."
      />

      <ReviewersRequiredCard current={reviewers_required} canManage={canManage} />

      {unassigned_pending_count > 0 && teams.length > 0 && (
        <UnassignedBanner count={unassigned_pending_count} canManage={canManage} />
      )}

      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setNewTeamOpen(true)}>
            <IconPlus size={15} className="mr-1.5" /> New team
          </Button>
        </div>
      )}

      {teams.length === 0 ? (
        <Card>
          <NoData
            icon={IconUsersGroup}
            title="No teams yet"
            description="Every reviewer currently shares one pool. Create a team to start splitting the document backlog across fixed groups."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {teams.map((t) => (
            <TeamCard
              key={t.id}
              team={t}
              reviewersRequired={reviewers_required}
              candidates={candidates}
              canManage={canManage}
            />
          ))}
        </div>
      )}

      <NewTeamDialog open={newTeamOpen} onOpenChange={setNewTeamOpen} />
    </div>
  );
}

function ReviewersRequiredCard({ current, canManage }: { current: number; canManage: boolean }) {
  const [value, setValue] = useState(String(current));
  const setRequired = useSetReviewersRequired();
  const dirty = value !== String(current);

  return (
    <Card title="Validations required per document">
      <p className="text-sm text-muted-foreground mb-3">
        How many independent reviewers must pass a document before it's approved. A single fail rejects it
        immediately, regardless of this number.
      </p>
      <div className="flex items-center gap-3">
        <Input
          type="number"
          min={1}
          max={20}
          value={value}
          disabled={!canManage}
          onChange={(e) => setValue(e.target.value)}
          className="w-24"
        />
        {canManage && dirty && (
          <Button
            size="sm"
            disabled={setRequired.isPending}
            onClick={() => {
              const n = parseInt(value, 10);
              if (!n || n < 1 || n > 20) {
                toast.error("Enter a number between 1 and 20");
                return;
              }
              setRequired.mutate(n, {
                onSuccess: () => toast.success("Saved"),
                onError: (e: unknown) => toast.error((e as Error)?.message || "Couldn't save"),
              });
            }}
          >
            {setRequired.isPending ? "Saving…" : "Save"}
          </Button>
        )}
      </div>
    </Card>
  );
}

function UnassignedBanner({ count, canManage }: { count: number; canManage: boolean }) {
  const rebalance = useRebalanceValidatorTeams();
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 p-4 flex items-center justify-between gap-3">
      <span className="text-sm">
        {count} pending document{count === 1 ? "" : "s"} {count === 1 ? "isn't" : "aren't"} assigned to any team yet.
      </span>
      {canManage && (
        <Button
          size="sm"
          variant="outline"
          disabled={rebalance.isPending}
          onClick={() =>
            rebalance.mutate(undefined, {
              onSuccess: () => toast.success("Backlog rebalanced across teams"),
              onError: (e: unknown) => toast.error((e as Error)?.message || "Couldn't rebalance"),
            })
          }
        >
          <IconRefresh size={14} className="mr-1.5" /> Rebalance
        </Button>
      )}
    </div>
  );
}

function TeamCard({
  team,
  reviewersRequired,
  candidates,
  canManage,
}: {
  team: ValidatorTeam;
  reviewersRequired: number;
  candidates: { id: string; full_name: string; email: string; validator_team_id: string | null }[];
  canManage: boolean;
}) {
  const rename = useRenameValidatorTeam();
  const del = useDeleteValidatorTeam();
  const addMember = useAddTeamMember();
  const removeMember = useRemoveTeamMember();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(team.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const underStaffed = team.members.length < reviewersRequired;
  const memberIds = new Set(team.members.map((m) => m.id));
  const available = candidates.filter((c) => !memberIds.has(c.id));

  const saveName = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === team.name) {
      setEditing(false);
      setName(team.name);
      return;
    }
    rename.mutate(
      { id: team.id, name: trimmed },
      {
        onSuccess: () => setEditing(false),
        onError: (e: unknown) => toast.error((e as Error)?.message || "Couldn't rename"),
      },
    );
  };

  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-center gap-2">
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveName()}
                className="h-8"
              />
              <Button size="sm" onClick={saveName} disabled={rename.isPending}>
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setName(team.name); }}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-base">{team.name}</h3>
              {canManage && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="p-1 rounded hover:bg-muted text-muted-foreground"
                  title="Rename"
                >
                  <IconPencil size={13} />
                </button>
              )}
            </div>
          )}
          <div className="text-xs text-muted-foreground mt-1">
            {team.pending_count} pending in queue · {team.members.length} member
            {team.members.length === 1 ? "" : "s"}
          </div>
          {underStaffed && (
            <div className="text-xs text-amber-700 mt-1">
              Fewer members than the {reviewersRequired} validations required — this team can't reach quorum on its
              own yet.
            </div>
          )}
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="p-1.5 rounded hover:bg-muted text-destructive shrink-0"
            title="Delete team"
          >
            <IconTrash size={15} />
          </button>
        )}
      </div>

      <div className="mt-3 space-y-1.5">
        {team.members.length === 0 ? (
          <p className="text-xs text-muted-foreground">No members yet.</p>
        ) : (
          team.members.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5">
              <div className="min-w-0">
                <div className="text-sm truncate">{m.full_name}</div>
                <div className="text-xs text-muted-foreground truncate">{m.email}</div>
              </div>
              {canManage && (
                <button
                  type="button"
                  title="Remove from team"
                  onClick={() =>
                    removeMember.mutate(
                      { teamId: team.id, userId: m.id },
                      { onError: (e: unknown) => toast.error((e as Error)?.message || "Couldn't remove") },
                    )
                  }
                  className="p-1 rounded hover:bg-destructive/10 text-destructive shrink-0"
                >
                  <IconX size={14} />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {canManage && (
        <div className="mt-3">
          <Label className="text-xs">Add member</Label>
          <select
            aria-label="Add member"
            value=""
            onChange={(e) => {
              const userId = e.target.value;
              if (!userId) return;
              addMember.mutate(
                { teamId: team.id, userId },
                { onError: (err: unknown) => toast.error((err as Error)?.message || "Couldn't add member") },
              );
            }}
            className="mt-1 w-full border rounded-md px-2.5 py-1.5 text-sm bg-card"
          >
            <option value="">Select a staff member…</option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.full_name} ({c.email}){c.validator_team_id ? " — currently on another team" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete "${team.name}"?`}
        description="Members are freed up and this team's queued documents are redistributed across whatever teams remain. This can't be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() =>
          del.mutate(team.id, {
            onSuccess: () => toast.success(`Deleted "${team.name}"`),
            onError: (e: unknown) => toast.error((e as Error)?.message || "Couldn't delete team"),
          })
        }
      />
    </Card>
  );
}

function NewTeamDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [name, setName] = useState("");
  const create = useCreateValidatorTeam();

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Enter a team name");
      return;
    }
    create.mutate(
      trimmed,
      {
        onSuccess: () => {
          toast.success(`Created "${trimmed}"`);
          setName("");
          onOpenChange(false);
        },
        onError: (e: unknown) => toast.error((e as Error)?.message || "Couldn't create team"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogTitle>New validator team</DialogTitle>
        <div className="space-y-1.5 mt-2">
          <Label>Team name</Label>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="e.g. Team A"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? "Creating…" : "Create team"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
