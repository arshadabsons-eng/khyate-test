# MobileDocs — Khyate Customer Flutter App

Build specification for the **Customer Mobile app** (`apps/mobile`) — the **only** customer-facing surface for now. Customers browse tailors, order readymade/custom-stitch garments and materials, track orders, message tailors, and manage measurements — all from Flutter (iOS + Android).

This is one of three Khyate surfaces:

| Surface | Audience | Tech | Docs |
| --- | --- | --- | --- |
| **Admin Hub** | Platform admins + support | Vite + React + TS | `khyate-admin-hub/Docs/` |
| **Tailor Web** | Verified tailors | Vite + React + TS | `../TailorDocs/` |
| **Customer Mobile** | Customers | **Flutter** | **this folder** |

> Customer **web** (Next.js) is explicitly **deferred** ("web later"). Do not build it yet — the mobile app is the canonical customer experience.

## Read in this order

1. [00-overview.md](00-overview.md) — what the app is, who uses it
2. [01-architecture.md](01-architecture.md) — Flutter stack, layering, routing, i18n
3. [02-screens.md](02-screens.md) — every screen
4. [03-state-management.md](03-state-management.md) — Riverpod, repositories, caching
5. [04-api.md](04-api.md) — Edge Functions + Realtime the app uses
6. [05-flows.md](05-flows.md) — key end-to-end journeys
7. [06-setup.md](06-setup.md) — SDK → store builds

## Source of truth

Roadmap: `khyate-admin-hub/Docs/tasks.md` (Phase 9 = mobile; customer ordering flows are detailed in Phase 8). Entity shapes mirror `khyate-admin-hub/src/lib/api/types.ts`. Those win on conflict.

## Conventions

- **Money** is integer **fils** on the wire (1 AED = 100 fils); format only for display.
- **Bilingual** EN + AR with full **RTL** (`Directionality`); AR copy via `flutter_localizations`.
- **Single-tailor cart** rule (see [05-flows.md](05-flows.md)).
