# Tailor / Storefront + Booking

> **Screen:** `features/tailor/tailor_screen.dart` · **Audience:** customer

## 1. Purpose
The customer-facing atelier page: brand, bio (EN/AR), gallery, collection (listings),
reviews — and the entry point to **book a measurement appointment** (in-shop or home visit,
with required tailor gender). The conversion screen.

## 2. What it shows (sections)
- **Header** — banner, profile, name, verified, rating, tagline, location, atelier type.
- **Bio + specializations**; **gallery**; **collection** (`repo.listingsForTailor`); **reviews** (`repo.reviewsForTailor`).
- **Booking** — `AppointmentBookingScreen`: date → real slots (`repo.tailorSlots`), mode (in-shop/home), address + required tailor gender for home (`repo.saveAddress`, `repo.bookAppointment`).

## 3. Buttons & actions
| Control | Action | Repo method | Result |
|---|---|---|---|
| Save atelier | Wishlist | `toggleSaved` → `/me/saved` | Saved |
| Open listing | Piece detail | → `/listing/:id` | Navigation |
| Book appointment | Reserve a slot | `bookAppointment({tailorId, type, slotStart, addressId?, requiredTailorGender?})` | Appointment created |
| Pick/save address | For home visit | `saveAddress`, `addresses` | Stored pin |

## 4. Suggestions (improvements)
- **Now:** finish the real-slots booking UI (date picker → `tailorSlots`, home/in-shop, address + gender) — data layer exists.
- **Next:** OpenStreetMap pin (`flutter_map`) + `geolocator` for the address; appointments tracking screen (approve visit / approve measurement / dispute).
- **Later:** chat-before-book; ETA display.

## 5. Dos & Don'ts
- **Do:** show all-in price incl. VAT; honour requested tailor gender; modest imagery; bilingual.
- **Don't:** hide who's coming for a home visit.
- **Never:** charge a fee to book; never send a gender-mismatched tailor; never use a paid maps API (OSM only).

## 6. Compliance — what's required
- **Free appointments**, **gender-matched** home visits; location permission requested at booking with a clear purpose string.
- See [../../docs/home-visit-location.md](../../docs/home-visit-location.md) and [../../docs/compliance/app-store-readiness.md §4](../../docs/compliance/app-store-readiness.md).

## 7. Secure · Reliable · Efficient
- **Secure:** address/location is sensitive PII; sent only to the assigned tailor/support.
- **Reliable:** slots reflect real availability; handle no-slots; booking confirmation.
- **Efficient:** `cached_network_image`; paginate listings/reviews; short-cache public reads.
