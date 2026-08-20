# Measurements

> **Screen:** `features/measurements/measurements_screen.dart` · **Audience:** customer

## 1. Purpose
Manage measurement profiles as **people** (self / spouse / son / daughter), each holding
per-garment measurement charts. Used for custom orders and to approve a tailor's recorded
measurements. Sensitive, personal — handle with care.

## 2. What it shows (sections)
- **People** — list of profiles with add/edit (`repo.measurements()` → `GET /me/measurements`).
- **Garment charts** — per person, per garment fields from `GET /measurement-templates`.
- **Approve** — approve tailor-uploaded measurements (`repo.approveMeasurement`).

## 3. Buttons & actions
| Control | Action | Repo method | Result |
|---|---|---|---|
| Add/edit person | Save profile | `savePerson({...})` → `POST/PUT /me/measurements` | Saved |
| Delete person | Remove | `deleteMeasurement(id)` | Removed |
| Approve measurements | Confirm a tailor's chart | `approveMeasurement(id)` | Approved (unblocks stitching) |
| Book a measurement | Get measured | → tailor booking flow | Appointment |

## 4. Suggestions (improvements)
- **Now:** template-driven fields with units; people → garment → chart structure.
- **Next:** visual body diagram; copy from a previous person.
- **Later:** measurement history/versioning.

## 5. Dos & Don'ts
- **Do:** clear units; bilingual labels; explicit approval step.
- **Don't:** expose measurements beyond the assigned tailor.
- **Never:** share one person's measurements with another account.

## 6. Compliance — what's required
- **Sensitive personal data (PDPL):** minimise, restrict, retain for the order, deletable on request.
- Consent/purpose clear.

## 7. Secure · Reliable · Efficient
- **Secure:** scoped to the customer; deletable (account-deletion path).
- **Reliable:** templates load first; empty/error states; confirm delete.
- **Efficient:** templates cached; index `measurement_profiles(user_id)`.
