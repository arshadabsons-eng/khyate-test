import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  IconLayoutDashboard,
  IconScissors,
  IconShieldCheck,
  IconUsers,
  IconShoppingBag,
  IconAlertTriangle,
  IconBox,
  IconCash,
  IconSparkles,
  IconBell,
  IconUserShield,
  IconSettings,
  IconFlag,
  IconMessages,
  IconClipboardList,
  IconReceipt,
  IconToggleLeft,
  IconChevronLeft,
  IconChevronDown,
  IconLock,
  IconChecklist,
  IconTruckDelivery,
  IconUsersGroup,
  type Icon,
} from "@tabler/icons-react";
import { BrandLockup, BrandMark } from "@/components/common/Logo";
import { auth } from "@/lib/auth";
import { useOpenDisputeCount } from "@/lib/api/queries/disputes";
import { useOpenReportCount } from "@/lib/api/queries/content-reports";
import { useRbacMe } from "@/lib/api/queries/rbac";

// min: lowest access rank that sees the item — support(1) < operations(2) < super(3).
// Platform owners (rank 0) get a separate one-item menu. Items are grouped into
// labelled, collapsible sections (same mechanism as TailorSidebar) so the menu
// stays short on laptop-height viewports instead of scrolling.
type NavItem = {
  to: string;
  label: string;
  icon: Icon;
  exact?: boolean;
  min: number;
  module?: string;
};
type NavGroup = { key: string; label: string; items: NavItem[] };

const DASHBOARD_ITEM: NavItem = {
  to: "/overview",
  label: "Overview",
  icon: IconLayoutDashboard,
  exact: true,
  min: 1,
  module: "overview",
};

const GROUPS: NavGroup[] = [
  {
    key: "marketplace",
    label: "Marketplace",
    items: [
      { to: "/tailors", label: "Tailors", icon: IconScissors, min: 1, module: "tailors" },
      {
        to: "/verification",
        label: "Verification",
        icon: IconShieldCheck,
        min: 1,
        module: "verification",
      },
      {
        to: "/kyc-review",
        label: "KYC Review Queue",
        icon: IconChecklist,
        min: 1,
        module: "kyc_review",
      },
      {
        to: "/validator-teams",
        label: "Validator Teams",
        icon: IconUsersGroup,
        min: 1,
        module: "kyc_review",
      },
      { to: "/inventory", label: "Catalog", icon: IconBox, min: 2, module: "inventory" },
    ],
  },
  {
    key: "customers_orders",
    label: "Customers & Orders",
    items: [
      { to: "/customers", label: "Customers", icon: IconUsers, min: 1, module: "customers" },
      { to: "/orders", label: "Orders", icon: IconShoppingBag, min: 1, module: "orders" },
      { to: "/disputes", label: "Disputes", icon: IconAlertTriangle, min: 1, module: "disputes" },
      {
        to: "/deliveries",
        label: "Deliveries",
        icon: IconTruckDelivery,
        min: 1,
        module: "deliveries",
      },
    ],
  },
  {
    key: "support",
    label: "Support",
    items: [
      { to: "/messages", label: "Support Inbox", icon: IconMessages, min: 1, module: "messages" },
      { to: "/moderation", label: "Moderation", icon: IconFlag, min: 1, module: "moderation" },
    ],
  },
  {
    key: "finance",
    label: "Finance",
    items: [
      { to: "/finance", label: "Finance", icon: IconCash, min: 2, module: "finance" },
      {
        to: "/fee-outliers",
        label: "Fee Review",
        icon: IconReceipt,
        min: 2,
        module: "finance",
      },
      { to: "/promotions", label: "Promotions", icon: IconSparkles, min: 2, module: "promotions" },
    ],
  },
  {
    key: "platform",
    label: "Platform",
    items: [
      {
        to: "/notifications",
        label: "Notifications",
        icon: IconBell,
        min: 2,
        module: "notifications",
      },
      { to: "/audit", label: "Audit Log", icon: IconClipboardList, min: 1, module: "audit" },
      {
        to: "/features",
        label: "Page Visibility",
        icon: IconToggleLeft,
        min: 2,
        module: "features",
      },
      { to: "/settings", label: "Settings", icon: IconSettings, min: 2, module: "settings" },
      { to: "/admins", label: "Admin Users", icon: IconUserShield, min: 3, module: "admins" },
      { to: "/roles", label: "Roles & Permissions", icon: IconLock, min: 3, module: "roles" },
    ],
  },
];

const ALL_FLAT_ITEMS = [DASHBOARD_ITEM, ...GROUPS.flatMap((g) => g.items)];

// Platform owners get a single read-only destination, nothing operational —
// no grouping needed for a one-item menu.
const OWNER_ITEM: NavItem = {
  to: "/owner",
  label: "Owner Dashboard",
  icon: IconLayoutDashboard,
  exact: true,
  min: 0,
};

function groupKeyFor(pathname: string): string | null {
  const g = GROUPS.find((g) => g.items.some((it) => pathname.startsWith(it.to)));
  return g?.key ?? null;
}

// Separate localStorage key from the tailor sidebar's ("kh.sidebar.groups") —
// an admin who also holds a tailor session in the same browser must not have
// one shell's open/closed state clobber the other's.
const STORAGE_KEY = "kh.sidebar.groups.admin";

function loadOpenGroups(pathname: string): Record<string, boolean> {
  const active = groupKeyFor(pathname);
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (active) saved[active] = true; // the active page's group is always visible
    return saved;
  } catch {
    const state: Record<string, boolean> = {};
    for (const g of GROUPS) state[g.key] = g.key === active;
    return state;
  }
}

export function Sidebar({
  open = false,
  onClose,
  collapsed = false,
  onToggleCollapse,
}: {
  open?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const { pathname } = useLocation();
  const rank = auth.adminRank();
  const isOwner = auth.isPlatformOwner();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    loadOpenGroups(pathname),
  );

  // Always reveal (never auto-close) the group holding the current page.
  useEffect(() => {
    const active = groupKeyFor(pathname);
    if (active) setOpenGroups((s) => (s[active] ? s : { ...s, [active]: true }));
  }, [pathname]);

  const toggleGroup = (key: string) => {
    setOpenGroups((s) => {
      const next = { ...s, [key]: !s[key] };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  // Live attention badges next to Disputes + Moderation (owners don't see them).
  const disputeCount = useOpenDisputeCount(!isOwner).data ?? 0;
  const reportCount = useOpenReportCount(!isOwner).data ?? 0;
  const badges: Record<string, number> = { "/disputes": disputeCount, "/moderation": reportCount };
  // Fine-grained per-module permissions drive visibility; the coarse rank is the
  // fallback (owner has its own menu, so we don't fetch it for them). While the
  // matrix is loading, `perms` is undefined and we fall back to rank alone.
  const perms = useRbacMe(!isOwner).data?.permissions;
  const canSee = (it: NavItem) => {
    // The super admin always sees every page — the per-module matrix can never
    // hide a nav item from the top administrator (prevents accidental lockout).
    if (auth.isSuperAdmin()) return true;
    // An explicit per-module grant wins over the coarse rank floor — a role
    // granted e.g. audit:'view' in Roles & Permissions must see that page even
    // if its rank alone wouldn't clear the item's `min` (the rank floor exists
    // as a sane default, not a ceiling the matrix can never override).
    if (perms && it.module && perms[it.module] !== undefined) return perms[it.module] !== "none";
    return rank >= it.min;
  };
  const isActive = (it: { to: string; exact?: boolean }) =>
    it.exact ? pathname === it.to : pathname.startsWith(it.to);

  const linkClass = (active: boolean) =>
    `kh-nav flex items-center gap-3 rounded-md text-sm transition-all duration-150 relative ${
      collapsed ? "justify-center px-0 py-2" : "px-3 py-2 lg:py-1.5"
    } ${active ? "bg-sidebar-accent font-medium kh-nav-active" : "hover:bg-sidebar-accent/60"}`;

  const badgeFor = (to: string) => {
    const count = badges[to] ?? 0;
    if (count <= 0) return null;
    return collapsed ? (
      <span
        className="absolute top-1 right-1.5 w-2 h-2 rounded-full bg-destructive"
        aria-hidden="true"
      />
    ) : (
      <span className="ml-auto min-w-[1.25rem] h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[11px] font-semibold leading-none">
        {count > 99 ? "99+" : count}
      </span>
    );
  };

  const renderLink = (it: NavItem) => {
    const Icon = it.icon;
    return (
      <Link
        key={it.to}
        to={it.to}
        onClick={onClose}
        title={collapsed ? it.label : undefined}
        className={linkClass(isActive(it))}
      >
        <Icon size={18} stroke={1.8} />
        {!collapsed && <span>{it.label}</span>}
        {badgeFor(it.to)}
      </Link>
    );
  };

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 bg-sidebar text-sidebar-foreground flex flex-col z-40 transition-[transform,width] duration-200 lg:translate-x-0 ${
          collapsed ? "w-[64px]" : "w-[220px]"
        } ${open ? "translate-x-0 w-[220px]" : "-translate-x-full"}`}
      >
        <div
          className={`pt-6 pb-4 border-b border-sidebar-border overflow-hidden ${collapsed ? "px-0 flex justify-center" : "px-5"}`}
        >
          {collapsed ? <BrandMark size={30} /> : <BrandLockup onColor markSize={30} />}
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {isOwner ? (
            renderLink(OWNER_ITEM)
          ) : collapsed ? (
            // Icon rail — no room for group labels, so just the flat item list
            // (mirrors TailorSidebar's collapsed behaviour).
            ALL_FLAT_ITEMS.filter(canSee).map(renderLink)
          ) : (
            <>
              {canSee(DASHBOARD_ITEM) && renderLink(DASHBOARD_ITEM)}
              {GROUPS.map((group) => {
                const items = group.items.filter(canSee);
                if (items.length === 0) return null;
                const isOpen = !!openGroups[group.key];
                const groupBadgeCount = items.reduce((n, it) => n + (badges[it.to] ?? 0), 0);
                return (
                  <div key={group.key} className="pt-1">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.key)}
                      className="w-full flex items-center gap-1.5 px-3 py-2 lg:py-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/60 hover:text-sidebar-foreground/90 transition-colors"
                    >
                      <span className="flex-1 text-left">{group.label}</span>
                      {/* If a badged item (e.g. open disputes) is hiding inside a
                          closed group, surface an aggregate dot so urgent work
                          stays discoverable without expanding every section. */}
                      {!isOpen && groupBadgeCount > 0 && (
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-destructive"
                          aria-hidden="true"
                        />
                      )}
                      <IconChevronDown
                        size={13}
                        stroke={2}
                        className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {isOpen && <div className="space-y-0.5">{items.map(renderLink)}</div>}
                  </div>
                );
              })}
            </>
          )}
        </nav>
        {/* Collapse toggle (desktop) */}
        <button
          type="button"
          onClick={onToggleCollapse}
          title={collapsed ? "Expand menu" : "Collapse menu"}
          className="hidden lg:flex items-center gap-2 border-t border-sidebar-border px-3 py-2.5 text-xs text-sidebar-foreground/70 hover:bg-sidebar-accent/60 transition-colors"
        >
          <IconChevronLeft
            size={18}
            stroke={1.8}
            className={`transition-transform ${collapsed ? "rotate-180" : ""}`}
          />
          {!collapsed && <span>Collapse</span>}
        </button>
      </aside>
    </>
  );
}
