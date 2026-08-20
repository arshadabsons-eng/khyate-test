// Single source of truth for "which RBAC module governs this URL", shared by
// Sidebar.tsx (hides nav items the caller can't use) and _app.tsx's route
// guard (must ALSO block direct/bookmarked navigation to a denied page —
// hiding the link is not access control, and until this file existed nothing
// enforced an explicit matrix "none" grant outside the sidebar: a role with
// finance:'none' still saw real revenue/payout data by typing /finance
// directly, because the route guard only ever checked the coarse rank floor).
import { apiClient } from "./api/client";
import type { PermLevel } from "./api/queries/rbac";

export const PATH_MODULES: Array<[string, string]> = [
  ["/overview", "overview"],
  ["/tailors", "tailors"],
  ["/verification", "verification"],
  ["/kyc-review", "kyc_review"],
  ["/inventory", "inventory"],
  ["/customers", "customers"],
  ["/orders", "orders"],
  ["/disputes", "disputes"],
  ["/deliveries/controls", "settings"],
  ["/deliveries", "deliveries"],
  ["/messages", "messages"],
  ["/moderation", "moderation"],
  ["/reviews", "moderation"],
  ["/content-reports", "moderation"],
  ["/flagged-uploads", "moderation"],
  ["/finance", "finance"],
  ["/fee-outliers", "finance"],
  ["/revenue", "finance"],
  ["/payouts", "finance"],
  ["/promotions", "promotions"],
  ["/notifications", "notifications"],
  ["/audit", "audit"],
  ["/features", "features"],
  ["/settings", "settings"],
  ["/admins", "admins"],
  ["/roles", "roles"],
];

export function moduleForPath(pathname: string): string | undefined {
  return PATH_MODULES.find(([p]) => pathname === p || pathname.startsWith(p + "/"))?.[1];
}

// Rank floor these specific modules require at the ROUTE level (_app.tsx's
// RANK_REQUIRED table), on top of whatever the permission matrix grants.
// Custom roles are hard-capped at rank 1 by the backend (rbac.js POST
// /rbac/roles: "rank = Math.max(0, Math.min(1, ...))" — real access for a
// custom role comes only from the matrix, rank alone can't grant more than
// helpdesk-tier). That means a matrix grant on 'admins'/'roles' can NEVER
// take effect for any custom role, or for support_agent/operations_admin
// either (both are below rank 3) — and a grant on 'settings'/'features' can
// never take effect for support_agent or any custom role (below rank 2).
// _app.tsx's RANK_REQUIRED must stay in sync with this — imported there
// rather than duplicated, so the enforcement and this map can't drift apart.
// The Roles & Permissions matrix UI uses this to show those specific cells
// as inert instead of implying a grant there does something it can't.
export const MODULE_RANK_FLOOR: Record<string, number> = {
  admins: 3,
  roles: 3,
  settings: 2,
  features: 2,
  // Previously missing entirely — a super_admin granting a custom role
  // (hard-capped at rank 1 server-side) 'edit' on any of these four looked
  // like a normal, live, clickable matrix cell with no warning, but
  // _app.tsx's RANK_REQUIRED table separately hardcoded a rank-2 floor for
  // their routes, so the grant could never actually take effect — the
  // assigned user got silently bounced to /overview the moment they clicked
  // the (correctly-shown, since the sidebar trusts the matrix) nav item.
  finance: 2,
  inventory: 2,
  promotions: 2,
  notifications: 2,
};

let cache: { permissions: Record<string, PermLevel>; at: number } | null = null;
// Matches useRbacMe's existing staleTime (rbac.ts) — same data, same
// acceptable-staleness policy, so the sidebar and the route guard can never
// disagree about how fresh a permission grant needs to be.
const TTL_MS = 5 * 60 * 1000;

/** Fetches (or reuses a fresh cached copy of) the signed-in admin's own
 *  effective per-module permissions. Never throws — a network hiccup here
 *  should not lock an otherwise-authorized admin out of the app; the coarse
 *  rank check that already runs before this is the fallback line of defense
 *  when this can't be determined. Returns null on failure. */
export async function ensurePermissions(): Promise<Record<string, PermLevel> | null> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.permissions;
  try {
    const res = await apiClient.get<{ permissions: Record<string, PermLevel> }>("/rbac/me");
    cache = { permissions: res.permissions, at: Date.now() };
    return cache.permissions;
  } catch {
    return null;
  }
}

/** Call after any change that could affect the CURRENT admin's own effective
 *  permissions (e.g. saving the matrix in Roles & Permissions) so the next
 *  navigation re-checks fresh instead of trusting a stale cache for up to
 *  TTL_MS. */
export function invalidatePermissionsCache() {
  cache = null;
}
