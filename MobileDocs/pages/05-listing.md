# Listing detail

> **Screen:** `features/listing/listing_screen.dart` · **Audience:** customer

## 1. Purpose
The product page for a single garment/fabric: photos, price, options (colour, stitch),
and the path to add to cart or start a custom (made-to-measure) order.

## 2. What it shows (sections)
- **Images** — carousel (`image_urls`).
- **Details** — title (EN/AR), type, **all-in price incl. VAT** (+ stitching cost), colours, description, the tailor (link to `/tailor/:id`).
- **CTA** — Add to cart / Customise (→ `/custom/:listingId`).

## 3. Buttons & actions
| Control | Action | Repo method | Result |
|---|---|---|---|
| Add to cart | Add line | `cartProvider.add` | In cart |
| Customise | Made-to-measure | → `/custom/:listingId` | Custom order flow |
| Open tailor | Storefront | → `/tailor/:id` | Navigation |
| Save | Wishlist tailor | `toggleSaved` | Saved |

## 4. Suggestions (improvements)
- **Now:** show price clearly with VAT; colour swatches.
- **Next:** size guide (from platform standard sizes); stock/lead-time; barcode/SKU.
- **Later:** zoomable images; "customers also viewed".

## 5. Dos & Don'ts
- **Do:** all-in price before add-to-cart; accurate photos/fabric/colour; modest imagery.
- **Don't:** surprise the customer with extra fees later.
- **Never:** misrepresent the product (consumer protection).

## 6. Compliance — what's required
- Accurate description + price incl. 5% VAT (consumer protection + VAT).
- Modest imagery; report path for inappropriate content.

## 7. Secure · Reliable · Efficient
- **Secure:** public read; token optional.
- **Reliable:** image fallback; out-of-stock handling; error/empty states.
- **Efficient:** `cached_network_image`; lazy image loading.
