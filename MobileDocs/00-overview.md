# 00 · Overview

> **Cross-cutting business rules live in [`khyate-admin-hub/Docs/Platform-Domain.md`](../khyate-admin-hub/Docs/Platform-Domain.md)** — the canonical division of responsibility across Admin / Tailor / Customer. Read it first; this folder details the customer slice.

## What this app is

The **Khyate Customer app** is a Flutter mobile application (iOS + Android) where customers discover tailors, browse listings and materials, place orders (readymade, custom-stitch, material-by-the-meter), track fulfilment, chat with tailors, leave reviews, and raise disputes. It is the **sole customer surface** today — there is no customer website yet.

## Who uses it

A single role: **customer** (an authenticated `customer_profiles` row). Browsing is partially available without login; ordering, measurements, messaging, and account features require auth.

## Why mobile-only (for now)

Per the platform roadmap, the customer **web** (Next.js, Phase 8) is deferred. All customer-facing investment goes into the Flutter app first. The ordering flows specified for "customer web" in `tasks.md` Phase 8 are implemented **here** instead — this doc folder folds them into the mobile spec.

## What a customer can do

- **Discover** — home feed (featured tailors, categories), search & filter tailors/listings, view a tailor profile (gallery, services, materials, reviews).
- **Order**
  - *Readymade*: pick listing + variant → cart → checkout.
  - *Custom-stitch*: pick service → choose/create a measurement profile → choose fabric → reference images → notes → review → pay 40% deposit.
  - *Material*: choose quantity in meters → cart → checkout.
- **Track** — orders list + detail with status timeline, progress photos, message thread; confirm delivery; open dispute; leave review.
- **Measurements** — **self-measure** in-app, **or book an appointment** (in-shop or **home visit**) for a tailor to measure you; you **approve** tailor-uploaded measurements before they save to your profile. **Re-measure anytime** your body changes.
- **Reviews** — review the **tailor** after an order, and separately **review the platform** (Khyate) to send feedback/suggestions.
- **Disputes** — if something goes wrong, open a dispute and **chat with the tailor to resolve it**; **escalate to the platform** only if it stays unresolved.
- **Delivery** — choose **courier delivery** (may cost extra) or **pickup**, when the platform enables delivery.
- **Account** — saved tailors, addresses, payment methods (Stripe), notifications, language, profile, logout.

Shopping itself is **free** for customers — Khyate earns from tailors (commission + subscriptions), never from a customer fee.

## What a customer cannot do

- See platform commission, other customers' data, or any tailor's private financials. RLS scopes everything to `auth.uid()`.

## Relationship to the platform

- **Tailors** (via the Tailor Web app) create the listings and fulfil the orders this app places.
- **Admins** (via the Admin Hub) author the **materials catalog**, **categories**, and **size chart** the app reads, verify tailors, moderate reviews, and resolve disputes.
- The materials a customer picks during custom-stitch come from the same admin-managed `materials` catalog (with composition, weight, origin, care, etc.) surfaced in `khyate-admin-hub`.
