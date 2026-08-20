// Auth module — real API-backed login.
// Role is set from the API response (not inferred from email).
// Falls back to email inference for demo/offline mode.
const KEY = "khyate.auth";
const EMAIL = "khyate.email";
const ROLE = "khyate.role";
const APIROLE = "khyate.apirole";
const RANK = "khyate.rank";
const NAME = "khyate.name";
const TOKEN = "khyate.token";

export type Role = "admin" | "tailor" | "customer";
/** The real backend role (admins have sub-roles). */
export type ApiRole =
  | "super_admin"
  | "operations_admin"
  | "support_agent"
  | "platform_owner"
  | "tailor"
  | "customer";
export type AuthUser = { name: string; email: string; role: string; type: Role };

const ADMIN_ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  operations_admin: "Operations Admin",
  support_agent: "Support Agent",
  platform_owner: "Platform Owner",
};

function apiRoleToLocal(apiRole: string): Role {
  if (apiRole === "tailor") return "tailor";
  if (apiRole === "customer") return "customer";
  return "admin";
}

export const auth = {
  isAuthed(): boolean {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(KEY) === "ok";
  },

  /** Called after a successful real API login — stores role from server response. */
  completeApiLogin(email: string, apiUser: { full_name: string; role: string; rank?: number }) {
    const role = apiRoleToLocal(apiUser.role);
    localStorage.setItem(KEY, "ok");
    localStorage.setItem(EMAIL, email);
    localStorage.setItem(ROLE, role);
    localStorage.setItem(APIROLE, apiUser.role || "support_agent");
    // The server looks this up from the roles table (built-in AND custom roles
    // both have a real rank there) — stored so adminRank() below doesn't have to
    // guess from a hardcoded list of role-name strings.
    if (apiUser.rank != null) localStorage.setItem(RANK, String(apiUser.rank));
    else localStorage.removeItem(RANK);
    localStorage.setItem(NAME, apiUser.full_name || email);
  },

  /** Re-stamp the role/rank from a live server response without a re-login.
   *  Both values were previously written ONCE at login and never refreshed, so
   *  they went stale in two directions that both showed up as "the UI is
   *  wrong": an admin whose role/rank was changed (or whose rank only became
   *  correct after the roles table was populated server-side) kept the old
   *  value until they happened to sign out, and a demoted admin kept seeing
   *  rank-gated actions their token would no longer be allowed to perform.
   *  useRbacMe() calls this on every load, so an open tab self-corrects. */
  syncFromServer(apiRole: string, rank?: number) {
    if (typeof window === "undefined") return;
    if (apiRole) {
      localStorage.setItem(APIROLE, apiRole);
      localStorage.setItem(ROLE, apiRoleToLocal(apiRole));
    }
    if (rank != null && Number.isFinite(rank)) localStorage.setItem(RANK, String(rank));
  },

  // completeDemoLogin()/startLogin()/completeLogin() were removed deliberately.
  // They set the authed flag and derived the role from the email string
  // (anything not containing "tailor"/"customer"/"shop" became "admin"), with
  // no server involvement at all. login.tsx called completeDemoLogin() from a
  // catch-all branch that fired on every non-401/400 response — including the
  // 429 the backend returns after five failed attempts — so failing login five
  // times rendered an admin shell. Authentication state must only ever come
  // from completeApiLogin() with a real server response; there is no offline
  // mode for signing in.

  logout() {
    // "khyate.user" is a raw JSON blob (full_name/role/rank) written directly by
    // login.tsx/signup.tsx/auth.callback.tsx (not through this module's own
    // constants) — it was missing from this list, so a signed-out session left
    // the previous user's name/role in plaintext localStorage indefinitely.
    [KEY, EMAIL, ROLE, APIROLE, RANK, NAME, TOKEN, "khyate.user"].forEach((k) =>
      localStorage.removeItem(k),
    );
  },

  token(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN);
  },

  type(): Role {
    if (typeof window === "undefined") return "admin";
    return (localStorage.getItem(ROLE) as Role) || "admin";
  },
  isAdmin(): boolean {
    return this.type() === "admin";
  },
  isTailor(): boolean {
    return this.type() === "tailor";
  },
  isCustomer(): boolean {
    return this.type() === "customer";
  },

  /** The real backend role — admins split into super_admin / operations_admin / support_agent. */
  adminRole(): ApiRole {
    if (typeof window === "undefined") return "super_admin";
    return (localStorage.getItem(APIROLE) as ApiRole) || "super_admin";
  },
  isSuperAdmin(): boolean {
    return this.adminRole() === "super_admin";
  },
  /** Operations admins + super admins can modify (the backend WRITE guard).
   *  Rank-based (not a literal role-string match) so a custom role provisioned
   *  with rank >= 2 via Roles & Permissions is correctly treated as a writer —
   *  matching how the backend's own WRITE guard (requireRole with a rank
   *  fallback) actually evaluates it. The old string check hid every write
   *  action (e.g. the Dispute detail Resolve/Close buttons) behind a
   *  read-only view for any role that wasn't literally "super_admin" or
   *  "operations_admin", even when the backend would have accepted the call. */
  canWrite(): boolean {
    return this.adminRank() >= 2;
  },
  isSupportAgent(): boolean {
    return this.adminRole() === "support_agent";
  },
  /** Read-only owner/investor — sees only the owner dashboard, no operational pages. */
  isPlatformOwner(): boolean {
    return this.adminRole() === "platform_owner";
  },
  /** Access rank used for role-based menus: owner=0 (off the ops ladder), support=1, operations=2, super=3.
   *  Read from the server-computed value stored at login (roles table — correct for
   *  BOTH built-in and custom roles). Falls back to the old hardcoded guess only for
   *  a session that logged in before this existed (self-heals on next login). */
  adminRank(): number {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(RANK);
      if (stored != null) {
        const n = parseInt(stored, 10);
        if (Number.isFinite(n)) return n;
      }
    }
    const r = this.adminRole();
    if (r === "platform_owner") return 0;
    return r === "super_admin" ? 3 : r === "operations_admin" ? 2 : 1;
  },

  homePath(): "/tailor" | "/overview" | "/get-app" | "/owner" {
    if (this.isTailor()) return "/tailor";
    // Customers use the mobile app — the web is admin + tailor only.
    if (this.isCustomer()) return "/get-app";
    // Platform owners get a tiny read-only dashboard, not the ops console.
    if (this.isPlatformOwner()) return "/owner";
    return "/overview";
  },

  user(): AuthUser {
    const email =
      (typeof window !== "undefined" && localStorage.getItem(EMAIL)) || "admin@khyate.ae";
    const stored = (typeof window !== "undefined" && localStorage.getItem(NAME)) || "";
    // Never allow an empty/undefined name — downstream code calls name.split(" ").
    const name = stored.trim() || email.split("@")[0] || "User";
    const type = this.type();
    const role =
      type === "tailor"
        ? "Tailor"
        : type === "customer"
          ? "Customer"
          : ADMIN_ROLE_LABEL[this.adminRole()] || "Admin";
    return { name, email, role, type };
  },
};
