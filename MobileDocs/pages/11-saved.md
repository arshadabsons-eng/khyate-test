# Saved / Wishlist

> **Screen:** `features/saved/saved_screen.dart` · **Audience:** customer

## 1. Purpose
The customer's saved ateliers (wishlist) for quick return. Low-stakes but high-retention —
helps customers come back to tailors they liked.

## 2. What it shows (sections)
- **Saved ateliers** — `repo.savedTailors()` (`GET /me/saved`): tailor cards with unsave.
- Empty-state → browse.

## 3. Buttons & actions
| Control | Action | Repo method | Result |
|---|---|---|---|
| Open atelier | Storefront | → `/tailor/:id` | Navigation |
| Unsave | Remove from wishlist | `toggleSaved(id, false)` → `DELETE /me/saved/:id` | Removed |

## 4. Suggestions (improvements)
- **Now:** simple grid + unsave; empty-state CTA.
- **Next:** save individual listings too; notify on price drop/new collection.
- **Later:** collections/folders.

## 5. Dos & Don'ts
- **Do:** instant toggle; bilingual; modest imagery.
- **Don't:** require a round-trip to render the list (cache locally + sync).
- **Never:** expose other users' saved data.

## 6. Compliance — what's required
- Minimal data; deletable on account deletion (PDPL).

## 7. Secure · Reliable · Efficient
- **Secure:** scoped to the customer.
- **Reliable:** optimistic toggle with revert on error; empty/error states.
- **Efficient:** `cached_network_image`; `idx saved_tailors(user_id)`.
