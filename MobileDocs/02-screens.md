# 02 · Screens

Bottom nav shell: **Home · Search · Orders · Messages · Account**. All money via `filsToAed`; all screens EN/AR + RTL. Each screen renders loading / empty / error states (`KEmptyState`, `KErrorState`).

---

## Auth (`/auth`)
- Phone or email **OTP** sign-in/up (UAE phone first). Minimal profile capture (name, preferred language).
- Skippable for browsing; gated actions deep-link back here.

## Home (`/`)
- Search bar (taps → Search), **featured tailors** horizontal scroll, **category chips** (from `categories`), **recent/saved tailors**, promotional banners (featured listings).
- Pull-to-refresh.

## Search & Discovery (`/search`)
- Query + **filter sheet**: category, gender, city, price range, rating, material type. URL/route-state driven so results are shareable/deep-linkable.
- **Infinite scroll** result list of tailors/listings; toggle list/grid.

## Tailor profile (`/tailor/:id`)
- **Parallax hero** + avatar, name, city, rating, verified badge, tier.
- Tabs: **Services** (listings by type), **Materials** (the fabrics this tailor offers, from the catalog), **Reviews**.
- Gallery with pinch-zoom. **Sticky CTA**: "Order" / "Message". Save (heart) toggle.

## Listing detail (`/listing/:id`)
- Images, title/description (EN/AR), price, variants (size/color), attached **materials** (tap → fabric detail: composition, weight, origin, care). CTA depends on type:
  - *Readymade* → choose colour/variant → **Add to cart** (limited stock).
  - *Made-to-measure (custom-stitch)* → shows **base + stitching cost**; **Start custom order** (multi-step). Final fabric quantity & fit are computed from your **measurements** at order time — no fixed stock.
  - *Material* → quantity in meters → **Add to cart** (only if the tailor sells that fabric directly).

## Custom-stitch flow (`/order/custom/:listingId`) — multi-step
1. **Service** (which custom service / garment)
2. **Measurements** — pick a saved **measurement profile** or create one (illustrated body diagram per field; uses the admin `sizes` chart as guidance)
3. **Fabric** — choose a material + color from the tailor's catalog
4. **Reference images** — upload inspiration photos (`image_picker` → Storage)
5. **Notes** — free-text design notes
6. **Review** — summary + price + **40% deposit** amount
7. **Pay deposit** (Stripe PaymentSheet) → confirmation

## Cart (`/cart`)
- Line items (readymade variants + materials). **Single-tailor rule**: cart holds one tailor at a time; adding another tailor's item prompts a "switch tailor / clear cart" modal (see [05-flows.md](05-flows.md)).
- Promo code field; subtotal/fees/total.

## Checkout (`/checkout`)
- Delivery address (saved addresses), payment method (Stripe), order summary → **Place order** → confirmation screen.

## Orders (`/orders`)
- List with status chips. Tap → detail.

### Order detail (`/order/:id`)
- **Status timeline** (`order_status_history`), **progress photos** from the tailor, payment summary (no commission), items (custom specs shown for custom-stitch).
- **Message thread** (realtime) with the tailor.
- Actions by state: **Confirm delivery**, **Open dispute** (opens a tailor chat first — see Disputes below), **Leave review** (rate the tailor), pay remaining balance (custom-stitch after deposit).

## Disputes (`/order/:id/dispute`)
Peer-first (see [Platform-Domain §8](../khyate-admin-hub/Docs/Platform-Domain.md)):
- Open a dispute (type + claim + evidence images) → **chat directly with the tailor** to resolve it.
- If resolved together, it closes — the platform is never involved.
- If it stays unresolved, tap **Escalate to Khyate**; only then does an admin step in to decide the outcome (refund/redo/etc.).

## Measurements (`/measurements`)
- List of measurement profiles. Two ways to add one:
  1. **Self-measure** — create/edit with an **illustrated body diagram** highlighting each measurement (chest, waist, hips, sleeve, length, …), guided by the standard `sizes` chart.
  2. **Get measured by a tailor** — **Book appointment** (next): the tailor uploads the measurements, and they appear here as **pending your approval**; tap **Approve** to save them to your profile.
- **Re-measure anytime** — bodies change; book again or edit a self-measured profile. Profiles are versioned so old orders keep the measurements they used.

## Book measurement appointment (`/tailor/:id/appointments`)
- Shows the tailor's available **measurement slots** rendered in **UAE time** (e.g. the tailor's `16:00–19:00` displays as **4:00–7:00 PM**).
- Choose **in-shop** or **home visit** (if the tailor offers it; both gated by platform policy). For home visits, pick the saved address.
- Pick a time (e.g. 4:25 PM) → confirm. After the visit, the tailor uploads measurements → you get a notification to **review & approve** them.

## Saved tailors (`/saved`)
- Grid of hearted tailors; unsave; jump to profile.

## Messages (`/messages`)
- Thread list (per order / per tailor) with unread badges → conversation view (realtime).

## Notifications (`/notifications`)
- Order updates, messages, promos; deep-link into the relevant screen. Mark read.

## Account (`/account`)
- Profile, addresses, payment methods (Stripe), measurements shortcut, saved tailors, language (EN/AR) toggle, notification settings, help/support, logout.
- **Rate Khyate** — review the **platform** itself (stars + suggestions). Separate from tailor reviews; feeds the team's product/quality signal, not the tailor profiles.
