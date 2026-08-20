# Order chat / Support

> **Screen:** `features/orders/order_chat_screen.dart` · **Audience:** customer

## 1. Purpose
Direct messaging about an order — with the tailor and/or support. The always-reachable help
channel that resolves questions before they become disputes.

## 2. What it shows (sections)
- **Message thread** — bubbles, input box, auto-scroll. **Currently UI-only/stub** — needs wiring to the real `message_threads`/`messages` API.
- Entry from an order and (planned) from Account → Contact support.

## 3. Buttons & actions
| Control | Action | Endpoint / repo | Result |
|---|---|---|---|
| Send message | Post to thread | `POST /messages/threads/:id/reply` (to wire) | Persisted message |
| Open thread | Load history | `GET /messages/threads/:id` (to wire) | Messages |
| Contact support | Start a thread | `POST /support/threads` (to wire) | New support thread |

## 4. Suggestions (improvements)
- **Now:** wire the screen to the real messaging backend (admin inbox already consumes it — see [../../AdminDocs/pages/13-notifications.md](../../AdminDocs/pages/13-notifications.md)).
- **Next:** polling/refresh; unread badges; attach a photo (evidence).
- **Later:** websockets; canned-question chips.

## 5. Dos & Don'ts
- **Do:** plain bilingual UI; persist messages; one-tap support entry.
- **Don't:** leave it as a local stub in production.
- **Never:** expose the other party's private contact/PII; never log message contents insecurely.

## 6. Compliance — what's required
- Reachable support (consumer protection + app-store); report/block for abuse.
- Chat is PII — participants + support only; retained through the order/dispute window (PDPL).

## 7. Secure · Reliable · Efficient
- **Secure:** thread access limited to participants + support; HTTPS.
- **Reliable:** handle send failures; offline queue; empty state.
- **Efficient:** paginate messages; mark-read scoped; lightweight polling.
