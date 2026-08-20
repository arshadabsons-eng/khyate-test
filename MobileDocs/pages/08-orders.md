# Orders

> **Screen:** `features/orders/orders_screen.dart` · **Audience:** customer

## 1. Purpose
Where customers track their orders end-to-end: status, items, payment, and the path to
confirm delivery, chat, review, or raise an issue. Visible progress = trust.

## 2. What it shows (sections)
- **Orders list** — `repo.orders()` (`GET /me/orders`): status, items, total, date.
- **Order detail** — items, status timeline, payment, delivery; actions (confirm delivery, pay, chat, review, dispute).

## 3. Buttons & actions
| Control | Action | Repo method | Result |
|---|---|---|---|
| Open order | Detail | `repo.order(id)` | Detail |
| Pay | Pay pending order | `payForOrder(id)` | Paid |
| Confirm delivery | Close the loop | `confirmDelivery(id)` → `/me/orders/:id/confirm-delivery` | Delivered confirmed |
| Chat | Message tailor/support | → order chat | Thread |
| Review | Rate the order | `submitReview(orderId, rating, body)` | Review posted |
| Raise issue | Open dispute | dispute endpoint | Dispute created |

## 4. Suggestions (improvements)
- **Now:** plain status steps + ETA; one-tap "Something wrong?".
- **Next:** delivery proof display; reorder.
- **Later:** push notifications on status change.

## 5. Dos & Don'ts
- **Do:** clear status + ETA; easy, blame-free dispute path; show VAT-inclusive totals.
- **Don't:** bury the support/dispute action.
- **Never:** mark delivered on the customer's behalf without their confirm on high-value orders.

## 6. Compliance — what's required
- Consumer-protection remedies reachable (repair/replace/refund); order agreement + timeline retained.
- VAT invoice available.

## 7. Secure · Reliable · Efficient
- **Secure:** orders scoped to the customer.
- **Reliable:** status timeline source of truth; offline/empty/error states.
- **Efficient:** paginate; `cached_network_image`; minimal payloads.
