# Account

> **Screen:** `features/account/account_screen.dart` · **Audience:** customer

## 1. Purpose
The customer's hub: name/profile, shortcuts (measurements, cart, saved), **contact
support**, and sign-out. Also the home for privacy/legal links and — required — account
deletion.

## 2. What it shows (sections)
- **Profile** — name/email (`ref.watch(authProvider).valueOrNull`).
- **Shortcuts** — My measurements (`/measurements`), My cart (`/cart`), Saved ateliers (`/saved`).
- **Support** — Contact support (`repo.contactSupport(subject, message)`).
- **Account** — sign out (`authProvider.signOut`).

## 3. Buttons & actions
| Control | Action | Repo method | Result |
|---|---|---|---|
| Measurements / Cart / Saved | Navigate | → routes | Navigation |
| Contact support | Open a support request | `contactSupport(...)` (wire to `/support/threads`) | Thread created |
| Sign out | Log out | `signOut()` | → `/` |
| (required) Delete account | Remove account + data | account-deletion endpoint (to add) | Account + PII deleted |
| (required) Privacy / Terms | Open policies | external/in-app links | Policy shown |

## 4. Suggestions (improvements)
- **Now (blocking for stores):** add **in-app account deletion** + **Privacy Policy / Terms** links (Apple & Google hard requirements).
- **Next:** language toggle; notification preferences; data export (PDPL).
- **Later:** profile photo; saved addresses management.

## 5. Dos & Don'ts
- **Do:** make support one tap; bilingual; clear sign-out.
- **Don't:** hide deletion behind a website only (must be in-app).
- **Never:** ship account creation without in-app deletion (instant store rejection); never expose another user's data.

## 6. Compliance — what's required
- **In-app account deletion + data export**, reachable **Privacy Policy + Terms** — Apple/Google + PDPL. See [../../docs/compliance/app-store-readiness.md §1–2](../../docs/compliance/app-store-readiness.md) and [../../docs/compliance/uae-legal.md §4](../../docs/compliance/uae-legal.md).
- Notification/consent management.

## 7. Secure · Reliable · Efficient
- **Secure:** all data scoped to the customer; sign-out clears the secure-storage token; deletion hard-removes PII (anonymise financial rows for tax).
- **Reliable:** null-safe auth (`valueOrNull`); confirm destructive actions (delete/sign-out).
- **Efficient:** minimal profile payload; lazy-load sub-screens.
