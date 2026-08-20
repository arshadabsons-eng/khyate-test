# Search

> **Screen:** `features/search/search_screen.dart` · **Audience:** customer

## 1. Purpose
Find an atelier (or category of work). Customers type a query or pick a category and browse
matching tailors. The main discovery tool after Home.

## 2. What it shows (sections)
- **Search field** + category filter.
- **Results** — tailor cards (`repo.searchTailors(query, category)` → `GET /tailors-public?search=&limit=40`), filtered client-side by specialization when a category is chosen.

## 3. Buttons & actions
| Control | Action | Endpoint / repo | Result |
|---|---|---|---|
| Type query | Search ateliers | `GET /tailors-public?search=` | Results |
| Category chip | Filter by specialization | client filter | Narrowed list |
| Result card | Open storefront | → `/tailor/:id` | Navigation |

## 4. Suggestions (improvements)
- **Now:** debounce input; empty/no-results state with suggestions.
- **Next:** server-side category + city/emirate filters; sort by rating/distance.
- **Later:** search listings (not just tailors); recent searches.

## 5. Dos & Don'ts
- **Do:** bilingual placeholder; forgiving matching; fast results.
- **Don't:** block typing on each network call (debounce).
- **Never:** expose tailor private contact in results.

## 6. Compliance — what's required
- Accurate, non-misleading results; modest imagery.

## 7. Secure · Reliable · Efficient
- **Secure:** public read; token optional.
- **Reliable:** loading/empty/error states; handles slow network.
- **Efficient:** `limit=40` cap; cache repeated queries; `cached_network_image`.
