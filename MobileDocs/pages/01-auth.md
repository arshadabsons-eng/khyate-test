# Auth (login / register)

> **Screen:** `features/auth/auth_screen.dart` · **Audience:** customer

## 1. Purpose
Sign customers in and let new ones register. Supports **email/password** and **phone OTP**
(Email/Phone tabs), with Google/Apple wired but dormant until OAuth IDs are set. The first
impression — must feel trustworthy and effortless, bilingual.

## 2. What it shows (sections)
- **Tabs** — Email (email+password login + registration) / Phone (OTP).
- **Social** — Google (and Apple on iOS) buttons (dormant).
- Redirects to `from` route or `/` on success (`ref.read(authProvider.notifier)`).

## 3. Buttons & actions
| Control | Action | Endpoint / repo | Result |
|---|---|---|---|
| Sign in (email) | Authenticate | `POST /auth/login` | Token stored; redirect |
| Register | Create account | `POST /auth/register` | Token stored; redirect |
| Send OTP / verify | Phone login | `signInWithOtp` | Signed in |
| Google / Apple | Social login | `signInWithGoogle` (dormant) | Signed in when enabled |

## 4. Suggestions (improvements)
- **Now:** allow **guest browsing** without forcing login (app-store + conversion).
- **Next:** Sign in with Apple on iOS if Google shown (store requirement); forgot-password.
- **Later:** biometric unlock; phone-first onboarding.

## 5. Dos & Don'ts
- **Do:** bilingual + RTL; clear errors; minimal fields.
- **Don't:** gate the whole catalog behind login.
- **Never:** store the password anywhere on device; never log credentials/tokens.

## 6. Compliance — what's required
- **Sign in with Apple** if Google login is shown on iOS; link **Privacy Policy + Terms** at signup; consent for notifications.
- See [../../docs/compliance/app-store-readiness.md §7](../../docs/compliance/app-store-readiness.md).

## 7. Secure · Reliable · Efficient
- **Secure:** JWT in `flutter_secure_storage`; HTTPS only; clear stale token on logout.
- **Reliable:** handle wrong-credentials, network errors, OTP timeout gracefully.
- **Efficient:** minimal round-trips; cache nothing sensitive.
