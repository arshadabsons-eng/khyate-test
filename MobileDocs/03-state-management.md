# 03 · State Management

**Riverpod** is the single state solution. UI watches providers; providers call repositories; repositories call the API/Supabase. No business logic in widgets.

## Layers

```
Widget ──watch──▶ Provider/Notifier ──▶ Repository ──▶ ApiClient / Supabase
                      │                                    │
                  AsyncValue<T>                       fils, *_ar, RLS-scoped
```

- **Models** (`data/models`) mirror `khyate-admin-hub/src/lib/api/types.ts` as immutable Dart classes (`freezed` recommended) with `fromJson`/`toJson`.
- **Repositories** (`data/repositories`) own one entity area each (Tailor, Listing, Order, Material, Measurement, Cart, Review, Dispute, Notification). They convert API DTOs ↔ models and expose `Future`/`Stream`.
- **Providers** wrap repository calls in `AsyncValue` and hold UI state.

## Provider catalogue (representative)

| Provider | Type | Purpose |
| --- | --- | --- |
| `authStateProvider` | `StreamProvider<AuthState>` | current session; router watches it |
| `currentCustomerProvider` | `FutureProvider<Customer>` | profile |
| `homeFeedProvider` | `FutureProvider<HomeFeed>` | featured + categories |
| `searchResultsProvider(filters)` | `AsyncNotifier` (paginated) | discovery + infinite scroll |
| `tailorProvider(id)` | `FutureProvider.family` | tailor profile |
| `listingProvider(id)` | `FutureProvider.family` | listing detail |
| `materialsProvider(tailorId)` | `FutureProvider.family` | fabrics offered |
| `cartProvider` | `NotifierProvider` | line items, single-tailor rule, totals |
| `customOrderDraftProvider` | `NotifierProvider` | multi-step custom-stitch wizard state |
| `ordersProvider` | `AsyncNotifier` | order list |
| `orderProvider(id)` | `FutureProvider.family` | order detail |
| `orderMessagesProvider(id)` | `StreamProvider.family` | realtime chat |
| `measurementsProvider` | `AsyncNotifier` | measurement profiles CRUD |
| `savedTailorsProvider` | `AsyncNotifier` | saved/heart toggles |
| `notificationsProvider` | `StreamProvider` | bell feed |

## Async pattern

Every screen renders `AsyncValue` uniformly:

```dart
final orders = ref.watch(ordersProvider);
return orders.when(
  loading: () => const KListSkeleton(),
  error: (e, _) => KErrorState(error: e, onRetry: () => ref.invalidate(ordersProvider)),
  data: (list) => list.isEmpty ? const KEmptyState(...) : OrderList(list),
);
```

## Mutations & invalidation

- Mutating actions live on notifiers (e.g. `cartProvider.addItem`, `ordersProvider.confirmDelivery`).
- After a successful write, `ref.invalidate(...)` the affected providers (parallels the admin hub's `invalidateQueries`).
- Use optimistic updates for cart and message-send; reconcile on server response.

## Cart & the single-tailor rule

`cartProvider` enforces: all items share one `tailor_id`. Adding an item from a different tailor throws a `DifferentTailorException` the UI catches to show the "switch tailor / clear cart" modal (see [05-flows.md](05-flows.md)).

## Realtime

- `orderMessagesProvider(id)` and `notificationsProvider` are `StreamProvider`s backed by Supabase channels; they push updates without polling.

## Persistence / offline

- Session in `flutter_secure_storage`; cart + last feed cached (e.g. `shared_preferences`) for a warm cold-start.
- `cached_network_image` for all remote media.
