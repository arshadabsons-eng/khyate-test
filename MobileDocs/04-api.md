# 04 · API

Supabase **Edge Functions** (roadmap Phase 5) + Realtime channels the app consumes via `supabase_flutter` and a typed `ApiClient`. Base URL = `<project>.supabase.co/functions/v1`; bearer = Supabase session token. All RLS-scoped to the customer. Money in fils.

## Auth & profile
- `POST /auth/otp-request`, `POST /auth/otp-verify`
- `GET /customers/me`, `POST /customers/me` (update profile/language)
- Addresses: `GET/POST/PUT/DELETE /customers/me/addresses`
- Payment methods: `GET /customers/me/payment-methods` (Stripe SetupIntent for add)

## Discovery (some public)
- `GET /home` — featured tailors + categories + banners
- `GET /tailors/search?q=&category=&gender=&city=&price_min=&price_max=&rating=&page=`
- `GET /tailors/:id/public` — profile, services, materials, reviews
- `GET /listings/:id`
- `GET /inventory/categories`, `GET /inventory/materials`, `GET /inventory/sizes` — read-only catalog (shared with admin/tailor)

## Cart & checkout
- Cart is mostly client-side (`cartProvider`); server validates at checkout.
- `POST /orders/quote` — price a cart (subtotal, fees, deposit for custom-stitch)
- `POST /orders` — place order `{ tailor_id, items[], address_id, type, custom_spec? }`
- `POST /payments/intent` — Stripe PaymentIntent (full or 40% deposit) → PaymentSheet
- `POST /orders/:id/pay-balance` — remaining custom-stitch balance

## Orders
- `GET /orders?status=&page=`
- `GET /orders/:id` — timeline, items, progress photos, payment (no commission)
- `POST /orders/:id/confirm-delivery`
- `GET /orders/:id/messages`, `POST /orders/:id/messages`
- `POST /orders/:id/dispute` — open dispute `{ type, claim_text, evidence_urls[] }` (starts a tailor chat)
- `POST /disputes/:id/messages` — chat with the tailor
- `POST /disputes/:id/escalate` — escalate to the platform (only after peer resolution fails)
- `POST /orders/:id/review` — review the **tailor** `{ rating, title, body, images[] }`
- `POST /orders/:id/delivery/choose` — pick `courier` (pays surcharge) or `pickup` at checkout/ready

## Reviews — platform
- `POST /platform/review` — review **Khyate** itself `{ rating, suggestions }` (feedback channel, not shown on tailor profiles)

## Measurements & appointments
- `GET/POST/PUT/DELETE /customers/me/measurements` — self-measured profiles (versioned)
- `GET /tailors/:id/availability` — measurement slots (returned UTC; render in Asia/Dubai)
- `POST /appointments` — book `{ tailor_id, slot_start, type: in_shop|home_visit, address_id? }`
- `GET /customers/me/appointments` · `POST /appointments/:id/cancel`
- `GET /customers/me/measurements/pending` — tailor-uploaded profiles awaiting approval
- `POST /measurements/:id/approve` · `POST /measurements/:id/reject` — approve → saved to profile

## Saved & notifications
- `GET /customers/me/saved`, `POST /tailors/:id/save`, `DELETE /tailors/:id/save`
- `GET /notifications?limit=`, `POST /notifications/:id/read`
- `POST /devices` — register FCM token for push

## Realtime channels (Phase 10)
- `messages:order=<id>` — live chat on an open order
- `orders:customer=<id>` — status changes → local update + push
- `notifications:user=<id>` — bell feed

## Storage (Cloudflare R2 / Supabase Storage)
- Reference images (custom-stitch) and review images upload via signed URLs; the returned URLs are sent in the order/review payload.

## Error contract
Mirror the admin hub's `ApiError` (`{ message, status, code?, fields? }`) → a Dart `ApiError` so `KErrorState` and retries behave consistently. Network failures are retryable.
