# Cart & Checkout

> **Screen:** `features/cart/cart_screen.dart` (CartScreen + CheckoutScreen) · **Audience:** customer

## 1. Purpose
Review selected items and place + pay for an order. The money moment — must be clear,
honest, and reassuring (all-in price, safe payment).

## 2. What it shows (sections)
- **Cart** — lines (item, qty, unit price), total (`cartProvider`); empty-state → browse.
- **Checkout** — delivery option, measurement profile/design notes, summary, place order + pay (`repo.placeOrder`, `repo.payForOrder`).

## 3. Buttons & actions
| Control | Action | Repo method | Result |
|---|---|---|---|
| Adjust qty / remove | Edit cart | `cartProvider` | Updated total |
| Checkout | Go to checkout | → `/checkout` | Navigation |
| Place order | Create order | `placeOrder({lines, type, measurementProfileId?, requiresDelivery})` | Order created |
| Pay | Pay (demo or Stripe) | `payForOrder(orderId)` → `/payments/create-intent` | Paid / client_secret; cart cleared; → `/orders/:id` |

## 4. Suggestions (improvements)
- **Now:** show **5% VAT line** + delivery in the summary; all-in total.
- **Next:** address selection for delivery (pickup vs deliver) per [../../docs/ops/delivery-flow.md](../../docs/ops/delivery-flow.md).
- **Later:** saved payment methods; promo-code entry.

## 5. Dos & Don'ts
- **Do:** show the final VAT-inclusive total before payment; clear payment status.
- **Don't:** add fees after the customer sees the price.
- **Never:** route physical-goods payment through Apple IAP; never handle raw card numbers (use the processor).

## 6. Compliance — what's required
- **VAT 5%** + tax invoice; **card via PCI-compliant processor** (not IAP) — see [../../docs/compliance/app-store-readiness.md §8](../../docs/compliance/app-store-readiness.md) and [../../docs/compliance/uae-legal.md §2](../../docs/compliance/uae-legal.md).
- Clear refund/return policy linked at checkout.

## 7. Secure · Reliable · Efficient
- **Secure:** payment via processor over HTTPS; order scoped to the customer.
- **Reliable:** idempotent place-order; handle payment failure; clear cart only on success.
- **Efficient:** minimal checkout payload; optimistic cart updates.
