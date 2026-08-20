# Custom order (made-to-measure)

> **Screen:** `features/custom/custom_order_screen.dart` · **Audience:** customer

## 1. Purpose
Order a garment **stitched to the customer's measurements**. Ties a listing to a
measurement profile and design notes, then places a custom-stitch order.

## 2. What it shows (sections)
- **Listing context** — the piece being customised (`listingProvider(listingId)`).
- **Measurements** — pick/confirm a measurement profile (`measurementsProvider`); link to `/measurements` to add one.
- **Design notes** + place order (`repo.placeOrder(type: ListingType.customStitch)`).

## 3. Buttons & actions
| Control | Action | Repo method | Result |
|---|---|---|---|
| Add/select measurements | Attach profile | → `/measurements` / `measurementsProvider` | Profile chosen |
| Place custom order | Create order | `placeOrder(lines, type: customStitch)` | Order created → `/orders/:id` |

## 4. Suggestions (improvements)
- **Now:** require a measurement profile (or book a measurement) before placing — prevents fit disputes.
- **Next:** show standard size templates as a starting point; reference photos in design notes.
- **Later:** tailor confirmation/quote step before commitment.

## 5. Dos & Don'ts
- **Do:** make measurements explicit; show all-in price incl. VAT; bilingual.
- **Don't:** allow a custom order with no measurements and no booking.
- **Never:** misrepresent lead time; never expose measurements to other users.

## 6. Compliance — what's required
- Accurate price/lead time (consumer protection); measurements are sensitive PII (PDPL).
- Approved measurements before stitching (dispute avoidance).

## 7. Secure · Reliable · Efficient
- **Secure:** measurements scoped to the customer; sent only to the chosen tailor.
- **Reliable:** validate profile present; clear order confirmation; handle errors.
- **Efficient:** reuse cached listing/measurement providers.
