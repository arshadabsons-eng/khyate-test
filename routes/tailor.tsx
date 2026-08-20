import {
  Outlet,
  createFileRoute,
  redirect,
  useLocation,
  useNavigate,
  Link,
} from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  IconMenu2,
  IconChevronDown,
  IconLogout,
  IconUser,
  IconShieldLock,
  IconMail,
  IconBan,
} from "@tabler/icons-react";
import { TailorSidebar } from "@/components/layout/TailorSidebar";
import { PageContainer } from "@/components/common/Page";
import { MaintenanceBanner } from "@/components/common/MaintenanceBanner";
import { useTailorProfile, type TailorProfile } from "@/lib/api/queries/tailor";
import { useVerifyStatus } from "@/lib/api/queries/verify";
import { apiClient } from "@/lib/api/client";
import { auth } from "@/lib/auth";

export const Route = createFileRoute("/tailor")({
  beforeLoad: async ({ context, location }) => {
    if (typeof window === "undefined") return;
    if (!auth.isAuthed()) {
      throw redirect({ to: "/login" });
    }
    // Only tailors use the tailor workspace — send admins/customers to their area.
    if (!auth.isTailor()) {
      throw redirect({ to: auth.homePath() });
    }
    // Await tailor status before the dashboard shell ever mounts. Previously
    // this gate lived only in a useEffect below, which fires after
    // useTailorProfile() resolves client-side — so a freshly-registered
    // (pending) tailor briefly rendered the full operational dashboard
    // (and its own summary/earnings/orders queries) before the bounce to
    // /tailor/documents. Only fetched when landing on the dashboard route
    // itself, matching the effect's own redirect condition below. Uses the
    // same query key/fn as useTailorProfile() so the component's later call
    // reuses this cached fetch instead of refetching.
    if (location.pathname === "/tailor") {
      let status: string | undefined;
      try {
        const profile = await context.queryClient.ensureQueryData({
          queryKey: ["tailor", "profile"],
          queryFn: () => apiClient.get<TailorProfile>("/tailors/me"),
        });
        status = profile?.status;
      } catch {
        // Network hiccup / transient error — fail open, same as before; the
        // in-layout effect/banner still catch this once the profile query
        // resolves client-side.
      }
      const notVerified = !!status && status !== "active" && status !== "suspended";
      if (notVerified) {
        throw redirect({ to: "/tailor/documents" });
      }
    }
  },
  component: TailorLayout,
});

const TITLES: Record<string, string> = {
  tailor: "Dashboard",
  orders: "Orders",
  disputes: "Disputes",
  listings: "Listings",
  materials: "Materials",
  promotions: "Promotions",
  appointments: "Appointments",
  measurements: "Measurements",
  portfolio: "Portfolio",
  earnings: "Earnings & Payouts",
  invoices: "Invoices",
  "invoice-preview": "Invoice Preview",
  reviews: "Reviews",
  subscription: "Subscription",
  documents: "Documents",
  settings: "Settings",
};

function TailorLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem("kh.sidebar.collapsed") === "1",
  );
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
  const [userOpen, setUserOpen] = useState(false);
  const segs = pathname.split("/").filter(Boolean);
  const last = segs[1] ?? "tailor";
  const title = TITLES[last] ?? "Dashboard";
  const user = auth.user();
  const initials = (user.name || "")
    .split(" ")
    .map((p: string) => p[0])
    .slice(0, 2)
    .join("");

  // Onboarding gate: an unverified tailor is nudged to the verification flow once,
  // and sees a persistent banner until approved (never hard-trapped → no loops).
  // 'suspended' is deliberately excluded from this bucket — a suspended tailor
  // isn't mid-onboarding, so shoving them at "complete verification" would be
  // both wrong and unhelpful. They get their own banner below instead.
  const profile = useTailorProfile();
  const status = profile.data?.status;
  const isSuspended = status === "suspended";
  // A query error (expired-token race, transient network blip) must NOT be
  // treated the same as "verified" — that would land a possibly-pending tailor
  // on the plain dashboard with zero indication anything is required. Fold an
  // error into the same "needs attention" bucket as any other non-active status.
  const notVerified =
    profile.isError || (!!status && status !== "active" && status !== "suspended");
  const onOnboarding = pathname.startsWith("/tailor/documents");
  useEffect(() => {
    if (notVerified && pathname === "/tailor") navigate({ to: "/tailor/documents" });
  }, [notVerified, pathname, navigate]);

  // Email verification is required to start receiving orders (isComplete() in
  // lib/kyc.js), but never blocks logging in or using the app — this used to
  // be a full-screen gate (TailorVerifyGate) that replaced the entire app
  // until BOTH email and phone were verified, trapping an otherwise-active
  // tailor who simply hadn't gotten to it yet. Same non-blocking nudge
  // pattern as the KYC banner above; the actual verify flow lives in
  // Settings. Phone stays optional here — only email is required right now.
  const verify = useVerifyStatus();
  const emailUnverified = !!verify.data && !verify.data.email_verified;
  const onSettings = pathname === "/tailor/settings";

  return (
    <>
      <div className="min-h-screen bg-background">
        <TailorSidebar
          open={drawer}
          onClose={() => setDrawer(false)}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapse}
        />
        <div
          className={`flex flex-col min-h-screen transition-[margin] duration-200 ${collapsed ? "lg:ml-[64px]" : "lg:ml-[220px]"}`}
        >
          <header className="sticky top-0 z-20 bg-background border-b">
            <div className="h-16 px-4 sm:px-6 flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => setDrawer(true)}
                  className="p-2 -ml-2 rounded-md hover:bg-muted lg:hidden"
                  aria-label="Open menu"
                >
                  <IconMenu2 size={20} />
                </button>
                <h1 className="text-lg sm:text-xl font-semibold truncate">{title}</h1>
              </div>

              {/* Top-right user menu */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserOpen((v) => !v)}
                  className="flex items-center gap-2 p-1.5 pr-3 rounded-md hover:bg-muted"
                >
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold shrink-0">
                    {initials}
                  </div>
                  <span className="text-sm font-medium hidden sm:block">
                    {(user.name || "").split(" ")[0]}
                  </span>
                  <IconChevronDown size={14} className="text-muted-foreground" />
                </button>

                {userOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setUserOpen(false)} />
                    <div className="absolute right-0 mt-2 w-56 bg-popover border rounded-lg shadow-lg overflow-hidden z-20">
                      <div className="px-4 py-3 border-b">
                        <div className="font-medium text-sm">{user.name}</div>
                        <div className="text-xs text-muted-foreground">{user.email}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Tailor Workspace</div>
                      </div>
                      <button
                        type="button"
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex items-center gap-2"
                        onClick={() => {
                          setUserOpen(false);
                          navigate({ to: "/tailor/settings" });
                        }}
                      >
                        <IconUser size={15} className="text-muted-foreground" /> Profile & Settings
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          auth.logout();
                          // In-SPA navigation below — clear the cache so a coworker
                          // signing in on this device doesn't see this tailor's data.
                          qc.clear();
                          navigate({ to: "/login" });
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted text-destructive flex items-center gap-2 border-t"
                      >
                        <IconLogout size={15} /> Sign out
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>
          <main className="kh-threads flex-1 py-5 sm:py-6 lg:py-8">
            <PageContainer key={pathname} className="kh-page">
              <MaintenanceBanner />
              {isSuspended && !onSettings && (
                <div className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive p-3.5 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <IconBan size={18} className="shrink-0" />
                  <span className="text-sm flex-1">
                    Your account has been suspended and you can&apos;t take new orders right now. If
                    you believe this is a mistake, contact Khyate support and we&apos;ll review it.
                  </span>
                  <Link to="/tailor/settings" className="text-sm font-medium underline shrink-0">
                    Contact support
                  </Link>
                </div>
              )}
              {notVerified && !onOnboarding && (
                <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 p-3.5 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <IconShieldLock size={18} className="shrink-0" />
                  <span className="text-sm flex-1">
                    {status === "rejected"
                      ? "Some of your verification documents need attention."
                      : "Your tailor isn't verified yet — complete verification to start taking orders."}
                  </span>
                  <Link to="/tailor/documents" className="text-sm font-medium underline shrink-0">
                    Complete verification
                  </Link>
                </div>
              )}
              {emailUnverified && !onSettings && (
                <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 p-3.5 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <IconMail size={18} className="shrink-0" />
                  <span className="text-sm flex-1">
                    Verify your email to start receiving orders.
                  </span>
                  <Link to="/tailor/settings" className="text-sm font-medium underline shrink-0">
                    Verify email
                  </Link>
                </div>
              )}
              <Outlet />
            </PageContainer>
          </main>
        </div>
      </div>
    </>
  );
}
