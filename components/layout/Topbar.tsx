import { useLocation, useNavigate, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { IconBell, IconChevronDown, IconMenu2 } from "@tabler/icons-react";
import { useState } from "react";
import { auth } from "@/lib/auth";
import {
  useNotifications,
  useMarkNotificationRead,
  useAdminAlerts,
} from "@/lib/api/queries/notifications";
import { relTime } from "@/lib/format";

const titles: Record<string, string> = {
  "/": "Overview",
  "/overview": "Overview",
  "/tailors": "Tailor Management",
  "/verification": "Verification Queue",
  "/customers": "Customer Management",
  "/orders": "Order Management",
  "/disputes": "Dispute Management",
  "/inventory": "Inventory",
  "/categories": "Categories",
  "/reviews": "Reviews",
  "/revenue": "Revenue",
  "/payouts": "Payouts",
  "/promotions": "Promotions",
  "/notifications": "Notifications",
  "/admins": "Admin Users",
  "/settings": "Settings",
};

function getTitle(path: string) {
  const seg = "/" + (path.split("/")[1] || "");
  return titles[seg] || "Dashboard";
}

export function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [openN, setOpenN] = useState(false);
  const [openA, setOpenA] = useState(false);
  const user = auth.user();
  const { data: notif } = useNotifications();
  const items = notif?.data ?? [];
  const markRead = useMarkNotificationRead();
  const { data: alertsData } = useAdminAlerts();
  const alerts = alertsData?.alerts ?? [];
  // Real triage signals take priority over the unread-broadcast badge — a
  // platform_owner (no admin-alerts access) or an admin with zero alerts
  // falls back to the plain unread count, unchanged from before.
  const unread = (notif?.unread_count ?? 0) + (alertsData?.total ?? 0);

  const segs = pathname.split("/").filter(Boolean);
  const crumbs = [
    // Root crumb goes to the signed-in role's real home — "/" is the public
    // marketing landing, which only bounces an authed admin back here anyway.
    { label: "Dashboard", to: auth.homePath() },
    ...segs.map((s, i) => ({
      label: s.charAt(0).toUpperCase() + s.slice(1),
      to: "/" + segs.slice(0, i + 1).join("/"),
    })),
  ];

  return (
    <header className="sticky top-0 z-20 bg-background border-b pt-[env(safe-area-inset-top)]">
      <div className="h-16 px-4 sm:px-6 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onMenuClick}
            className="p-2 -ml-2 rounded-md hover:bg-muted lg:hidden"
            aria-label="Open menu"
          >
            <IconMenu2 size={20} />
          </button>
          <span className="text-lg sm:text-xl font-semibold truncate">{getTitle(pathname)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setOpenN((v) => !v);
                setOpenA(false);
              }}
              className="relative p-2 rounded-md hover:bg-muted"
              aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
            >
              <IconBell size={20} />
              {unread > 0 && (
                <span className="absolute top-1 right-1 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-semibold flex items-center justify-center px-1">
                  {unread}
                </span>
              )}
            </button>
            {openN && (
              <div className="fixed left-4 right-4 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80 sm:max-w-[calc(100vw-1rem)] bg-popover border rounded-lg shadow-lg overflow-hidden">
                <div className="px-4 py-3 border-b font-medium text-sm flex items-center justify-between">
                  <span>Notifications</span>
                  {unread > 0 && (
                    <span className="text-xs text-muted-foreground">{unread} unread</span>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {alerts.length > 0 && (
                    <div className="border-b">
                      {alerts.map((a) => (
                        <button
                          type="button"
                          key={a.key}
                          onClick={() => {
                            setOpenN(false);
                            navigate({ to: a.link as never });
                          }}
                          className="w-full text-left px-4 py-2.5 border-b last:border-b-0 hover:bg-muted flex items-center gap-2"
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              a.severity === "high"
                                ? "bg-destructive"
                                : a.severity === "medium"
                                  ? "bg-warning"
                                  : "bg-muted-foreground"
                            }`}
                          />
                          <span className="flex-1 text-sm truncate">{a.label}</span>
                          <span className="text-xs font-semibold text-muted-foreground">
                            {a.count}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {items.length === 0 && alerts.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                      No new notifications.
                    </div>
                  ) : (
                    items.slice(0, 5).map((n) => (
                      <button
                        type="button"
                        key={n.id}
                        onClick={() => {
                          if (!n.is_read) markRead.mutate(n.id);
                          setOpenN(false);
                          if (n.link) navigate({ to: n.link as never });
                        }}
                        className="w-full text-left px-4 py-3 border-b last:border-b-0 hover:bg-muted"
                      >
                        <div className="flex items-start gap-2">
                          {!n.is_read && (
                            <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{n.title}</div>
                            <div className="text-xs text-muted-foreground">
                              {relTime(n.created_at)}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
                <Link
                  to="/notifications"
                  className="block px-4 py-2 text-center text-sm text-primary hover:bg-muted border-t"
                  onClick={() => setOpenN(false)}
                >
                  View all
                </Link>
              </div>
            )}
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setOpenA((v) => !v);
                setOpenN(false);
              }}
              className="flex items-center gap-2 p-1.5 pr-3 rounded-md hover:bg-muted"
            >
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                {(user.name || "")
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")}
              </div>
              <span className="text-sm font-medium hidden sm:block">
                {(user.name || "").split(" ")[0]}
              </span>
              <IconChevronDown size={14} />
            </button>
            {openA && (
              <div className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-1rem)] bg-popover border rounded-lg shadow-lg overflow-hidden">
                <div className="px-4 py-3 border-b">
                  <div className="font-medium text-sm">{user.name}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                </div>
                <button
                  type="button"
                  className="w-full text-left px-4 py-2 text-sm hover:bg-muted"
                  onClick={() => {
                    setOpenA(false);
                    navigate({ to: "/settings" });
                  }}
                >
                  Profile
                </button>
                <button
                  type="button"
                  onClick={() => {
                    auth.logout();
                    // Sign-out is an in-SPA navigation, not a full page reload — the
                    // react-query cache (orders, customers, disputes, finance, etc.)
                    // otherwise survives in memory for whoever signs in next on this
                    // device/tab.
                    qc.clear();
                    navigate({ to: "/login" });
                  }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-muted text-destructive"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="px-4 sm:px-6 py-2 border-t text-xs text-muted-foreground hidden sm:flex items-center gap-1.5 overflow-x-auto whitespace-nowrap">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1.5 shrink-0">
            {i > 0 && <span>/</span>}
            {i === crumbs.length - 1 ? (
              <span className="text-foreground font-medium max-w-[160px] truncate inline-block align-bottom">
                {c.label}
              </span>
            ) : (
              <Link to={c.to} className="hover:text-primary">
                {c.label}
              </Link>
            )}
          </span>
        ))}
      </div>
    </header>
  );
}
