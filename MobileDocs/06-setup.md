# 06 · Setup

## Prerequisites
- **Flutter SDK 3.x** (`flutter doctor` clean), Dart 3
- Xcode (iOS) + Android Studio/SDK (Android)
- Supabase project (shared with admin + tailor)
- Stripe account (test mode) with PaymentSheet enabled
- Firebase project (for FCM push) — iOS + Android apps registered

## Create the app

```bash
flutter create --org com.khyate --project-name khyate_customer mobile
cd mobile
flutter pub add supabase_flutter flutter_riverpod go_router flutter_stripe \
  firebase_core firebase_messaging flutter_secure_storage \
  cached_network_image image_picker intl
flutter pub add --dev build_runner freezed json_serializable riverpod_generator
```

Enable localization: add `flutter_localizations` (SDK) + an `l10n.yaml`, with `lib/app/localization/en.arb` and `ar.arb`.

## Configuration

`lib/core/config.dart` (read from `--dart-define` at build time — do not hard-code secrets):
```dart
const supabaseUrl = String.fromEnvironment('SUPABASE_URL');
const supabaseAnonKey = String.fromEnvironment('SUPABASE_ANON_KEY');
const apiBaseUrl = String.fromEnvironment('API_BASE_URL'); // .../functions/v1
const stripePublishableKey = String.fromEnvironment('STRIPE_PK');
```
Run with:
```bash
flutter run \
  --dart-define=SUPABASE_URL=https://<project>.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=<anon> \
  --dart-define=API_BASE_URL=https://<project>.supabase.co/functions/v1 \
  --dart-define=STRIPE_PK=pk_test_...
```

Platform setup:
- **iOS**: add `GoogleService-Info.plist`, Stripe + camera/photo usage strings in `Info.plist`, push capability.
- **Android**: add `google-services.json`, min SDK per `flutter_stripe`, camera/storage permissions.

## Bootstrap (`main.dart`)
```dart
await Supabase.initialize(url: supabaseUrl, anonKey: supabaseAnonKey);
Stripe.publishableKey = stripePublishableKey;
await Firebase.initializeApp();
runApp(const ProviderScope(child: KhyateApp()));
```

## Build models from the shared types
Mirror `khyate-admin-hub/src/lib/api/types.ts` into `lib/data/models` as `freezed` classes; run `dart run build_runner build`. Keep field names identical to the JSON (snake_case) so `fromJson` is trivial.

## Develop before the backend exists
The Edge Functions may not be ready. Options:
- Point `API_BASE_URL` at a local mock server, **or**
- Reuse the admin hub's seed data (`khyate-admin-hub/src/lib/mock/data.ts`) to stand up a tiny mock (e.g. a local Express/Supabase-functions-serve) returning the same shapes.
Flip to real once `VITE_API_BASE_URL`/`API_BASE_URL` points at Supabase — no UI changes.

## Run & verify
```bash
flutter run            # device/emulator
flutter analyze        # 0 issues
flutter test
```
1. OTP sign-in works; browsing works signed-out.
2. Readymade add-to-cart → checkout → PaymentSheet (test card) → order appears.
3. Custom-stitch wizard completes with 40% deposit.
4. Single-tailor cart modal appears when mixing tailors.
5. Order detail receives realtime status + chat; push arrives on status change.
6. AR locale flips layout to RTL.

## Store builds (roadmap Phase 14)
- iOS → TestFlight; Android → Play internal track (EAS/Fastlane or Codemagic).
- Separate Sentry DSN for the mobile surface; Crashlytics enabled.
