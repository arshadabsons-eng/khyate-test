# Home

> **Screen:** `features/home/home_screen.dart` · **Audience:** customer

## 1. Purpose
The discovery landing screen: a hero, category strip, featured ateliers, and featured
pieces — inviting the customer to explore and order. Sets the modest, premium tone.

## 2. What it shows (sections)
- **Hero** — explore CTA → `/search`.
- **Category strip** — `categoriesProvider` → tap → `/search`.
- **Featured ateliers** — `featuredTailorsProvider` (`GET /tailors-public?limit=8`), each → `/tailor/:id`, with save toggle.
- **Featured pieces** — `featuredListingsProvider` (`GET /listings?limit=8`) → `/listing/:id`.
- Cart icon → `/cart`.

## 3. Buttons & actions
| Control | Action | Endpoint / repo | Result |
|---|---|---|---|
| Category tap | Browse category | → `/search` | Navigation |
| Atelier card | Open storefront | → `/tailor/:id` | Navigation |
| Save (heart) | Wishlist a tailor | `savedProvider.toggle` → `/me/saved` | Saved |
| Listing card | Open piece | → `/listing/:id` | Navigation |
| Cart | Open cart | → `/cart` | Navigation |

## 4. Suggestions (improvements)
- **Now:** modest, relevant imagery (avoid wrong/duplicate seed images — see [../../docs/product-images.md](../../docs/product-images.md)).
- **Next:** personalised/near-me ateliers; Ramadan/Eid collections.
- **Later:** recently viewed; search bar inline.

## 5. Dos & Don'ts
- **Do:** modest, well-shot imagery; bilingual; fast first paint.
- **Don't:** require login to browse.
- **Never:** show revealing imagery; never block on a single failed section.

## 6. Compliance — what's required
- Modest content; accurate representation of listings (consumer protection).

## 7. Secure · Reliable · Efficient
- **Secure:** public endpoints; token optional.
- **Reliable:** each section has loading/empty/error; no crash on network loss.
- **Efficient:** `cached_network_image`; small `limit=8` payloads; cache-friendly public GETs.
