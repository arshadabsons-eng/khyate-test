# 05 · Key Flows

End-to-end journeys, with state + API touchpoints. See [02-screens.md](02-screens.md) for screens and [04-api.md](04-api.md) for endpoints.

## 1 · Readymade order

```
Listing detail → choose variant → Add to cart (cartProvider)
  → Cart → Checkout (address + Stripe)
  → POST /orders/quote → POST /payments/intent → PaymentSheet (full amount)
  → POST /orders → Confirmation
```
- Single-tailor rule enforced when adding to cart.
- On success: invalidate `ordersProvider`; push order into list; show confirmation with order #.

## 2 · Custom-stitch order (40% deposit)

```
Listing/Service → Start custom order
  Step 1 Service
  Step 2 Measurements  (pick saved profile OR create one)
  Step 3 Fabric        (material + color from tailor's catalog)
  Step 4 Reference images (image_picker → Storage → urls)
  Step 5 Notes
  Step 6 Review        (price + 40% deposit shown)
  Step 7 Pay deposit   (POST /payments/intent {deposit} → PaymentSheet)
  → POST /orders {type: custom_stitch, custom_spec, deposit_paid}
  → Confirmation
```
- Wizard state in `customOrderDraftProvider`; persists across steps; can resume if backgrounded.
- Remaining 60% billed later via `POST /orders/:id/pay-balance` (prompted on the order detail when the tailor marks ready/delivered, per policy).
- `custom_spec` = `{ measurement_profile_id, fabric: {material_id, color_id, meters}, reference_image_urls[], design_notes }` (mirrors `OrderItem.custom_specifications` in `types.ts`).

## 3 · Material purchase (by the meter)

```
Listing (material) → quantity in meters (≥ minimum_order_meters)
  → Add to cart → Checkout → pay → POST /orders {type: material}
```
- Validate against the material's `minimum_order_meters` and available `stock_meters` (from the catalog).

## 4 · Single-tailor cart rule

- `cartProvider` holds items from exactly one `tailor_id`.
- Adding an item from a different tailor → `DifferentTailorException` → modal:
  > "Your cart has items from **{current tailor}**. Start a new cart with **{new tailor}**? This clears your current cart."
  - **Switch** → clear + add new. **Cancel** → keep current.

## 5 · Track → confirm delivery

```
Orders → Order detail (timeline, progress photos, chat)
  → tailor advances status (realtime updates arrive)
  → on "shipped/ready": customer taps Confirm Delivery
  → POST /orders/:id/confirm-delivery → status completed → prompt Leave Review
```

## 6 · Open a dispute (peer-first, escalate if needed)

```
Order detail (eligible state) → Open dispute
  → choose type (item_not_received | item_damaged | quality_issue | late_delivery | ...)
  → claim text + evidence images → POST /orders/:id/dispute
  → CHAT DIRECTLY WITH THE TAILOR (POST /disputes/:id/messages)
       ├─ resolved together → dispute closes, platform never involved
       └─ still unresolved → "Escalate to Khyate" (POST /disputes/:id/escalate)
              → admin reviews and decides (refund / redo / warning); customer sees outcome
```
The platform only enters on **escalation** — see [Platform-Domain §8](../khyate-admin-hub/Docs/Platform-Domain.md).

## 9 · Get measured by a tailor (appointment)

```
Tailor profile → Book appointment
  → slots shown in UAE time (tailor's 16:00–19:00 → 4:00–7:00 PM)
  → pick in-shop OR home visit (+ address) → POST /appointments
  → (visit happens) tailor uploads measurements
  → customer notified → /measurements/pending → Approve (POST /measurements/:id/approve)
  → measurements saved to the customer profile (versioned); re-measure anytime
```
Self-measure is the alternative: enter values against the illustrated body diagram (no appointment).

## 10 · Delivery vs pickup

```
At checkout / when order is Ready (if delivery enabled by admin):
  choose Courier (POST /orders/:id/delivery/choose → courier)
     → customer pays surcharge (≤ admin max_delivery_surcharge_fils)
     → courier moves garment tailor → customer
  OR choose Pickup (no surcharge)
```
Garments can also move customer → tailor (e.g. alterations) the same way. Admin owns the on/off + surcharge cap.

## 7 · Leave a review

```
Completed order → Leave review → rating (1–5) + title + body + images
  → POST /orders/:id/review
  → appears on the tailor profile after moderation (admins can hide/flag)
```

## 8 · Auth gate

- Browsing Home/Search/Tailor works unauthenticated.
- Any gated action (add to cart checkout, save, measurements, orders, messages) → redirect to `/auth` (OTP) → return to the originating screen on success.
