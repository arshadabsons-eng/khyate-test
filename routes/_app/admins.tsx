import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  IconUserShield,
  IconPlus,
  IconSearch,
  IconBan,
  IconKey,
  IconRefresh,
  IconHistory,
  IconEdit,
  IconTrash,
  IconCopy,
} from "@tabler/icons-react";
import {
  useAdminUsers,
  useAdminAuditLog,
  useCreateAdmin,
  useDeactivateAdmin,
  useResetAdminTotp,
  useResetAdminPassword,
  useActivateAdmin,
  useUpdateAdminRole,
  useUpdateAdminUser,
  useDeleteAdminUser,
} from "@/lib/api/queries/admins";
import { useRbacMatrix, useRbacMe, type RbacRole } from "@/lib/api/queries/rbac";
import { toast } from "sonner";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { StatCard } from "@/components/common/StatCard";
import { DataTable } from "@/components/common/DataTable";
import { Card } from "@/components/common/Page";
import { Avatar } from "@/components/common/Avatar";
import {
  ErrorState,
  LoadingCards,
  LoadingRows,
  CenteredSpinner,
} from "@/components/common/AsyncStates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { fmtDate, relTime, initialsOf } from "@/lib/format";
import { auth } from "@/lib/auth";
import { Switch } from "@/components/ui/switch";
import type { AdminRole, AdminUserRow } from "@/lib/api/types";

export const Route = createFileRoute("/_app/admins")({ component: AdminUsersPage });

// Roles (labels, hints, the assignable list) come from the RBAC roles table so
// this page never drifts from Roles & Permissions — new roles like Validator or
// Content Moderator appear here automatically. This fallback only covers a brief
// pre-load flash so a raw key is never shown.
const FALLBACK_LABELS: Record<string, string> = {
  super_admin: "Administrator",
  operations_admin: "Manager",
  support_agent: "Helpdesk Operator",
  platform_owner: "Owner",
  kyc_validator: "Validator",
  content_moderator: "Content Moderator",
};
const roleLabelFrom = (roles: RbacRole[], key: string) =>
  roles.find((r) => r.key === key)?.label ?? FALLBACK_LABELS[key] ?? key;

function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [auditAdminId, setAuditAdminId] = useState<string | null>(null);
  const [deactivateId, setDeactivateId] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<AdminUserRow | null>(null);
  const dSearch = useDebouncedValue(search, 300);

  const { data, isLoading, isFetching, isError, error, refetch } = useAdminUsers(
    dSearch || undefined,
  );
  const roles = useRbacMatrix().data?.roles ?? [];
  const deactivateMutation = useDeactivateAdmin();
  const resetTotp = useResetAdminTotp();

  // Permission-based (not a rank number) — the backend's own guard on every
  // write route here (POST/PUT/DELETE /admin/users...) is
  // rbac.requirePermission('admins', 'edit'), which a super_admin always
  // passes but which is ALSO independently grantable to any other built-in
  // or custom role from Roles & Permissions (that's the entire point of the
  // granular matrix over the old rank ladder — see admin-extra.js's
  // ADMINS_EDIT comment). Gating this button on adminRank() >= 3 instead
  // checked a coarse, hardcoded rank (owner=0/support=1/operations=2/
  // super=3) that has no way to reflect such a grant: an admin could give a
  // role "Admin Users: Edit" in Roles & Permissions and the backend would
  // correctly accept their create/edit calls, but this page would still
  // hide the button because that role's rank isn't literally 3 — Add Admin
  // looking permanently broken for anyone but the literal super_admin role.
  const adminsLevel = useRbacMe().data?.permissions.admins ?? "none";
  const canManageAdmins = adminsLevel === "edit" || adminsLevel === "admin";
  const myEmail = auth.user().email;
  const kpi = data?.kpi;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      {isLoading && !data ? (
        <LoadingCards count={3} />
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total Admins" value={kpi?.total ?? 0} icon={IconUserShield} />
          <StatCard
            label="Active"
            value={kpi?.active ?? 0}
            icon={IconUserShield}
            className="border-green-200 bg-green-50"
          />
          <StatCard
            label="Inactive"
            value={kpi?.inactive ?? 0}
            icon={IconBan}
            className="border-muted"
          />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <IconSearch
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => refetch()}
          disabled={isFetching}
          title="Refresh"
        >
          <IconRefresh size={16} className={isFetching ? "animate-spin" : ""} />
        </Button>
        {canManageAdmins && (
          <Button size="sm" className="ml-auto" onClick={() => setCreateOpen(true)}>
            <IconPlus size={15} className="mr-1.5" /> Add Admin
          </Button>
        )}
      </div>

      {/* Table */}
      {isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading && !data ? (
        <LoadingRows cols={6} rows={8} />
      ) : (
        <DataTable
          columns={[
            {
              header: "Admin",
              accessor: (r) => (
                <div className="flex items-center gap-3">
                  <Avatar initials={initialsOf(r.full_name)} size={32} />
                  <div>
                    <div className="font-medium text-sm">{r.full_name}</div>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                  </div>
                </div>
              ),
            },
            {
              header: "Role",
              accessor: (r) => (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {roleLabelFrom(roles, r.role)}
                </span>
              ),
            },
            {
              header: "2FA",
              accessor: (r) => (
                <span
                  className={`text-xs font-medium ${r.totp_enabled ? "text-green-700" : "text-muted-foreground"}`}
                >
                  {r.totp_enabled ? "Enabled" : "Not set"}
                </span>
              ),
            },
            {
              header: "Status",
              accessor: (r) => (
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    r.is_active ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"
                  }`}
                >
                  {r.is_active ? "Active" : "Inactive"}
                </span>
              ),
            },
            {
              header: "Last Login",
              accessor: (r) => (r.last_login_at ? relTime(r.last_login_at) : "Never"),
            },
            { header: "Joined", accessor: (r) => fmtDate(r.created_at) },
            {
              header: "Actions",
              accessor: (r) =>
                canManageAdmins ? (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      title="Edit credentials, role & status"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditUser(r);
                      }}
                    >
                      <IconEdit size={14} className="mr-1.5" /> Edit
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      title="View audit log"
                      onClick={(e) => {
                        e.stopPropagation();
                        setAuditAdminId(r.id);
                      }}
                    >
                      <IconHistory size={15} />
                    </Button>
                  </div>
                ) : null,
            },
          ]}
          rows={data?.data ?? []}
        />
      )}

      {/* Create Admin dialog */}
      <CreateAdminDialog open={createOpen} onClose={() => setCreateOpen(false)} />

      {/* Audit Log drawer */}
      {auditAdminId && <AuditDrawer adminId={auditAdminId} onClose={() => setAuditAdminId(null)} />}

      {/* Deactivate confirm */}
      {deactivateId && (
        <Dialog open onOpenChange={() => setDeactivateId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Deactivate Admin</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              This admin will lose all access immediately. Are you sure?
            </p>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDeactivateId(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  deactivateMutation.mutate(deactivateId!, {
                    onSuccess: () => setDeactivateId(null),
                  });
                }}
                disabled={deactivateMutation.isPending}
              >
                Deactivate
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit user — one place for password, role and status */}
      {editUser && (
        <EditUserDialog
          user={editUser}
          roles={roles}
          onClose={() => setEditUser(null)}
          onResetTotp={() =>
            resetTotp.mutate(editUser.id, {
              onSuccess: () => toast.success("2FA reset — user re-enrolls at next login"),
            })
          }
        />
      )}
    </div>
  );
}

function EditUserDialog({
  user,
  roles,
  onClose,
  onResetTotp,
}: {
  user: AdminUserRow;
  roles: RbacRole[];
  onClose: () => void;
  onResetTotp: () => void;
}) {
  const [fullName, setFullName] = useState(user.full_name);
  const [email, setEmail] = useState(user.email);
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<string>(user.role);
  const [active, setActive] = useState<boolean>(user.is_active);
  const [staffPerk, setStaffPerk] = useState<boolean>(user.staff_perk_enabled);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const updateProfile = useUpdateAdminUser();
  const updateRole = useUpdateAdminRole();
  const resetPassword = useResetAdminPassword();
  const activate = useActivateAdmin();
  const deactivate = useDeactivateAdmin();
  const deleteUser = useDeleteAdminUser();
  const [saving, setSaving] = useState(false);

  const isSelf = auth.user().email?.toLowerCase() === user.email.toLowerCase();

  const save = async () => {
    setSaving(true);
    try {
      // Apply only what changed. Password: blank = keep current.
      const nameChanged = fullName.trim() && fullName.trim() !== user.full_name;
      const emailChanged = email.trim() && email.trim().toLowerCase() !== user.email.toLowerCase();
      const perkChanged = staffPerk !== user.staff_perk_enabled;
      if (nameChanged || emailChanged || perkChanged) {
        await updateProfile.mutateAsync({
          id: user.id,
          ...(nameChanged ? { full_name: fullName.trim() } : {}),
          ...(emailChanged ? { email: email.trim().toLowerCase() } : {}),
          ...(perkChanged ? { staff_perk_enabled: staffPerk } : {}),
        });
      }
      if (role !== user.role) {
        await updateRole.mutateAsync({ id: user.id, role: role as AdminRole });
      }
      if (active !== user.is_active) {
        await (active ? activate.mutateAsync(user.id) : deactivate.mutateAsync(user.id));
      }
      if (password.trim()) {
        if (password.trim().length < 6) {
          toast.error("Password must be at least 6 characters");
          setSaving(false);
          return;
        }
        await resetPassword.mutateAsync({ id: user.id, new_password: password.trim() });
      }
      toast.success("User updated");
      onClose();
    } catch (e: unknown) {
      toast.error((e as Error)?.message || "Couldn't save changes");
    } finally {
      setSaving(false);
    }
  };

  const doDelete = () => {
    deleteUser.mutate(user.id, {
      onSuccess: (res) => {
        toast.success(
          res?.deleted === false
            ? "User deactivated (had history, can't hard-delete)"
            : "User deleted",
        );
        onClose();
      },
      onError: (e: unknown) => toast.error((e as Error)?.message || "Couldn't delete user"),
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Full name (username)</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Email (login)</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@khyate.ae"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label>New password</Label>
            <Input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Leave blank to keep current"
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">
              Type a new password to change it now, or leave blank. Share it securely.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            {/* PUT /admin/users/:id/role requires the actor's literal role to
                be super_admin — unlike every other action in this dialog,
                this one isn't reachable via a custom "Admin Users: Edit"
                grant, so it's disabled rather than left to fail with a
                confusing 403 on save. */}
            <Select
              value={role}
              onValueChange={setRole}
              disabled={isSelf || !auth.isSuperAdmin()}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.key} value={r.key}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isSelf ? (
              <p className="text-xs text-muted-foreground">
                You can't change your own role — have another super admin do it.
              </p>
            ) : (
              !auth.isSuperAdmin() && (
                <p className="text-xs text-muted-foreground">
                  Only a super admin can change an admin's role.
                </p>
              )
            )}
          </div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
            <div>
              <div className="text-sm font-medium">Active</div>
              <div className="text-xs text-muted-foreground">
                {isSelf
                  ? "You can't deactivate your own account."
                  : "Inactive users can't sign in."}
              </div>
            </div>
            <Switch checked={active} onCheckedChange={setActive} disabled={isSelf} />
          </div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
            <div>
              <div className="text-sm font-medium">Staff customer perk</div>
              <div className="text-xs text-muted-foreground">
                Waives their delivery fee when shopping as a customer. Also requires the
                platform-wide switch under Settings → Platform → Staff perks.
              </div>
            </div>
            <Switch checked={staffPerk} onCheckedChange={setStaffPerk} />
          </div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
            <div>
              <div className="text-sm font-medium">Two-factor</div>
              <div className="text-xs text-muted-foreground">
                {user.totp_enabled ? "Enabled" : "Not set"} — reset if they lost their device.
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={onResetTotp}>
              <IconKey size={14} className="mr-1.5" /> Reset 2FA
            </Button>
          </div>

          {/* Danger zone — delete the account. Hidden for your own row. Deletion
              is a step past deactivation, not a shortcut around it — the account
              must already be deactivated (server-side, not just this dialog's
              unsaved `active` toggle) before it can be deleted. */}
          {!isSelf && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2.5">
              {!user.is_active ? (
                !confirmDelete ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-destructive">Delete user</div>
                      <div className="text-xs text-muted-foreground">
                        Permanently remove this admin account.
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive border-destructive/40"
                      onClick={() => setConfirmDelete(true)}
                    >
                      <IconTrash size={14} className="mr-1.5" /> Delete
                    </Button>
                  </div>
                ) : null
              ) : (
                <div>
                  <div className="text-sm font-medium text-destructive">Delete user</div>
                  <div className="text-xs text-muted-foreground">
                    Deactivate this account first — deletion is only available for
                    already-deactivated accounts.
                  </div>
                </div>
              )}
              {!user.is_active && confirmDelete && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-destructive">
                    Delete {user.full_name}?
                  </div>
                  <div className="text-xs text-muted-foreground">
                    This cannot be undone. If the account has history it will be deactivated
                    instead.
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                      Cancel
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={doDelete}
                      disabled={deleteUser.isPending}
                    >
                      {deleteUser.isPending ? "Deleting…" : "Yes, delete"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function copyTempPassword(password: string) {
  navigator.clipboard.writeText(password).then(
    () => toast.success("Password copied"),
    () => toast.error("Couldn't copy — select and copy manually"),
  );
}

function CreateAdminDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("support_agent");
  // Holds the just-created account's credentials so we can show them in an
  // in-app dialog instead of window.alert() — same native-popup cleanup
  // already applied to every other flow on this page (suspend/delete/etc).
  const [created, setCreated] = useState<{ email: string; password: string | null } | null>(null);
  const createMutation = useCreateAdmin();
  const allRoles = useRbacMatrix().data?.roles ?? [];
  // Mirrors POST /admin/users' own escalation check exactly (only a literal
  // super_admin may mint an owner or another super-admin) — without this
  // filter, a delegated admin (granted "Admin Users: Edit" without being
  // super_admin) could pick "Administrator"/"Owner" here and only find out
  // it's disallowed after submitting.
  const roles = auth.isSuperAdmin()
    ? allRoles
    : allRoles.filter((r) => r.key !== "super_admin" && r.key !== "platform_owner");
  const roleHint = roles.find((r) => r.key === role)?.description ?? "";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;
    createMutation.mutate(
      { full_name: name, email, role },
      {
        onSuccess: (res) => {
          const createdEmail = email.toLowerCase();
          setName("");
          setEmail("");
          setRole("support_agent");
          if (res?.temp_password) {
            // Surface the generated first-login password so the admin can share
            // it — otherwise the new teammate has no way to sign in. Shown here,
            // not closed via onClose(), until they've had a chance to copy it.
            setCreated({ email: createdEmail, password: res.temp_password });
          } else {
            toast.success("Admin created");
            onClose();
          }
        },
        onError: (err: unknown) => toast.error((err as Error)?.message || "Couldn't create admin"),
      },
    );
  };

  const closeAll = () => {
    setCreated(null);
    onClose();
  };

  if (created) {
    return (
      <Dialog open={open} onOpenChange={closeAll}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Admin account created</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Account created for{" "}
              <span className="font-medium text-foreground">{created.email}</span>. Share this
              temporary password with them securely — they should change it after signing in. It
              won't be shown again.
            </p>
            <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 font-mono text-sm">
              <span>{created.password}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => copyTempPassword(created.password!)}
              >
                <IconCopy size={14} className="mr-1.5" /> Copy
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" onClick={closeAll}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Admin</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sara Al-Mansouri"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sara@khyate.com"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AdminRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.key} value={r.key}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{roleHint}</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating…" : "Create Admin"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AuditDrawer({ adminId, onClose }: { adminId: string; onClose: () => void }) {
  const { data, isLoading } = useAdminAuditLog(adminId);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Audit Log</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <CenteredSpinner />
        ) : !data?.length ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No audit entries found.</p>
        ) : (
          <div className="space-y-0 divide-y">
            {data.map((entry) => (
              <div key={entry.id} className="py-3 flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{entry.action}</p>
                  <p className="text-xs text-muted-foreground">{entry.summary}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{fmtDate(entry.created_at)}</span>
                    {entry.ip_address && <span>IP: {entry.ip_address}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
