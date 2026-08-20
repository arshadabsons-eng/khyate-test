import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  IconDiscount,
  IconPlus,
  IconTrash,
  IconEdit,
  IconCheck,
  IconX,
  IconSearch,
  IconRocket,
  IconStar,
} from "@tabler/icons-react";
import { PlansPanel } from "@/components/inventory/PlansPanel";
import { LiquidTabs } from "@/components/common/LiquidTabs";
import { auth } from "@/lib/auth";
import {
  useDiscountCodes,
  useCreateDiscountCode,
  useUpdateDiscountCode,
  useDeactivateDiscountCode,
  useBoosterProducts,
  useSaveBoosterProduct,
  useActiveBoosts,
  useCancelBoost,
} from "@/lib/api/queries/promotions";
import type { BoosterProduct, DiscountCode } from "@/lib/api/types";
import { StatCard } from "@/components/common/StatCard";
import { DataTable } from "@/components/common/DataTable";
import { Card } from "@/components/common/Page";
import { ErrorState, LoadingRows, LoadingCards, NoData } from "@/components/common/AsyncStates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { aed, fmtDate } from "@/lib/format";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useMarketplaceCaps } from "@/lib/api/queries/policy";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/promotions")({ component: PromotionsPage });

// "Featured Listings" was removed — the featured_listings table has no INSERT
// path anywhere in the codebase (tailors can't buy a slot, nothing creates a
// row), so the tab could only ever show "no data." Featured placement is
// delivered by booster packs (tailor_boosts → boost_rank in browse ordering)
// and by each plan's own featured_slots cap (storefront slideshow), both of
// which are real and already surfaced elsewhere on this page.
const TABS = [
  { id: "plans", label: "Subscription Plans", icon: IconStar },
  { id: "boosts", label: "Booster Packs", icon: IconRocket },
  { id: "discount", label: "Discount Codes", icon: IconDiscount },
] as const;

type TabId = (typeof TABS)[number]["id"];

// Mirrors the exact checks backend/src/lib/promo-caps.js's exceedsMaxDuration
// enforces server-side (Math.ceil((end-start)/86400000) > cap) plus the
// percentage cap admin-extra.js's POST/PUT /discount-codes both apply — doing
// this client-side too means an admin sees exactly why before submitting,
// instead of a bare 422 after the fact. Same caps already surfaced to
// tailors on their own promotions page (tailor/promotions.tsx).
function capsViolation(
  form: {
    discount_type: "percentage" | "fixed_fils";
    discount_value: string;
    valid_from: string;
    valid_until: string;
  },
  caps: { max_discount_percentage: number; max_promotion_duration_days: number } | undefined,
): string | null {
  if (!caps) return null;
  if (
    form.discount_type === "percentage" &&
    Number(form.discount_value) > caps.max_discount_percentage
  ) {
    return `Discount cannot exceed ${caps.max_discount_percentage}%.`;
  }
  if (form.valid_until) {
    const days = Math.ceil(
      (new Date(form.valid_until).getTime() - new Date(form.valid_from).getTime()) / 86_400_000,
    );
    if (days > caps.max_promotion_duration_days) {
      return `Promotion duration cannot exceed ${caps.max_promotion_duration_days} days.`;
    }
  }
  return null;
}

function PromotionsPage() {
  const [tab, setTab] = useState<TabId>("plans");
  const canWrite = auth.adminRank() >= 2;

  return (
    <div>
      <LiquidTabs tabs={TABS} value={tab} onChange={(id) => setTab(id as TabId)} className="mb-6" />
      {tab === "plans" && <PlansPanel canWrite={canWrite} />}
      {tab === "boosts" && <BoostsTab />}
      {tab === "discount" && <DiscountTab />}
    </div>
  );
}

function BoostsTab() {
  const products = useBoosterProducts();
  const boosts = useActiveBoosts();
  const cancel = useCancelBoost();
  // No dedicated delete endpoint exists for booster products (and shouldn't —
  // tailor_boosts.product_id references these, so a hard delete could orphan
  // a tailor's past purchase history). The generic PUT already supports
  // toggling is_active; this reuses it the same way discount codes' own
  // Deactivate button does, just without a dedicated endpoint of its own.
  const toggleActive = useSaveBoosterProduct();
  const [edit, setEdit] = useState<Partial<BoosterProduct> | null>(null);

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Booster products</h3>
          <Button size="sm" onClick={() => setEdit({})}>
            <IconPlus size={15} className="mr-1.5" /> New product
          </Button>
        </div>
        {products.isError ? (
          <ErrorState
            error={products.error}
            onRetry={() => products.refetch()}
            title="Couldn't load booster products"
          />
        ) : products.isLoading ? (
          <LoadingRows cols={5} rows={3} />
        ) : (
          <DataTable
            rows={products.data ?? []}
            emptyMessage="No booster products yet"
            columns={[
              {
                header: "Name",
                accessor: (p) => (
                  <div>
                    <div className="font-medium">{p.name}</div>
                    {p.name_ar && (
                      <div className="text-xs text-muted-foreground" dir="rtl">
                        {p.name_ar}
                      </div>
                    )}
                  </div>
                ),
              },
              { header: "Price", accessor: (p) => aed(p.price_fils) },
              { header: "Duration", accessor: (p) => `${p.duration_days} days` },
              { header: "Weight", accessor: (p) => p.boost_weight },
              {
                header: "Active",
                accessor: (p) => (
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.is_active ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}`}
                  >
                    {p.is_active ? "Active" : "Off"}
                  </span>
                ),
              },
              {
                header: "",
                accessor: (p) => (
                  <div className="flex items-center gap-2 justify-end">
                    <Button
                      size="icon"
                      variant="ghost"
                      title="Edit"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEdit(p);
                      }}
                    >
                      <IconEdit size={15} />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={
                        p.is_active ? "text-destructive border-red-200 hover:bg-red-50" : ""
                      }
                      disabled={toggleActive.isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleActive.mutate(
                          { id: p.id, is_active: !p.is_active },
                          {
                            onError: (err: unknown) =>
                              toast.error(
                                (err as Error)?.message || "Couldn't update this booster product",
                              ),
                          },
                        );
                      }}
                    >
                      {p.is_active ? "Deactivate" : "Reactivate"}
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        )}
      </section>

      <section className="space-y-4">
        <h3 className="font-semibold">Active boosts</h3>
        {boosts.isLoading ? (
          <LoadingRows cols={4} rows={3} />
        ) : !boosts.data?.length ? (
          <NoData
            title="No active boosts"
            description="Tailors purchase boosts from their subscription page."
          />
        ) : (
          <DataTable
            rows={boosts.data ?? []}
            columns={[
              {
                header: "Tailor",
                accessor: (b) => <span className="font-medium">{b.tailor_name}</span>,
              },
              { header: "Product", accessor: (b) => b.product_name ?? "—" },
              { header: "Weight", accessor: (b) => b.boost_weight },
              { header: "Ends", accessor: (b) => fmtDate(b.ends_at) },
              {
                header: "",
                accessor: (b) => (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive border-red-200 hover:bg-red-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      cancel.mutate(b.id, {
                        onError: (err: unknown) =>
                          toast.error((err as Error)?.message || "Couldn't cancel this boost"),
                      });
                    }}
                    disabled={cancel.isPending}
                  >
                    Cancel
                  </Button>
                ),
              },
            ]}
          />
        )}
      </section>

      {edit && <BoosterProductDialog product={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function BoosterProductDialog({
  product,
  onClose,
}: {
  product: Partial<BoosterProduct>;
  onClose: () => void;
}) {
  const save = useSaveBoosterProduct();
  const [form, setForm] = useState({
    name: product.name ?? "",
    name_ar: product.name_ar ?? "",
    price_aed: product.price_fils != null ? String(product.price_fils / 100) : "",
    duration_days: product.duration_days != null ? String(product.duration_days) : "7",
    boost_weight: product.boost_weight != null ? String(product.boost_weight) : "100",
    is_active: product.is_active ?? true,
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    save.mutate(
      {
        id: product.id,
        name: form.name,
        name_ar: form.name_ar || undefined,
        price_fils: Math.round(Number(form.price_aed) * 100) || 0,
        duration_days: Number(form.duration_days) || 7,
        boost_weight: Number(form.boost_weight) || 100,
        is_active: form.is_active,
      },
      {
        onSuccess: onClose,
        onError: (err: unknown) =>
          toast.error((err as Error)?.message || "Couldn't save this booster product"),
      },
    );
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{product.id ? "Edit booster" : "New booster"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="7-Day Spotlight"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Name (Arabic, optional)</Label>
            <Input
              value={form.name_ar}
              onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
              dir="rtl"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Price (AED)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.price_aed}
                onChange={(e) => setForm({ ...form, price_aed: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Days</Label>
              <Input
                type="number"
                value={form.duration_days}
                onChange={(e) => setForm({ ...form, duration_days: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Weight</Label>
              <Input
                type="number"
                value={form.boost_weight}
                onChange={(e) => setForm({ ...form, boost_weight: e.target.value })}
                required
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />{" "}
            Active (available to tailors)
          </label>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DiscountTab() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<DiscountCode | null>(null);
  const dSearch = useDebouncedValue(search, 300);

  const { data, isLoading, isError, error, refetch } = useDiscountCodes(page, dSearch || undefined);
  const deactivateMutation = useDeactivateDiscountCode();

  const kpi = data?.kpi;

  return (
    <div className="space-y-5">
      {/* KPIs */}
      {!isLoading && kpi && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Active Codes" value={kpi.total_active} icon={IconDiscount} />
          <StatCard label="Total Uses" value={kpi.total_uses} icon={IconDiscount} />
          <StatCard
            label="GMV Attributed"
            value={aed(kpi.total_gmv_attributed_fils)}
            icon={IconDiscount}
          />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <IconSearch
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Search code…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-8"
          />
        </div>
        <Button size="sm" className="ml-auto" onClick={() => setCreateOpen(true)}>
          <IconPlus size={15} className="mr-1.5" /> New Code
        </Button>
      </div>

      {/* Table */}
      {isError ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : isLoading && !data ? (
        <LoadingRows cols={7} rows={8} />
      ) : (
        <DataTable
          columns={[
            {
              header: "Code",
              accessor: (r) => (
                <span className="font-mono font-semibold tracking-wide">{r.code}</span>
              ),
            },
            {
              header: "Discount",
              accessor: (r) =>
                r.discount_type === "percentage" ? `${r.discount_value}%` : aed(r.discount_value),
            },
            {
              header: "Min. Order",
              accessor: (r) => (r.min_order_fils ? aed(r.min_order_fils) : "—"),
            },
            {
              header: "Uses",
              accessor: (r) => (
                <span>
                  {r.uses_count}
                  {r.max_uses ? ` / ${r.max_uses}` : ""}
                </span>
              ),
            },
            {
              header: "GMV",
              accessor: (r) => aed(r.gmv_attributed_fils),
            },
            {
              header: "Valid Until",
              accessor: (r) => (r.valid_until ? fmtDate(r.valid_until) : "No expiry"),
            },
            {
              header: "Status",
              accessor: (r) => (
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${r.is_active ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}`}
                >
                  {r.is_active ? "Active" : "Inactive"}
                </span>
              ),
            },
            {
              header: "",
              accessor: (r) => (
                <div className="flex items-center gap-2 justify-end">
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Edit"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditing(r);
                    }}
                  >
                    <IconEdit size={15} />
                  </Button>
                  {r.is_active && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive border-red-200 hover:bg-red-50"
                      onClick={(e) => {
                        e.stopPropagation();
                        deactivateMutation.mutate(r.id, {
                          onError: (err: unknown) =>
                            toast.error((err as Error)?.message || "Couldn't deactivate this code"),
                        });
                      }}
                      disabled={deactivateMutation.isPending}
                    >
                      Deactivate
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
          rows={data?.data ?? []}
          pagination={{
            page: data?.page ?? 1,
            totalPages: data?.total_pages ?? 1,
            onPageChange: setPage,
          }}
        />
      )}

      <CreateCodeDialog open={createOpen} onClose={() => setCreateOpen(false)} />
      {editing && <EditCodeDialog code={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function CreateCodeDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({
    code: "",
    discount_type: "percentage" as "percentage" | "fixed_fils",
    discount_value: "",
    min_order_fils: "",
    max_uses: "",
    valid_from: new Date().toISOString().slice(0, 10),
    valid_until: "",
  });
  const createMutation = useCreateDiscountCode();
  const caps = useMarketplaceCaps().data;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const violation = capsViolation(form, caps);
    if (violation) {
      toast.error(violation);
      return;
    }
    createMutation.mutate(
      {
        code: form.code.toUpperCase(),
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        min_order_fils: form.min_order_fils ? Number(form.min_order_fils) : undefined,
        max_uses: form.max_uses ? Number(form.max_uses) : undefined,
        valid_from: form.valid_from,
        valid_until: form.valid_until || undefined,
      },
      {
        onSuccess: onClose,
        onError: (err: unknown) =>
          toast.error((err as Error)?.message || "Couldn't create this discount code"),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Discount Code</DialogTitle>
        </DialogHeader>
        {caps && (
          <p className="text-xs text-muted-foreground -mt-2">
            Platform caps: max <b>{caps.max_promotion_duration_days} days</b> duration · max{" "}
            <b>{caps.max_discount_percentage}%</b> discount.
          </p>
        )}
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Code</Label>
            <Input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="SUMMER25"
              className="font-mono uppercase"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={form.discount_type}
                onValueChange={(v) =>
                  setForm({ ...form, discount_type: v as "percentage" | "fixed_fils" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="fixed_fils">Fixed Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Value {form.discount_type === "percentage" ? "(%)" : "(fils)"}</Label>
              <Input
                type="number"
                value={form.discount_value}
                onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Min. Order (fils, optional)</Label>
              <Input
                type="number"
                value={form.min_order_fils}
                onChange={(e) => setForm({ ...form, min_order_fils: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Max Uses (optional)</Label>
              <Input
                type="number"
                value={form.max_uses}
                onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valid From</Label>
              <Input
                type="date"
                value={form.valid_from}
                onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Valid Until (optional)</Label>
              <Input
                type="date"
                value={form.valid_until}
                onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating…" : "Create Code"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditCodeDialog({ code, onClose }: { code: DiscountCode; onClose: () => void }) {
  const [form, setForm] = useState({
    discount_type: code.discount_type,
    discount_value: String(code.discount_value),
    min_order_fils: code.min_order_fils != null ? String(code.min_order_fils) : "",
    max_uses: code.max_uses != null ? String(code.max_uses) : "",
    valid_from: code.valid_from.slice(0, 10),
    valid_until: code.valid_until ? code.valid_until.slice(0, 10) : "",
  });
  const updateMutation = useUpdateDiscountCode();
  const caps = useMarketplaceCaps().data;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const violation = capsViolation(form, caps);
    if (violation) {
      toast.error(violation);
      return;
    }
    updateMutation.mutate(
      {
        id: code.id,
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        min_order_fils: form.min_order_fils ? Number(form.min_order_fils) : 0,
        max_uses: form.max_uses ? Number(form.max_uses) : undefined,
        valid_from: form.valid_from,
        valid_until: form.valid_until || undefined,
      },
      {
        onSuccess: onClose,
        onError: (err: unknown) =>
          toast.error((err as Error)?.message || "Couldn't save this discount code"),
      },
    );
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Discount Code</DialogTitle>
        </DialogHeader>
        {caps && (
          <p className="text-xs text-muted-foreground -mt-2">
            Platform caps: max <b>{caps.max_promotion_duration_days} days</b> duration · max{" "}
            <b>{caps.max_discount_percentage}%</b> discount.
          </p>
        )}
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Code</Label>
            <Input value={code.code} disabled className="font-mono uppercase" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={form.discount_type}
                onValueChange={(v) =>
                  setForm({ ...form, discount_type: v as "percentage" | "fixed_fils" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="fixed_fils">Fixed Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Value {form.discount_type === "percentage" ? "(%)" : "(fils)"}</Label>
              <Input
                type="number"
                value={form.discount_value}
                onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Min. Order (fils, optional)</Label>
              <Input
                type="number"
                value={form.min_order_fils}
                onChange={(e) => setForm({ ...form, min_order_fils: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Max Uses (optional)</Label>
              <Input
                type="number"
                value={form.max_uses}
                onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Valid From</Label>
              <Input
                type="date"
                value={form.valid_from}
                onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Valid Until (optional)</Label>
              <Input
                type="date"
                value={form.valid_until}
                onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
