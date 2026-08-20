import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { auth } from "@/lib/auth";
import {
  IconPlus,
  IconTrash,
  IconDeviceFloppy,
  IconRotate,
  IconSearch,
  IconUsers,
  IconTable,
} from "@tabler/icons-react";
import { Card, PageHeader, EmptyState } from "@/components/common/Page";
import { CenteredSpinner, ErrorState } from "@/components/common/AsyncStates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  useRbacMatrix,
  useSaveRole,
  useDeleteRole,
  useSetPermissions,
  type RbacRole,
} from "@/lib/api/queries/rbac";
import { useAdminUsers, useUpdateAdminRole } from "@/lib/api/queries/admins";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { AdminRole } from "@/lib/api/types";
import { useRbacDraft } from "@/hooks/use-rbac-draft";
import { LevelChips } from "@/components/rbac/LevelChips";
import { MODULE_RANK_FLOOR } from "@/lib/rbac-route-guard";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/roles/")({ component: RolesPage });

function RolesPage() {
  const q = useRbacMatrix();
  const setPerm = useSetPermissions();
  const saveRole = useSaveRole();
  const delRole = useDeleteRole();

  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [roleSearch, setRoleSearch] = useState("");
  const [moduleSearch, setModuleSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const matrix = useMemo(() => q.data?.matrix ?? {}, [q.data]);
  const roles = useMemo(() => q.data?.roles ?? [], [q.data]);
  const modules = useMemo(() => q.data?.modules ?? [], [q.data]);
  const levels = useMemo(() => q.data?.levels ?? [], [q.data]);

  const { draft, setCell, changes, dirty, discard } = useRbacDraft(matrix, roles, modules);

  const selectedRole = useMemo(
    () => roles.find((r) => r.key === selectedKey) ?? roles[0] ?? null,
    [roles, selectedKey],
  );

  const filteredRoles = useMemo(
    () => roles.filter((r) => r.label.toLowerCase().includes(roleSearch.trim().toLowerCase())),
    [roles, roleSearch],
  );

  const filteredModules = useMemo(
    () => modules.filter((m) => m.label.toLowerCase().includes(moduleSearch.trim().toLowerCase())),
    [modules, moduleSearch],
  );

  if (q.isLoading) return <CenteredSpinner />;
  if (q.isError || !q.data)
    return <ErrorState error={q.error} onRetry={() => q.refetch()} title="Couldn't load roles" />;

  const enabledCount = selectedRole
    ? modules.filter((m) => (draft[selectedRole.key]?.[m.key] ?? "none") !== "none").length
    : 0;

  const addRole = () => {
    if (!newLabel.trim()) return toast.error("Enter a role name");
    // No tier picker: the backend always creates a custom role at the base
    // (helpdesk) tier regardless of what's sent — a higher tier bypasses the
    // permission matrix entirely (requireRole doesn't consult it), so real
    // access control for a custom role comes only from the Page Access cards
    // below, never from a rank picked here.
    saveRole.mutate(
      { label: newLabel.trim() },
      {
        onSuccess: () => {
          setNewLabel("");
          setAddOpen(false);
          toast.success("Role created");
        },
        onError: (e: unknown) => toast.error((e as Error)?.message || "Couldn't create role"),
      },
    );
  };

  const removeRole = (r: RbacRole) => {
    if (!window.confirm(`Delete role "${r.label}"? Users with this role lose it.`)) return;
    delRole.mutate(r.key, {
      onSuccess: () => {
        if (selectedKey === r.key) setSelectedKey(null);
        toast.success("Role deleted");
      },
      onError: (e: unknown) => toast.error((e as Error)?.message || "Couldn't delete"),
    });
  };

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
        title="Roles & Permissions"
        description="Pick a role to see and edit exactly what it can access, module by module. Changes are only applied when you confirm."
        actions={
          <Button variant="outline" asChild>
            <Link to="/roles/matrix">
              <IconTable size={15} className="mr-1.5" /> View as matrix
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">
        {/* Left: role list */}
        <Card className="!p-0 overflow-hidden">
          <div className="p-3 border-b flex items-center gap-2">
            <div className="relative flex-1">
              <IconSearch
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={roleSearch}
                onChange={(e) => setRoleSearch(e.target.value)}
                placeholder="Search roles..."
                className="pl-8 h-8 text-sm"
              />
            </div>
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
              <IconPlus size={14} className="mr-1" /> Add
            </Button>
          </div>
          <div className="max-h-[70vh] overflow-y-auto divide-y">
            {filteredRoles.map((r) => (
              <div
                key={r.key}
                className={`w-full flex items-center justify-between gap-2 pr-3 hover:bg-muted/40 transition-colors ${selectedRole?.key === r.key ? "bg-muted/60" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedKey(r.key)}
                  className="flex-1 min-w-0 text-left pl-3 py-2.5"
                >
                  <div className="text-sm font-medium truncate">{r.label}</div>
                  <Badge
                    variant={r.is_system ? "secondary" : "outline"}
                    className="mt-1 text-[10px]"
                  >
                    {r.is_system ? "System" : "Custom"}
                  </Badge>
                </button>
                {!r.is_system && (
                  <button
                    type="button"
                    title="Delete role"
                    className="shrink-0 text-destructive hover:bg-destructive/10 rounded p-1"
                    onClick={() => removeRole(r)}
                  >
                    <IconTrash size={13} />
                  </button>
                )}
              </div>
            ))}
            {filteredRoles.length === 0 && (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                No roles match.
              </div>
            )}
          </div>
        </Card>

        {/* Right: selected role detail */}
        {selectedRole ? (
          <Card className="!p-0 overflow-hidden">
            <div className="px-5 py-4 border-b">
              <div className="flex items-center gap-2">
                <h3 className="kh-h3 font-serif">{selectedRole.label}</h3>
                <Badge variant={selectedRole.is_system ? "secondary" : "outline"}>
                  {selectedRole.is_system ? "System" : "Custom"}
                </Badge>
              </div>
              {selectedRole.description && (
                <p className="text-xs text-muted-foreground mt-1">{selectedRole.description}</p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                {enabledCount} of {modules.length} modules enabled
              </p>
            </div>

            <Tabs defaultValue="access" className="p-5">
              <TabsList>
                <TabsTrigger value="access">Page Access</TabsTrigger>
                <TabsTrigger value="users">Users</TabsTrigger>
              </TabsList>

              <TabsContent value="access" className="space-y-3 mt-4">
                <div className="relative max-w-xs">
                  <IconSearch
                    size={14}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    value={moduleSearch}
                    onChange={(e) => setModuleSearch(e.target.value)}
                    placeholder="Filter pages..."
                    className="pl-8 h-8 text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredModules.map((m) => {
                    const locked = selectedRole.key === "super_admin";
                    const level = draft[selectedRole.key]?.[m.key] ?? "none";
                    const floor = MODULE_RANK_FLOOR[m.key];
                    const rankCapped = !locked && floor != null && selectedRole.rank < floor;
                    return (
                      <div
                        key={m.key}
                        className="rounded-lg border p-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{m.label}</div>
                          {m.apiOnly && (
                            <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
                              API only
                            </span>
                          )}
                          {rankCapped && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              Requires rank {floor}+ to access — {selectedRole.label} is rank{" "}
                              {selectedRole.rank}
                            </div>
                          )}
                        </div>
                        <LevelChips
                          value={level}
                          onChange={(lvl) => setCell(selectedRole.key, m.key, lvl)}
                          levels={levels}
                          locked={locked}
                          rankCappedReason={
                            rankCapped
                              ? `${selectedRole.label} is rank ${selectedRole.rank} — this page requires rank ${floor}+ regardless of what's granted here, so this can't take effect.`
                              : undefined
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="users" className="mt-4">
                <RoleUsersTab roleKey={selectedRole.key} roleLabel={selectedRole.label} />
              </TabsContent>
            </Tabs>
          </Card>
        ) : (
          <Card>
            <EmptyState
              icon={IconUsers}
              title="No roles yet"
              description="Add a role to get started."
            />
          </Card>
        )}
      </div>

      {/* Sticky save bar */}
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

      {/* Add role dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add a role</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Role name</Label>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Validator"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              New roles start with no access to anything — use the Page Access cards after creating
              it to grant exactly what it needs, module by module.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addRole} disabled={saveRole.isPending}>
              {saveRole.isPending ? "Adding…" : "Add role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation popup — the guard against accidental edits. */}
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

// Reuses the existing admin-users list, filtered client-side by role. GET
// /admin/users now returns every non-customer/non-tailor role (not just the
// 4 built-ins), so a custom role's members show up here correctly — that was
// a real bug: a user assigned a custom role used to vanish from this list
// entirely, with no way to find or manage them again.
function RoleUsersTab({ roleKey, roleLabel }: { roleKey: string; roleLabel: string }) {
  const { data, isLoading, isError, error, refetch } = useAdminUsers(undefined, 100);
  const users = (data?.data ?? []).filter((u) => u.role === roleKey);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
          <IconPlus size={14} className="mr-1.5" /> Add user
        </Button>
      </div>
      {isLoading ? (
        <CenteredSpinner />
      ) : isError ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : users.length === 0 ? (
        <EmptyState
          icon={IconUsers}
          title="No users with this role"
          description="Add one above, or reassign an existing admin's role from here."
        />
      ) : (
        <div className="divide-y rounded-lg border">
          {users.map((u) => (
            <div key={u.id} className="px-3 py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{u.full_name}</div>
                <div className="text-xs text-muted-foreground truncate">{u.email}</div>
              </div>
              <Badge variant={u.is_active ? "secondary" : "outline"} className="shrink-0">
                {u.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
          ))}
        </div>
      )}
      {addOpen && (
        <AddUserToRoleDialog
          roleKey={roleKey}
          roleLabel={roleLabel}
          onClose={() => setAddOpen(false)}
        />
      )}
    </div>
  );
}

// Searches existing admin users and reassigns one to this role — the actual
// "add a user to a role" action the Users tab was missing (it only ever
// displayed who already had a role, with no way to change that from here).
function AddUserToRoleDialog({
  roleKey,
  roleLabel,
  onClose,
}: {
  roleKey: string;
  roleLabel: string;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const dSearch = useDebouncedValue(search, 300);
  const { data, isLoading, isError, error, refetch } = useAdminUsers(dSearch || undefined, 20);
  const updateRole = useUpdateAdminRole();
  const myEmail = auth.user().email?.toLowerCase();
  // The backend (admin-extra.js PUT /admin/users/:id/role) always rejects a
  // self-role-change with a 400 — excluding your own account here means you
  // never see an "Assign" button that's guaranteed to fail, instead of
  // discovering that only after clicking it.
  const candidates = (data?.data ?? []).filter(
    (u) => u.role !== roleKey && u.email?.toLowerCase() !== myEmail,
  );

  const assign = (userId: string, name: string) => {
    updateRole.mutate(
      { id: userId, role: roleKey as AdminRole },
      {
        onSuccess: () => {
          toast.success(`${name} is now ${roleLabel}`);
          onClose();
        },
        onError: (e: unknown) => toast.error((e as Error)?.message || "Couldn't assign this role"),
      },
    );
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add user to {roleLabel}</DialogTitle>
          <DialogDescription>
            Search an existing admin/staff account and assign them this role. To create a brand new
            account instead, use Admin Users.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <IconSearch
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="pl-8"
              autoFocus
            />
          </div>
          {isLoading ? (
            <CenteredSpinner />
          ) : isError ? (
            <ErrorState error={error} onRetry={() => refetch()} />
          ) : candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {search ? "No matching users." : "Start typing to search."}
            </p>
          ) : (
            <div className="divide-y rounded-lg border max-h-64 overflow-y-auto">
              {candidates.map((u) => (
                <div key={u.id} className="px-3 py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{u.full_name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {u.email} · currently {u.role.replace(/_/g, " ")}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={updateRole.isPending}
                    onClick={() => assign(u.id, u.full_name)}
                  >
                    Assign
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
