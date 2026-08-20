# Khyate — Platform Domain & Business Rules

The single source of truth for **how the three Khyate apps divide responsibility** and the cross-cutting business rules that bind them. When a screen spec in `Docs/`, `../../TailorDocs/`, or `../../MobileDocs/` conflicts with something here, **this wins**.

---

## 1. The three surfaces

| Surface | App | Audience | Role | Docs |
| --- | --- | --- | --- | --- |
| **Admin Hub** | `khyate-admin-hub` (this repo) | Khyate staff | Platform admins + support **only** | `Docs/` |
| **Tailor Web** | `apps/tailor-web` | Verified tailors | Run their own shop | `../../TailorDocs/` |
| **Customer Mobile** | `apps/mobile` (Flutter) | Customers | Shop the marketplace | `../../MobileDocs/` |

The **admin app is the platform side** — oversight, policy, verification, moderation, escalated disputes, payouts processing, and the reference catalog. It is **not** where tailors or customers do their day-to-day work.

> Customer **web** is deferred ("web later"). The Flutter app is the only customer surface for now.

## 2. Who earns / pays what

- **Customers shop for free.** No platform fee or subscription is charged to customers. They pay the order price (+ optional delivery surcharge).
- **The platform earns from tailors**, two ways:
  1. **Order commission** — a % of each order's value, by the tailor's tier (Premium 8% · Professional 10% · Basic 12%), configurable in Admin → Revenue.
  2. **Subscriptions** — tailors pay a monthly/annual tier fee (Basic / Professional / Premium).
- Commission (`commission_fils`) is **never shown to tailors or customers** (hidden by `orders_view`); only admins see it.

## 3. Responsibility matrix

| Capability | Admin (platform) | Tailor | Customer |
| --- | --- | --- | --- |
| Verify tailors (Emirates ID, license) | ✅ decide | submit docs | — |
| Material **reference catalog** | ✅ author | read | read (in shop) |
| Sell materials by the metre | ✅ approve (if policy on) | ✅ offer + price | buy |
| Listings (readymade / made-to-measure) | moderate/approve | ✅ create + price | browse + order |
| **Promotions & discounts** | ✅ set caps | ✅ create their own | redeem |
| Orders | oversee | fulfil | place |
| Measurements & appointments | enable/disable | take + upload | self-measure / book / approve |
| **Reviews** | moderate | receive (respond) | write (tailor **and** platform) |
| **Disputes** | resolve **escalations only** | chat to resolve | chat to resolve / escalate |
| Payouts | ✅ process platform-wide | request + track own | — |
| Delivery | ✅ enable + cap surcharge | hand off to courier | choose + (optionally) pay |
| Commission rates & platform policy | ✅ own | — | — |

## 4. Materials — reference catalog vs tailor offering

This is the key correction to keep in mind:

- **Admin catalog (`Material`)** is a **global reference** of fabrics ("global blends" — cotton, wool, cashmere, silk, linen…). Every tailor draws from the same catalog; **materials are not duplicated per tailor.** The admin curates the *spec only*:
  - quality tier, composition (e.g. 80% cotton / 20% silk), weight (GSM), weave, width, origin, mill/brand, certifications, season, care, properties, and the **canonical colours as hex swatches** (shown as coloured circles, like fabric in a shop).
  - **No price and no stock** at the admin level — those are commercial and belong to the tailor.
- **Tailor offering (`TailorMaterialOffering`)** is a tailor's commercial instance of a catalog material:
  - their **price per metre**, **stock**, the **subset of colours** they actually carry, an optional **discount**, and whether they **sell it directly** (by the metre) vs. only stitch with it.
- **Material-sale approval toggle** (Admin → Settings → Marketplace → `tailor_material_sale_requires_approval`): when **on**, a tailor must be approved before selling fabric by the metre; they can always *stitch* with catalog materials. When approved, they reference the catalog material and set their commercial terms.

Implemented today: the admin catalog (`Material`) and its CRUD live in `src/routes/_app/inventory.tsx` + `src/lib/api/queries/inventory.ts`; the type is in `src/lib/api/types.ts` (`Material` = reference; `TailorMaterialOffering` documents the tailor side).

## 5. Listings — readymade vs made-to-measure

A tailor builds a listing in this order (see `../../TailorDocs/02-screens.md`):

1. **Colours** available for the garment (chosen from the material's catalog colours).
2. **Material** (catalog reference; must be sellable/usable per policy).
3. **Cost** (base price).
4. **Discount** — percentage **or** fixed-value reduction (within the admin promo caps).
5. **Availability**:
   - **Readymade** → a finite quantity in stock by size/variant.
   - **Made-to-measure** (not readymade) → shown with a **stitching cost**; the app uses the **customer's measurements** to compute fabric needed and fit. No fixed stock — built per order.

## 6. Measurements & appointments

Two ways a customer's measurements are captured:

1. **Self-measured** — the customer enters measurements in the mobile app (guided by an illustrated body diagram + the platform `sizes` chart).
2. **Tailor-measured via appointment**:
   - The tailor publishes **available measurement time slots** (e.g. `16:00–19:00`), stored in 24-h/UTC-anchored form and **displayed in UAE time** (Asia/Dubai) — e.g. shown as **4:00 PM – 7:00 PM**.
   - The customer **books a slot** (e.g. 16:25), arrives, and the tailor **uploads** the measurements.
   - The customer **approves** the measurements; on approval they are written to the **customer's profile** (a measurement profile).
   - **Home visits**: some tailors measure at the customer's home — supported as an appointment type.
   - **Re-measure anytime**: bodies change; a customer can book a re-measurement whenever, creating an updated profile.

Admin governs this via Settings → Marketplace (`measurement_appointments_enabled`, `home_visit_measurement_enabled`).

## 7. Reviews

- **Customer → Tailor**: standard rating + review on a completed order. Tailors can respond; **admins moderate** (hide/flag) — tailors cannot edit/delete customer reviews.
- **Customer → Platform**: customers can also review/rate **Khyate itself** (feedback & suggestions). These are not shown on tailor profiles; they feed the admin's product/quality signal.

## 8. Disputes — peer-first, platform-on-escalation

The dispute flow is **between the tailor and customer first**:

1. A customer (or tailor) opens a dispute on an order; the two **chat to resolve it themselves**.
2. If they reach agreement, the dispute closes **without the platform**.
3. **Only if it stays unresolved** and **either party escalates it to the platform** does an admin step in.
4. The admin then **resolves the unresolved conflict** (refund, redo, warning, etc.) as the platform owner.

So the Admin Hub's dispute queue is for **escalated** disputes — not every tailor↔customer disagreement. The SLA timer (Admin → Disputes) starts on **escalation**, governed by `dispute_sla_hours` (Settings → Policies).

## 9. Promotions & discounts

- **Tailors create their own** promotions / discount codes (percentage or fixed value) on their listings.
- The **platform caps** them: `max_promotion_duration_days` and `max_discount_percentage` (Admin → Settings → Marketplace). A tailor cannot exceed the cap.
- The Admin → Promotions page is **oversight** (view all tailors' promos, featured-slot allocation, platform-wide discount analytics) + setting the caps — not where individual tailor promos are authored.

## 10. Payouts

- **Tailor side**: each tailor sees their **own** balance (available/pending), requests payouts, and tracks history (Stripe Connect).
- **Admin side**: the platform **processes** payouts at scale, retries failures, and configures the payout schedule (Admin → Payouts). Balances are updated by triggers, never written by hand.

## 11. Delivery

- Garments move between **tailor and customer** (both directions) via **partner couriers**.
- The **customer may pay more** for delivery (vs. self-pickup).
- **Admin controls** delivery globally: enable/disable, whether the customer pays the surcharge, and the **max surcharge** (Admin → Settings → Marketplace: `delivery_enabled`, `delivery_customer_pays_surcharge`, `max_delivery_surcharge_fils`).

## 12. Tailor verification

A tailor registers, completes their profile, then submits verification documents — **Emirates ID, trade license, and (optionally) portfolio certificate** — as **PDFs / images** (stored in Cloudflare R2). An admin reviews them in the Admin → Verification Queue and approves/rejects per document and overall. Required documents are configured in Admin → Settings → Onboarding.

## 13. Admin-owned settings that govern the marketplace

`Admin → Settings → Marketplace` (`MarketplaceSettings` in `src/lib/api/types.ts`):

| Setting | Effect |
| --- | --- |
| `max_promotion_duration_days` | Longest any tailor promo/discount may run |
| `max_discount_percentage` | Ceiling on a tailor discount |
| `tailor_material_sale_requires_approval` | Gate tailors selling fabric by the metre |
| `measurement_appointments_enabled` | Allow in-shop measurement bookings |
| `home_visit_measurement_enabled` | Allow at-home measurement |
| `delivery_enabled` | Turn courier delivery on/off |
| `delivery_customer_pays_surcharge` | Pass courier fee to customer |
| `max_delivery_surcharge_fils` | Cap the courier fee |

Plus the existing Platform / Onboarding / Policies / Security / Integrations tabs.
