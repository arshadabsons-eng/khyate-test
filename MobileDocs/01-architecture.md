# 01 · Architecture

## Stack (roadmap Phase 9)

- **Flutter SDK 3.x** (Dart 3)
- **State**: `flutter_riverpod` (providers + `AsyncValue`)
- **Routing**: `go_router` (declarative, deep-link friendly, redirect guards)
- **Backend**: `supabase_flutter` (Auth, Postgres via PostgREST, Realtime, Storage)
- **Payments**: `flutter_stripe` (PaymentSheet for checkout + deposits)
- **Push**: `firebase_messaging` (order updates, messages)
- **Secure storage**: `flutter_secure_storage` (session/tokens)
- **i18n/RTL**: `flutter_localizations` + `intl` (EN + AR, `Directionality` flips layout)
- **Images**: `cached_network_image`; `image_picker` for reference photos

## Layered structure

```
lib/
  main.dart                 ← bootstrap: Supabase.init, ProviderScope, MaterialApp.router
  app/
    router.dart             ← GoRouter + auth/redirect guards
    theme.dart              ← Khyate tokens (primary green #2D7A2D), light/dark
    localization/           ← en.arb, ar.arb
  core/
    api/
      supabase_client.dart
      api_client.dart       ← typed wrappers over Edge Functions
      errors.dart           ← ApiError (mirror admin hub contract)
    money.dart              ← filsToAed, formatting
    result.dart
  data/
    models/                 ← Tailor, Listing, Order, Material, Review, Dispute, MeasurementProfile (mirror src/lib/api/types.ts)
    repositories/           ← TailorRepo, OrderRepo, CartRepo, MaterialRepo, MeasurementRepo, ...
  features/
    auth/  home/  search/  tailor/  listing/  cart/  checkout/
    orders/  measurements/  saved/  messages/  notifications/  account/
      ├── presentation/     ← screens + widgets
      ├── providers/        ← Riverpod providers/notifiers
      └── ...
  shared/widgets/           ← KCard, KStatusBadge, KRating, KEmptyState, KErrorState, KMoney
```

Each feature owns its screens, widgets, and providers; cross-cutting models/repos live in `data/`.

## Navigation

- **GoRouter** with a shell route hosting the **bottom navigation** (Home · Search · Orders · Messages · Account).
- **Redirect guard**: unauthenticated users can browse Home/Search/Tailor; tapping order/measurement/account actions redirects to auth.
- Deep links: `khyate://tailor/:id`, `khyate://order/:id` (push notifications open these).

## Auth

- Supabase Auth (email + OTP / phone OTP for UAE). Session persisted in `flutter_secure_storage`; restored on launch.
- `authStateProvider` exposes the current customer; the router watches it for redirects.

## Localization & RTL

- All strings in `.arb` files; never hard-code user-facing copy.
- Wrap the app in `Directionality` driven by locale; mirror paddings/icons for AR.
- Server bilingual fields (`*_ar`) chosen by current locale.

## Offline & caching

- Riverpod caches in memory; `cached_network_image` for media; optionally persist the cart and last-viewed lists to `flutter_secure_storage`/`shared_preferences` so the app opens warm.

## Observability

- Sentry (mobile DSN), Firebase Analytics/Crashlytics. See roadmap Phase 14.
