import { Outlet, createFileRoute, redirect, useLocation } from "@tanstack/react-router";
import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { PageContainer } from "@/components/common/Page";
import { MaintenanceBanner } from "@/components/common/MaintenanceBanner";
import { TwoFactorGate } from "@/components/auth/TwoFactorGate";
import { auth } from "@/lib/auth";
import { ensurePermissions, moduleForPath, MODULE_RANK_FLOOR } from "@/lib/rbac-route-guard";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return;
    if (!auth.isAuthed()) {
      // Same "return to where I was" carry as client.ts's 401 handler —
      // an unauthenticated hand-typed/bookmarked URL used to always drop
      // the admin at a fixed role-based home after signing back in. No
      // typed search schema exists on /login (nor anywhere else in this
      // router), so this is read back via plain URLSearchParams in
      // login.tsx rather than TanStack's typed `search` prop.
      const back = location.pathname + location.search;
      const q = back && back !== "/" ? `?redirect=${encodeURIComponent(back)}` : "";
      throw redirect({ href: `/login${q}` });
    }
    // Only staff/admins use the admin shell — send everyone else to their area.
    if (auth.isTailor()) {
      throw redirect({ to: "/tailor" });
    }
    if (auth.isCustomer()) {
      throw redirect({ to: "/get-app" });
    }
    // Platform owners are confined to their read-only dashboard — any other
    // in-app URL (even hand-typed) bounces back to /owner. Once confirmed to
    // already be on /owner, stop here and return — never fall through to the
    // RANK_REQUIRED table below, whose "/owner" floor (4) is deliberately
    // above a platform owner's own rank (0, off the operational ladder).
    // Falling through used to redirect a platform owner to /overview —
    // whose own beforeLoad immediately bounced them right back to /owner.
    // An unbreakable redirect loop that locked every platform owner out of
    // the app entirely.
    if (auth.isPlatformOwner()) {
      if (location.pathname !== "/owner") throw redirect({ to: "/owner" });
      return;
    }
    // Defense in depth: operational/finance/admin pages reject a hand-typed URL
    // from a lower rank, not just hide it from the sidebar (support=1<ops=2<super=3).
    const RANK_REQUIRED: Array<[string, number]> = [
      // Reached only by non-platform-owners (platform owners already returned
      // above) — 4 is above every staff rank (support=1/ops=2/super=3), so no
      // authenticated staff account can load the owner dashboard shell by
      // hand-typing/bookmarking /owner, even though the real data is already
      // gated server-side.
      ["/owner", 4],
      ["/admins", MODULE_RANK_FLOOR.admins],
      ["/roles", MODULE_RANK_FLOOR.roles],
      // Every entry below is now derived from MODULE_RANK_FLOOR (single source
      // of truth shared with the Roles & Permissions matrix UI) instead of a
      // second hardcoded "2" — the two tables previously could, and did, drift
      // apart (see MODULE_RANK_FLOOR's own comment for the resulting bug).
      ["/finance", MODULE_RANK_FLOOR.finance],
      ["/revenue", MODULE_RANK_FLOOR.finance],
      ["/payouts", MODULE_RANK_FLOOR.finance],
      ["/inventory", MODULE_RANK_FLOOR.inventory],
      ["/categories", MODULE_RANK_FLOOR.inventory],
      // /reviews and /content-reports render the identical ReviewsPage /
      // ContentReportsPage as tabs inside the Moderation hub (nav min 1,
      // support_agent moderation default 'view') — a rank-2 floor here bounced
      // a support agent from a direct/bookmarked /reviews URL to /overview
      // even though the SAME screen was one click away inside /moderation.
      ["/promotions", MODULE_RANK_FLOOR.promotions],
      ["/notifications", MODULE_RANK_FLOOR.notifications],
      // Audit Log's real gate is the per-module RBAC matrix (audit:'view'/'none'),
      // enforced server-side on GET /admin/audit-logs — a rank floor here would
      // override an explicit matrix grant and reproduce the "always hidden" bug.
      ["/features", MODULE_RANK_FLOOR.features],
      ["/settings", MODULE_RANK_FLOOR.settings],
    ];
    const path = location.pathname;
    const needed = RANK_REQUIRED.find(([p]) => path === p || path.startsWith(p + "/"))?.[1] ?? 1;
    if (auth.adminRank() < needed) {
      throw redirect({ to: "/overview" });
    }
    // Defense in depth, part 2: the rank floor above only bounds by role
    // tier — it has no idea a specific role was explicitly denied a module
    // in the fine-grained permission matrix (role_permissions 'none'). Until
    // this check existed, that denial was enforced ONLY by Sidebar.tsx
    // hiding the nav link — a bookmarked or hand-typed URL still rendered
    // the real page with real data. /overview is exempt: a brand-new custom
    // role has no DEFAULTS entry, so every module including overview
    // defaults to 'none' — redirecting a denied /overview to itself would
    // infinite-loop. Every built-in role's DEFAULTS already guarantees at
    // least 'view' there, so it was always meant to be the one undeniable
    // landing page. Fails open on a network error: the rank check above is
    // already the first line of defense, this is defense in depth on top.
    if (path !== "/overview" && !path.startsWith("/overview/")) {
      const module = moduleForPath(path);
      if (module) {
        const permissions = await ensurePermissions();
        if (permissions && permissions[module] === "none") {
          throw redirect({ to: "/overview" });
        }
      }
    }
  },
  component: AppLayout,
});

function AppLayout() {
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("kh.sidebar.collapsed") === "1",
  );
  const { pathname } = useLocation();

  const toggleCollapse = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem("kh.sidebar.collapsed", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <TwoFactorGate>
      <div className="min-h-screen bg-background">
        <Sidebar
          open={drawer}
          onClose={() => setDrawer(false)}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
        />
        <div
          className={`flex flex-col min-h-screen transition-[margin] duration-200 ${collapsed ? "lg:ml-[64px]" : "lg:ml-[220px]"}`}
        >
          <Topbar onMenuClick={() => setDrawer(true)} />
          <main className="flex-1 py-5 sm:py-6 lg:py-8">
            {/* key on pathname triggers kh-page animation on every route change */}
            <PageContainer key={pathname} className="kh-page">
              <MaintenanceBanner />
              <Outlet />
            </PageContainer>
          </main>
        </div>
      </div>
    </TwoFactorGate>
  );
}
