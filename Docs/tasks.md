# Khyate — Master Task List

End-to-end build plan for the Khyate platform: Admin Dashboard (this repo), Tailor Dashboard, Customer Web (Next.js), and Customer Mobile (Flutter), plus shared backend, packages, and infrastructure. Phases are roughly sequential — tasks within a phase can run in parallel.

**Brand:** Primary green `#2D7A2D` · Light surface `#E8F5E9` · Dark `#1B5E20` · White backgrounds · Tabler icons · AED currency · RTL support for Arabic.

**Stack:** React + TypeScript + Vite + Tailwind v4 + shadcn/ui + Recharts + TanStack Table + TanStack Query + TanStack Start (admin & tailor web). Next.js 14 App Router (customer web). Flutter (mobile). Supabase Postgres + Edge Functions + Realtime + Auth. Cloudflare R2 + Workers. Stripe Connect. Upstash Redis.

---

## Phase 0 — Repo Conventions & Tooling

- [ ] Adopt Turborepo monorepo at root with `apps/admin`, `apps/tailor-web`, `apps/customer-web`, `apps/mobile`, `packages/ui`, `packages/api`, `packages/types`, `packages/schemas`, `packages/utils`.
- [ ] Configure `pnpm` (or `bun`) workspaces; one shared `tsconfig.base.json` and one shared `eslint.config.js`.
- [ ] Add Prettier, lint-staged, husky pre-commit running `eslint --fix` + `prettier --write` on staged files.
- [ ] CI: GitHub Actions running `lint`, `type-check`, `build`, `test` on every PR; required for merge to `main`.
- [ ] Branch protection on `main`: require 1 review + green CI.
- [ ] Conventional Commits enforced via commitlint.
- [ ] Each app's `package.json` declares scripts: `dev`, `build`, `lint`, `type-check`, `test`.
- [ ] Environment variables validated at startup with Zod in each app.

---

## Phase 1 — Infrastructure Setup

- [ ] Create Supabase project (staging + production), enable extensions: `uuid-ossp`, `pgcrypto`, `pg_trgm`.
- [ ] Create Cloudflare R2 bucket, private access, CORS configured for app domains only.
- [ ] Create Upstash Redis instance per environment.
- [ ] Create Stripe account, enable Stripe Connect (Express accounts).
- [ ] Create Vercel projects: `khyate-admin`, `khyate-tailor`, `khyate-customer`. Wire env vars.
- [ ] Configure Cloudflare DNS as authoritative for `khyate.com`, `admin.khyate.com`, `tailor.khyate.com`. Add WAF in front of Vercel.
- [ ] Sentry projects per app.
- [ ] PostHog (or similar) for product analytics.
- [ ] Uptime monitoring on all public URLs and critical Edge Functions.
- [ ] Daily Supabase PITR backup verification job.

---

## Phase 2 — Database Schema

### Enums

- [ ] `user_role`, `verification_status`, `order_type`, `order_status`, `payment_status`, `dispute_type`, `dispute_status`, `resolution_action`, `listing_type`, `listing_status`, `payout_status`, `notification_type`, `notification_channel`, `billing_cycle`, `evidence_type`, `review_type`, `material_type`, `quality_tier`, `gender_target`, `material_property`, `placement_type`, `discount_type`, `body_group`.

### Tables

- [ ] `countries`, `cities`, `profiles`, `admin_profiles`, `tailor_profiles`, `customer_profiles`, `customer_addresses`, `customer_flags`.
- [ ] `verification_documents`, `subscription_tiers`, `tailor_subscriptions`, `commission_overrides`.
- [ ] `categories` (3-level hierarchy with `parent_id`).
- [ ] `materials`, `material_colors`, `material_properties`, `size_guides`, `sizes`, `measurement_fields`, `measurement_profiles`.
- [ ] `listings`, `listing_variants`, `listing_materials`, `saved_listings`.
- [ ] `orders` with `order_number` sequence + `KHY-YYYY-NNNNN` trigger.
- [ ] `order_items` with `item_snapshot jsonb`.
- [ ] `order_status_history` (append-only), `order_progress_updates`, `order_messages`.
- [ ] `payments`, `refunds`, `tailor_payouts`, `tailor_balances` with triggers, `stripe_accounts`.
- [ ] `disputes`, `dispute_evidence`, `dispute_messages`, `dispute_status_history` (append-only).
- [ ] `reviews`, `review_flags`, `review_responses`.
- [ ] `promoted_listings`, `discount_codes`, `discount_code_uses`.
- [ ] `notifications`, `notification_preferences`.
- [ ] `audit_logs` (insert-only), `admin_sessions`.

### Triggers / Views

- [ ] `updated_at` auto-trigger applied to every table.
- [ ] Order status transition trigger writes `order_status_history`.
- [ ] Order completion trigger updates `tailor_balances.available_fils` and `pending_fils`.
- [ ] Payout processed trigger deducts from `tailor_balances`.
- [ ] Refund insert trigger reverses commission proportionally on `tailor_balances`.
- [ ] Review insert/update/visibility-change trigger recalculates `tailor_profiles.rating_avg`/`rating_count`.
- [ ] `orders_view` strips `commission_fils` for non-super-admin/operations-admin readers.
- [ ] Materialized views: `tailor_stats_mv`, `customer_stats_mv` refreshed every 5 min via pg_cron.

### Indexes

- [ ] `idx_materials_type`, `idx_materials_tier`, `idx_materials_gender`, `idx_materials_active`, `idx_materials_fulltext` (GIN), `idx_material_colors_material`, `idx_material_properties_material`.
- [ ] `idx_categories_parent`, `idx_categories_gender`.
- [ ] `idx_sizes_sort`, `idx_measurement_fields_order`.
- [ ] `idx_orders_tailor_status`, `idx_orders_customer_status`, `idx_orders_created_at`.
- [ ] `idx_listings_fulltext` (GIN), `idx_listings_tailor_status`, `idx_listings_category_status`.
- [ ] `idx_disputes_sla_open`, `idx_disputes_assigned_to`.
- [ ] `idx_tailor_profiles_city_verified`, `idx_notifications_recipient_unread`.
- [ ] `idx_audit_logs_actor`, `idx_audit_logs_entity`.

### Seed data

- [ ] UAE country, cities (Abu Dhabi, Dubai, Sharjah, Ajman, Ras Al Khaimah, Fujairah, Umm Al Quwain).
- [ ] Default subscription tiers: Basic (free), Professional, Premium with prices, commission rates, limits.
- [ ] Root categories: Female (Traditional, Formal, Casual), Male (Traditional, Formal, Casual), Unisex (Sportswear, Workwear) — populate per `Inventory.txt`.
- [ ] Default standard sizes (XS–XXXL) and measurement fields per body group.

---

## Phase 3 — Row-Level Security

- [ ] Enable RLS on every table.
- [ ] `profiles`: select/update own; admins all; service role unrestricted.
- [ ] `tailor_profiles`: tailors update own; customers select where `is_verified=true AND deleted_at IS NULL`; admins all.
- [ ] `customer_profiles`: customers select/update own; admins all.
- [ ] `listings`: tailors CRUD own; public select where `status='active' AND deleted_at IS NULL`; admins all.
- [ ] `orders`: customers select own; tailors select where `tailor_id=auth.uid()`; both via `orders_view` to hide `commission_fils`; admins all.
- [ ] `order_messages`: parties + admins only.
- [ ] `disputes` / `dispute_messages`: parties + admins; `is_internal=true` rows admin-only.
- [ ] `reviews`: select where `is_visible=true`; reviewer update own within 24h; admins update all.
- [ ] `audit_logs`: insert via service role only; admin select only; nobody update or delete.
- [ ] `tailor_balances`: tailors select own; admins select all; writes via trigger only.
- [ ] `materials` / `material_colors` / `material_properties`: admins write; tailors and customers read active non-deleted.
- [ ] Verify Realtime publications respect RLS — subscriptions only deliver authorized rows.
- [ ] Write integration tests per policy with separate role-scoped Supabase clients.

---

## Phase 4 — Shared Packages

### packages/types

- [ ] TS interfaces matching every table; monetary fields typed `number` (fils); enums mirrored as TS enums.

### packages/schemas

- [ ] Zod schemas for every API request body. Inferred TS types exported.
- [ ] Zod schemas for every app's environment variables, validated at startup.

### packages/api

- [ ] Supabase client factory (browser + SSR variants).
- [ ] Typed query functions per entity; TanStack Query hooks wrapping each.
- [ ] Typed Edge-Function client with request/response types.
- [ ] 401 refresh interceptor; 403 `ip_not_allowed` redirect handler.

### packages/utils

- [ ] `filsToDisplay(fils, currency='AED')` and `displayToFils(display)` — integer math only.
- [ ] `calculateCommission(subtotal_fils, rate_pct)` — integer math, banker's rounding.
- [ ] `getOrderNextStatuses(currentStatus, actorRole)` — allowed transitions.
- [ ] `formatOrderNumber`, `formatDate`, `formatRelativeTime` (en + ar locales).
- [ ] `rtlClass(locale)` returns `'rtl' | 'ltr'`.

### packages/ui

- [ ] Tailwind config with design tokens: `--khyate-green: #2D7A2D`, `--khyate-green-light: #E8F5E9`, `--khyate-green-dark: #1B5E20`.
- [ ] Components: `Button` (primary/secondary/ghost/danger + loading + disabled), `Input` (text/password show-hide/phone-with-prefix), `Select`, `Textarea`, `Checkbox`, `RadioGroup`, `Switch`, `Badge`, `Avatar`, `Modal`, `Drawer` (right + bottom), `DropdownMenu`, `DataTable` (TanStack Table wrapper), `StatCard`, `Toast`, `Tabs`, `EmptyState`, `LoadingSpinner`, `SkeletonLoader`, `ConfirmDialog`, `FileUploader` (signed-URL flow), `ImageGallery` (lightbox), `RatingStars`, `StatusTimeline`, `SLATimer`, `RTLAware` layout helpers.

---

## Phase 5 — Backend Edge Functions

### Auth

- [ ] `POST /auth/admin-login` — email/password, IP allowlist, issues short-lived `pre_totp_token`.
- [ ] `POST /auth/verify-totp` — TOTP verify, issues access JWT + refresh cookie.
- [ ] `POST /auth/send-otp` (phone) — Supabase OTP, Redis rate limit 3/hr/phone.
- [ ] `POST /auth/verify-otp` — verify, create profile if new.
- [ ] `POST /auth/refresh` — token rotation with reuse detection in Redis.
- [ ] `POST /auth/logout` — invalidate session.
- [ ] `POST /auth/forgot-password` — reset token email.

### Uploads

- [ ] `POST /uploads/sign` — validate type (jpeg/png/webp/pdf), size (≤10MB), user quota, return R2 signed URL.
- [ ] `POST /uploads/confirm` — virus scan via ClamAV cloud; on fail delete and 400.

### Tailors / Verification

- [ ] `GET /tailors`, `GET /tailors/:id`, `GET /tailors/:id/public`, `GET /tailors/search`.
- [ ] `POST /tailors/profile`, `POST /tailors/documents`, `GET /tailors/:id/orders|listings|reviews|earnings|documents|activity`.
- [ ] `POST /tailors/:id/verify`, `/suspend`, `/reinstate`, `/change-tier`, `/commission-override`, `/message`.
- [ ] `POST /tailors/bulk`, `GET /tailors/export`.
- [ ] `GET /verification/queue`, `GET /verification/:id`, `POST /verification/:id/claim|approve|reject`, `POST /verification/documents/:doc_id/approve|reject`.

### Customers

- [ ] `GET /customers`, `GET /customers/:id`, `GET /customers/:id/orders|disputes|reviews|payment-methods|activity`.
- [ ] `POST /customers/:id/suspend|reinstate|flag|unflag|reveal-phone`.

### Inventory

- [ ] Materials: `GET/POST/PUT/DELETE /inventory/materials`, `POST /inventory/materials/:id/duplicate|images`, `POST /inventory/materials/bulk`.
- [ ] Categories: `GET/POST/PUT/DELETE /inventory/categories`, `POST /inventory/categories/reorder`.
- [ ] Plans: `GET /inventory/plans`, `PUT /inventory/plans/:id`, `GET /inventory/plans/analytics`.
- [ ] Sizes / Measurement fields: `GET/POST/PUT /inventory/sizes`, `POST /inventory/sizes/reorder`, `GET/PUT /inventory/measurement-fields`, `POST /inventory/size-guides`.

### Listings

- [ ] `POST/PUT/DELETE /listings`, `POST /listings/:id/approve|reject|feature`.

### Orders

- [ ] `POST /orders` (full payment intent), `POST /orders/custom` (40% deposit + manual capture).
- [ ] `POST /orders/:id/confirm-payment` (Stripe webhook).
- [ ] `POST /orders/:id/accept|decline|status|progress|deliver|complete|cancel`.
- [ ] `POST /orders/:id/refund|force-cancel|escalate|admin-note|mark-delivered`.
- [ ] `GET /orders`, `GET /orders/:id`, `GET /orders/:id/messages`, `POST /orders/:id/messages`.

### Disputes

- [ ] `POST /disputes`, `GET /disputes`, `GET /disputes/:id`, `GET /disputes/queue`, `GET /disputes/analytics`.
- [ ] `POST /disputes/:id/claim|assign|evidence|respond|message|resolve|escalate`.

### Reviews

- [ ] `POST /reviews`, `GET /reviews`, `GET /reviews/:id`, `GET /reviews/analytics`.
- [ ] `PUT /reviews/:id`, `POST /reviews/:id/flag|unflag|moderate|respond`.

### Payments / Payouts / Stripe Connect

- [ ] `POST /webhooks/stripe` — signature validation, route every event type.
- [ ] `POST /payouts/process|process-single/:id|retry/:id`, `GET /payouts/queue|history|failed|schedule`, `PUT /payouts/schedule`.
- [ ] `POST /stripe/connect/onboard`, `GET /stripe/connect/status`.

### Notifications

- [ ] `POST /notifications/send` (internal), `POST /notifications/broadcast/preview|send`, `POST /notifications/:id/read`, `GET /notifications`.
- [ ] `GET /messages/threads`, `GET /messages/threads/:id`, `POST /messages/threads/:id/reply|assign|close`.

### Promotions

- [ ] `GET/POST/DELETE /promotions/featured`, `GET /promotions/performance`.
- [ ] `GET/POST/PUT /discount-codes`, `POST /discount-codes/:id/deactivate`, `GET /discount-codes/analytics`.

### Analytics / Revenue

- [ ] `GET /analytics/overview` (Redis cache 5 min), `GET /analytics/revenue`, `GET /analytics/forecast`, `GET /analytics/top-tailors`, `GET /analytics/order-type-breakdown`, `GET /analytics/disputes`.
- [ ] `GET /revenue/summary|breakdown`, `GET/PUT /commission-config[/global|/tier/:id]`, `POST/DELETE /commission-config/override`, `POST /revenue/export`.

### Admin Users

- [ ] `GET/POST/PUT /admin/users`, `POST /admin/users/:id/deactivate|reset-2fa|reset-password`, `GET /admin/users/:id/audit`, `GET /admin/audit-logs`.

### Settings

- [ ] `GET/PUT /settings/platform|onboarding|policies|security|integrations`.
- [ ] `POST /settings/integrations/:provider/test`, `GET /settings/webhooks`, `POST /settings/webhooks/:id/regenerate-secret`.

---

## Phase 6 — Admin Dashboard (this repo)

Routes per `Docs/*` pages. Use TanStack Start + TanStack Router file-based routes; protected `_app` layout; `/login` and `/verify` outside the layout.

- [x] **Layout** — `Sidebar` (Khyate branding, 220px, brand-green background, white left-border accent on active item), `Topbar` (page title from route, notification bell with unread badge + dropdown, admin avatar dropdown), breadcrumb under topbar. *(Collapsing to icons below 1280px: pending)*
- [x] **`/login` & `/verify`** — Login form + 6-digit TOTP input, auth guard on all `_app` routes. *(Real JWT / httpOnly cookie flow pending backend)*
- [x] **`/overview`** — 8 KPI cards, revenue chart (day/week/month/year toggle + dashed forecast segment), orders-by-type donut, top-tailors list, Realtime activity feed, 90-day forecast section.
- [x] **`/tailors`** — Server-paginated table, slide-out filters, bulk toolbar (export CSV, bulk activate/deactivate, change tier), KPI strip, verification banner.
- [x] **`/tailors/:id`** — per `TailorDetail.txt`. Seven tabs (Overview, Orders, Listings, Reviews, Earnings, Documents, Activity Log). All tabs wired to API hooks; Documents tab has per-document approve/reject UI.
- [x] **`/verification`** — Two-panel layout, claim semantics, document-level approve/reject, tailor-level approve/reject mutations wired.
- [x] **`/customers`** — Server-paginated table, KPI strip (total/active/suspended/flagged/new-this-month), masked names, search + status + sort filters, export CSV button.
- [x] **`/customers/:id`** — Five tabs: Overview (profile, stats, addresses), Orders, Disputes, Reviews, Activity Log. Suspend/reinstate/flag/unflag/reveal-phone actions wired.
- [x] **`/orders`** — Status tabs as primary nav, auto-refresh every 60 s on Pending/In-Progress, color-coded statuses, KPI by status.
- [x] **`/orders/:id`** — Status timeline, items + custom-stitch specs, payment breakdown, admin notes auto-save, action panel (refund / force cancel / escalate / mark delivered).
- [x] **`/disputes`** — SLA timer column with color thresholds, 30-second auto-refresh, analytics KPI strip.
- [x] **`/disputes/:id`** — Two-column evidence, message thread with internal-note toggle, resolution panel with action enum, claim/assign flow.
- [x] **`/inventory`** — Four-tab system (Materials / Categories / Tailor Plans / Size Management). Tab state in URL.
- [ ] **`/categories`** — per `Categories.txt`. Reuses Inventory's Categories tab on its own route. *(Redirects to /inventory?tab=categories — standalone route pending)*
- [x] **`/reviews`** — Flagged queue panel, moderation drawer, analytics section (platform avg, distribution, tailors below threshold).
- [x] **`/revenue`** — GMV/commission/refunds/net KPI cards, stacked area chart by order type, commission config (global rate, per-tier rates, per-tailor overrides with add/delete), export button.
- [x] **`/payouts`** — Queue/Failed/History tabs, KPI strip, failed alert banner, process-all + process-single + retry actions, payout schedule editor (super_admin only).
- [x] **`/promotions`** — Featured listings table with remove action. Discount codes tab: KPI strip, create-code dialog (percentage/fixed, validity dates, max uses), deactivate action.
- [x] **`/notifications`** — Broadcast composer (bilingual en+ar, audience targeting + tier filter), recent broadcasts table. Message center: thread list + per-thread conversation view with reply + close.
- [x] **`/admins`** — Table with role/2FA/status columns, create-admin dialog, deactivate confirm dialog, per-admin audit log drawer, reset-2FA + reset-password actions (super_admin only).
- [x] **`/settings`** — Five tabs: Platform / Onboarding / Policies / Security (IP allowlist, session config) / Integrations (Stripe mode + keys, R2, SendGrid, Sentry, PostHog). Sticky dirty-tracking save bar.

---

## Phase 7 — Tailor Dashboard (apps/tailor-web)

> **Full build spec: [`../../TailorDocs/`](../../TailorDocs/README.md)** — screens, data model, API, components, setup.

- [ ] Vite + React + TS in `apps/tailor-web`. Same Tailwind tokens & shared packages as admin.
- [ ] Phone OTP login (Supabase Auth).
- [ ] Onboarding stepper (cannot skip): business profile → documents → Stripe Connect → first listing.
- [ ] Sidebar (brand green) + topbar (notification bell with Realtime unread, language toggle en/ar).
- [ ] **Overview** — pending orders, in-progress, available balance, weekly earnings, rating, pending review requests, new-order alert via Realtime.
- [ ] **Orders** — status tabs Incoming/Active/Completed/Cancelled; order detail with custom-stitch specs, status update buttons (allowed transitions only), progress update form (stage + description en/ar + images), embedded message thread, decline modal, deposit-capture button.
- [ ] **Listings** — grid with status badges and per-listing stats; create listing form (type → conditional fields, en + ar, images drag-reorder, variant builder, materials section for service type, stock toggle); inline edit; pause/resume.
- [ ] **Portfolio** — image grid with drag-reorder, bio en + ar, specializations, city, "Preview as customer" link.
- [ ] **Earnings** — available + pending balances, withdraw button, earnings chart, per-order earnings table, payout history table.
- [ ] **Disputes** — active disputes with SLA, response form (text + images + deadline), resolved disputes list.
- [ ] **Reviews** — received reviews with response form per unanswered review, edit-within-24h, flag button, rating distribution donut.
- [ ] **Subscription** — current tier card, usage vs limits bars, comparison cards, upgrade/downgrade flow, billing history.
- [ ] **Settings** — profile, business, language, notification preferences, Stripe Connect status, business hours, auto-decline rules, danger-zone delete account.

---

## Phase 8 — Customer Web (apps/customer-web, Next.js 14)

> **⏸ DEFERRED — "web later".** The Flutter mobile app (Phase 9) is the canonical customer surface for now; the customer-facing ordering flows below are implemented there first. See **[`../../MobileDocs/`](../../MobileDocs/README.md)**. Revisit this phase once mobile has shipped.

- [ ] Next.js 14 App Router; `next-intl` en + ar with RTL on `<html>`; `next/image` with R2 domain allowed; Supabase SSR client (cookie-based auth); Stripe.js.
- [ ] Public SSR pages: Home (hero + search + featured + categories + how-it-works + trust badges); Search & Discovery (URL-state filters, infinite scroll, filter sidebar); Tailor Profile (slug-based, JSON-LD, gallery lightbox, services, materials, reviews, sticky order CTA); Category page; `sitemap.xml` generated dynamically.
- [ ] Auth: phone OTP signup + login.
- [ ] Account pages (protected): dashboard, orders list + detail (timeline, progress photos, message thread, confirm-delivery, open-dispute, leave-review buttons), measurement profiles (illustrated body diagram per measurement), saved tailors grid, reviews written + pending review prompts, disputes list, settings, payment methods (Stripe Elements).
- [ ] Ordering flows: Readymade (cart → checkout → confirmation); Custom Stitch multi-step (service → measurement profile → fabric → reference images → notes → review → 40% deposit → confirmation); Material purchase (quantity in meters → cart → checkout); single-tailor cart restriction with switch-tailor warning modal.
- [ ] Review submission and Dispute submission flows.

---

## Phase 9 — Customer Mobile (apps/mobile, Flutter)

> **Full build spec: [`../../MobileDocs/`](../../MobileDocs/README.md)** — architecture, screens, Riverpod state, API, flows, setup. This is the **primary** customer surface (customer-web is deferred).

- [ ] Flutter SDK 3.x; `supabase_flutter`, `flutter_riverpod`, `go_router`, `flutter_stripe`, `firebase_messaging`, `flutter_secure_storage`, `flutter_localizations` (en + ar with `Directionality`).
- [ ] Phone OTP screens, profile setup screen.
- [ ] Home (search, featured horizontal scroll, category chips, recent tailors, bottom nav: Home/Search/Orders/Messages/Account).
- [ ] Search bottom sheet with filters; results ListView.
- [ ] Tailor profile screen (parallax hero, gallery pinch-zoom, services/materials/reviews tabs, sticky CTA).
- [ ] Cart and Checkout (native Stripe payment sheet).
- [ ] Custom stitch flow (5 steps with illustrated body diagram).
- [ ] Orders screen (Active/Completed/Cancelled) and Order detail (timeline, progress gallery, message thread, action buttons).
- [ ] Messaging screen with Realtime.
- [ ] Review and Dispute screens.
- [ ] Account screen (profile, measurements, saved tailors, notifications, language, logout).
- [ ] FCM token registration on login; deep links from notifications.

---

## Phase 10 — Realtime

- [ ] Enable Supabase Realtime on `order_messages`, `notifications`, `disputes`, `dispute_messages`, `order_status_history`, `order_progress_updates`, `audit_logs` (admin-only).
- [ ] Verify each Realtime publication respects RLS using role-scoped clients.
- [ ] Admin: subscribe to disputes (SLA live updates) + notifications (bell badge) + `audit_logs` (Overview activity feed).
- [ ] Tailor: subscribe to orders channel (toast on new order, in-list updates) + per-order messages.
- [ ] Customer web/mobile: subscribe to per-order messages on detail page + notifications channel.

---

## Phase 11 — Payments

- [ ] Configure Stripe Connect: Express accounts, automatic-payouts disabled, manual payout via platform.
- [ ] Stripe webhook handler with signature validation. Route each event type.
- [ ] Deposit + capture flow for custom stitch (40% on placement, 60% manual capture on delivery).
- [ ] Application fee on PaymentIntents: platform commission collected automatically; remainder transferred to tailor connected account.
- [ ] Refund flow: full + partial; trigger updates `tailor_balances` proportionally.
- [ ] Subscription billing via Stripe Billing; webhook events sync to `tailor_subscriptions`.
- [ ] Promoted listings one-time charge.
- [ ] End-to-end test all flows in staging with Stripe CLI fixtures.

---

## Phase 12 — Security Hardening

- [ ] Zod validation on every Edge Function body; 400 with field-level error array on failure.
- [ ] Redis rate limiter middleware applied to all Edge Functions; thresholds per endpoint group.
- [ ] IP allowlist middleware on all admin Edge Functions before any business logic.
- [ ] `pgcrypto.pgp_sym_encrypt` for `national_id` and `bank_account` fields; key from env; never returned to client.
- [ ] R2 CORS restricted to app domains; signed read URL TTL 1 hour.
- [ ] Refresh token reuse detection via Redis token-family.
- [ ] Admin access JWT in memory only; refresh in `Secure HttpOnly SameSite=Strict` cookie.
- [ ] DOMPurify on every user-generated content render in all three web apps; never `dangerouslySetInnerHTML` on DB-sourced HTML.
- [ ] CSP headers in Vite (admin + tailor) and `next.config.js` (customer): block inline scripts, restrict origins.
- [ ] HSTS, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` in Vercel headers for all three apps.
- [ ] Cloudflare WAF rules in front of all Vercel deployments.
- [ ] Audit log entries for: every login/logout, every PII view (phone reveal, payment-method view, decrypted national_id view), every settings edit, every commission/plan change, every refund, every suspension, every payout.

---

## Phase 13 — Testing

- [ ] Vitest unit tests: every `packages/utils` function (filsToDisplay, displayToFils, calculateCommission, getOrderNextStatuses, formatDate/relative); every Zod schema edge case.
- [ ] Edge Function integration tests with Supabase local dev + seeded test DB.
- [ ] RLS tests with role-scoped clients: customer cannot read another customer's order; tailor cannot read another tailor's balance; service-role-only insert into `audit_logs`; non-admin cannot read `is_internal=true` dispute messages.
- [ ] Stripe webhook tests using Stripe CLI fixtures for every handled event.
- [ ] React Testing Library tests for `packages/ui` components.
- [ ] Playwright E2E (admin): login with TOTP → approve tailor → approve listing → resolve dispute → process payout. (Tailor): accept order → progress update → mark delivered. (Customer): place readymade order → place custom-stitch order → leave review.
- [ ] Lighthouse CI on customer web for SEO/performance budgets.

---

## Phase 14 — Deployment & Operations

- [ ] Vercel projects for admin / tailor-web / customer-web with custom domains.
- [ ] Customer web ISR for tailor profile pages with on-write revalidation.
- [ ] Cloudflare DNS + WAF in front of all three deployments.
- [ ] Supabase production with PITR enabled; PgBouncer transaction pooler.
- [ ] Edge Functions deployed via Supabase CLI in CI on merge to `main`.
- [ ] Flutter EAS builds for iOS TestFlight and Android Play internal track.
- [ ] Sentry DSNs separated per surface (admin/tailor/customer/mobile).
- [ ] Uptime monitoring + alerting on every public URL and critical Edge Function endpoint.
- [ ] Daily DB backup verification + monthly restore drill.
- [ ] Runbook docs for: incident response, payout failure recovery, dispute SLA escalation, Stripe webhook replay.

---

## Phase 15 — Launch Readiness

- [ ] Load test critical Edge Functions (orders, payments, search) at 5x peak expected concurrency.
- [ ] Verify all email templates render correctly in Gmail / Outlook / Apple Mail / mobile clients.
- [ ] Privacy policy and terms of service published; cookie consent on customer web.
- [ ] PCI scope review — confirm card data never touches our servers (Stripe Elements + Connect transfers handle it).
- [ ] DPIA / GDPR-style review for UAE PDPL compliance; data subject access flow documented and tested.
- [ ] Soft-launch to a small set of seed tailors and customers; monitor Sentry, PostHog funnels, Stripe events for 2 weeks.
- [ ] Public launch checklist: DNS, robots.txt, sitemap, social cards, OG image, app store assets, support contact channels, on-call schedule.
