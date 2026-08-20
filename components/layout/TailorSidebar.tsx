import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  IconLayoutDashboard,
  IconShoppingBag,
  IconListDetails,
  IconBox,
  IconSparkles,
  IconCalendar,
  IconPhoto,
  IconCash,
  IconFileInvoice,
  IconReceipt,
  IconStar,
  IconCrown,
  IconRuler,
  IconSettings,
  IconShieldCheck,
  IconChevronLeft,
  IconChevronDown,
  IconGavel,
} from "@tabler/icons-react";
import type { TablerIcon } from "@tabler/icons-react";
import { BrandLockup, BrandMark } from "@/components/common/Logo";
import { useFeatureFlags } from "@/lib/api/queries/featureFlags";

type NavItem = {
  to: string;
  label: string;
  icon: TablerIcon;
  flag: string | null;
  exact?: boolean;
};
type NavGroup = { key: string; label: string; items: NavItem[] };

const DASHBOARD_ITEM: NavItem = {
  to: "/tailor",
  label: "Dashboard",
  icon: IconLayoutDashboard,
  exact: true,
  flag: null,
};

// Grouped into submenus (collapsible) so the always-visible list stays short — a flat
// 14-item list was tall enough to force the sidebar itself to scroll on short (laptop)
// viewports. Only the group containing the active page opens by default.
const GROUPS: NavGroup[] = [
  {
    key: "sales",
    label: "Sales",
    items: [
      { to: "/tailor/orders", label: "Orders", icon: IconShoppingBag, flag: null },
      { to: "/tailor/disputes", label: "Disputes", icon: IconGavel, flag: null },
      { to: "/tailor/listings", label: "Listings", icon: IconListDetails, flag: null },
      { to: "/tailor/materials", label: "Materials", icon: IconBox, flag: "tailor.materials" },
      {
        to: "/tailor/promotions",
        label: "Promotions",
        icon: IconSparkles,
        flag: "tailor.promotions",
      },
    ],
  },
  {
    key: "schedule",
    label: "Schedule",
    items: [
      {
        to: "/tailor/appointments",
        label: "Appointments",
        icon: IconCalendar,
        flag: "tailor.appointments",
      },
      {
        to: "/tailor/measurements",
        label: "Measurements",
        icon: IconRuler,
        flag: "tailor.measurements",
      },
    ],
  },
  {
    key: "storefront",
    label: "Storefront",
    items: [
      { to: "/tailor/portfolio", label: "Portfolio", icon: IconPhoto, flag: "tailor.portfolio" },
      { to: "/tailor/reviews", label: "Reviews", icon: IconStar, flag: null },
      { to: "/tailor/invoices", label: "Invoices", icon: IconFileInvoice, flag: null },
    ],
  },
  {
    key: "account",
    label: "Account",
    items: [
      { to: "/tailor/earnings", label: "Earnings", icon: IconCash, flag: "tailor.earnings" },
      { to: "/tailor/subscription", label: "Subscription", icon: IconCrown, flag: null },
      { to: "/tailor/documents", label: "Documents", icon: IconShieldCheck, flag: null },
      {
        to: "/tailor/invoice-preview",
        label: "Invoice Preview",
        icon: IconReceipt,
        flag: null,
      },
      // Settings was reachable only via the header user-menu — easy to miss,
      // and it now hosts the approval-gating account verification (email +
      // mobile), so it earns a first-class nav entry.
      { to: "/tailor/settings", label: "Settings", icon: IconSettings, flag: null },
    ],
  },
];

const ALL_FLAT_ITEMS = [DASHBOARD_ITEM, ...GROUPS.flatMap((g) => g.items)];

function groupKeyFor(pathname: string): string | null {
  const g = GROUPS.find((g) => g.items.some((it) => pathname.startsWith(it.to)));
  return g?.key ?? null;
}

function loadOpenGroups(pathname: string): Record<string, boolean> {
  const active = groupKeyFor(pathname);
  try {
    const saved = JSON.parse(localStorage.getItem("kh.sidebar.groups") || "{}");
    if (active) saved[active] = true; // the active page's group is always visible
    return saved;
  } catch {
    const state: Record<string, boolean> = {};
    for (const g of GROUPS) state[g.key] = g.key === active;
    return state;
  }
}

export function TailorSidebar({
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
  const flags = useFeatureFlags();
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
        localStorage.setItem("kh.sidebar.groups", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  // Build visible items: no flag = always show; flag = show only if enabled (default true while loading)
  const flagMap = new Map((flags.data ?? []).map((f) => [f.name, f.enabled_tailor]));
  const visible = (flag: string | null) => flag === null || (flagMap.get(flag) ?? true);
  const isActive = (it: { to: string; exact?: boolean }) =>
    it.exact ? pathname === it.to : pathname.startsWith(it.to);

  const linkClass = (active: boolean) =>
    `flex items-center gap-3 rounded-md text-sm transition-colors relative ${
      collapsed ? "justify-center px-0 py-2" : "px-3 py-2.5 lg:py-2"
    } ${
      active
        ? collapsed
          ? "bg-sidebar-accent font-medium"
          : "bg-sidebar-accent font-medium border-l-[3px] border-white pl-[9px]"
        : "hover:bg-sidebar-accent/60"
    }`;

  return (
    <>
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
          {collapsed ? (
            <BrandMark size={30} />
          ) : (
            <BrandLockup onColor markSize={30} subtitle="Tailor Workspace" />
          )}
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {collapsed ? (
            // Icon rail — no room for group labels, so just the flat item list.
            ALL_FLAT_ITEMS.filter((it) => visible(it.flag)).map((it) => {
              const Icon = it.icon;
              return (
                <Link
                  key={it.to}
                  to={it.to}
                  onClick={onClose}
                  title={it.label}
                  className={linkClass(isActive(it))}
                >
                  <Icon size={18} stroke={1.8} />
                </Link>
              );
            })
          ) : (
            <>
              <Link
                to={DASHBOARD_ITEM.to}
                onClick={onClose}
                className={linkClass(isActive(DASHBOARD_ITEM))}
              >
                <IconLayoutDashboard size={18} stroke={1.8} />
                <span>{DASHBOARD_ITEM.label}</span>
              </Link>
              {GROUPS.map((group) => {
                const items = group.items.filter((it) => visible(it.flag));
                if (items.length === 0) return null;
                const isOpen = !!openGroups[group.key];
                return (
                  <div key={group.key} className="pt-1">
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.key)}
                      className="w-full flex items-center justify-between px-3 py-2 lg:py-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/60 hover:text-sidebar-foreground/90 transition-colors"
                    >
                      {group.label}
                      <IconChevronDown
                        size={13}
                        stroke={2}
                        className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                    {isOpen && (
                      <div className="space-y-0.5">
                        {items.map((it) => {
                          const Icon = it.icon;
                          return (
                            <Link
                              key={it.to}
                              to={it.to}
                              onClick={onClose}
                              className={linkClass(isActive(it))}
                            >
                              <Icon size={18} stroke={1.8} />
                              <span>{it.label}</span>
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </nav>
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
