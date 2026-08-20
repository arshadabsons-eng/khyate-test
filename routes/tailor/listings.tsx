import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { IconPlus, IconEdit, IconTrash } from "@tabler/icons-react";
import { Card } from "@/components/common/Page";
import { DataTable } from "@/components/common/DataTable";
import { BlurImage } from "@/components/common/BlurImage";
import { StatusBadge } from "@/components/common/StatusBadge";
import { StatCard } from "@/components/common/StatCard";
import { ErrorState, LoadingRows } from "@/components/common/AsyncStates";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  useTailorListings,
  useUpsertListing,
  useDeleteListing,
  useTailorProfile,
} from "@/lib/api/queries/tailor";
import {
  useMaterialsCatalog,
  useGarmentsPublic,
  useStyleCategories,
  useSizesPublic,
} from "@/lib/api/queries/inventory";
import { apiClient } from "@/lib/api/client";
import { filsToAed, fmtNumber } from "@/lib/format";
import { labelize } from "@/components/inventory/options";
import type { TailorListingRow, OrderType } from "@/lib/api/types";
import { Textarea } from "@/components/ui/textarea";
import { IconPhoto } from "@tabler/icons-react";
import { useRef } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/tailor/listings")({ component: ListingsPage });

// Two product/service modes a tailor can offer. Alteration is no longer its own
// type — it's a priced toggle on a custom_stitch (service) entry, since both
// custom-stitch and alteration are services performed on a garment and share
// the same single reference image (unlike readymade, which is a product with
// its own multi-image gallery, sizes and stock).
const TYPES: OrderType[] = ["readymade", "custom_stitch"];
const TYPE_LABELS: Record<string, string> = {
  readymade: "Product (Readymade)",
  custom_stitch: "Service (Stitching / Altering)",
  material: "Material", // legacy listings only
};
const priceLabel = (t: string) =>
  t === "custom_stitch" ? "Fabric / base stitching price (AED)" : "Price (AED)";

function emptyListing(gender?: "men" | "women" | "kids"): TailorListingRow {
  return {
    id: "",
    title: "",
    title_ar: "",
    listing_type: "readymade",
    garment_slug: null,
    garment_name: null,
    style_category_id: null,
    style_category_name: null,
    base_price_fils: 0,
    stitching_cost_fils: null,
    stock: 0,
    order_count: 0,
    status: "draft",
    rejection_reason: null,
    colors: [],
    sizes: [],
    material_id: null,
    created_at: "",
    image_urls: [],
    description: "",
    // Pre-filled when adding from a filtered Men/Women/Kids tab; otherwise the
    // tailor must consciously pick one so listings never end up mis-tagged (or
    // leaking as "unisex").
    gender: gender ?? "",
    alteration_available: false,
    alteration_price_fils: null,
  };
}

// Size runs by audience. The listing's "Who it's for" (Men/Women/Kids) decides
// which run the tailor sees: adults get lettered sizes, kids/teens get age sizes
// (infant → teen). Tailors can still add a custom label.
// Fallback only — the real source is the admin-managed Inventory → Sizes tab
// (useSizesPublic), used only if the admin hasn't configured any sizes yet.
const ADULT_SIZES: string[] = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];
const KIDS_SIZES: string[] = ["3M", "6M", "1Y", "2Y", "4Y", "6Y", "8Y", "10Y", "12Y", "14Y", "16Y"];

const srcOf = (u: string) => u;

const GENDER_TABS = [
  { value: "all", label: "All" },
  { value: "men", label: "Men" },
  { value: "women", label: "Women" },
  { value: "kids", label: "Kids" },
] as const;
type GenderFilter = (typeof GENDER_TABS)[number]["value"];

function ListingsPage() {
  const q = useTailorListings();
  const upsert = useUpsertListing();
  const del = useDeleteListing();
  const [form, setForm] = useState<TailorListingRow | null>(null);
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");
  const [deleteTarget, setDeleteTarget] = useState<TailorListingRow | null>(null);

  const mutationErrorToast = (fallback: string) => (e: unknown) =>
    toast.error((e as Error)?.message || fallback);

  const allRows = q.data ?? [];
  const counts = {
    all: allRows.length,
    men: allRows.filter((l) => l.gender === "men").length,
    women: allRows.filter((l) => l.gender === "women").length,
    kids: allRows.filter((l) => l.gender === "kids").length,
  };
  // Filter to one audience at a time so a tailor with a large, mixed catalogue can
  // actually find and manage their Men's / Women's / Kids' listings separately.
  const rows = genderFilter === "all" ? allRows : allRows.filter((l) => l.gender === genderFilter);
  const active = rows.filter((l) => l.status === "active").length;
  const orders = rows.reduce((s, l) => s + Number(l.order_count), 0);

  // Tailors publish their own listings (they're already verified). Activating
  // requires a price, and stock for readymade pieces.
  function toggleActive(l: TailorListingRow) {
    // Admin-removed listings can't be toggled by the tailor.
    if (l.status === "rejected") {
      toast.error(
        "This listing was removed by Khyate. Contact support if you think it's a mistake.",
      );
      return;
    }
    if (l.status === "active") {
      upsert.mutate(
        { id: l.id, body: { status: "inactive" } },
        {
          onSuccess: () => toast.success(`"${l.title}" is now hidden`),
          onError: (e: unknown) =>
            toast.error((e as Error)?.message || "Couldn't update the listing."),
        },
      );
      return;
    }
    if (!l.base_price_fils || l.base_price_fils <= 0) {
      toast.error("Add a price before making this listing live.");
      return;
    }
    if (l.listing_type === "readymade" && (l.stock ?? 0) <= 0) {
      toast.error("Add stock before making this readymade listing live.");
      return;
    }
    upsert.mutate(
      { id: l.id, body: { status: "active" } },
      {
        onSuccess: () => toast.success(`"${l.title}" is now live`),
        onError: (e: unknown) =>
          toast.error((e as Error)?.message || "Couldn't publish the listing."),
      },
    );
  }

  function confirmDeleteListing() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    del.mutate(target.id, {
      onSuccess: () => toast.success(`"${target.title}" deleted`),
      onError: mutationErrorToast("Couldn't delete the listing"),
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Listings" value={rows.length} />
        <StatCard label="Active" value={active} />
        <StatCard label="Inactive" value={rows.filter((l) => l.status !== "active").length} />
        <StatCard label="Lifetime orders" value={fmtNumber(orders)} />
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Tabs value={genderFilter} onValueChange={(v) => setGenderFilter(v as GenderFilter)}>
          <TabsList>
            {GENDER_TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label} ({counts[t.value]})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button
          size="sm"
          onClick={() => setForm(emptyListing(genderFilter === "all" ? undefined : genderFilter))}
        >
          <IconPlus size={15} className="mr-1" /> New listing
        </Button>
      </div>

      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} title="Couldn't load listings" />
      ) : q.isLoading && !q.data ? (
        <LoadingRows cols={6} rows={6} />
      ) : (
        <DataTable
          rows={rows}
          emptyMessage={
            genderFilter === "all"
              ? "No listings yet"
              : `No ${GENDER_TABS.find((t) => t.value === genderFilter)?.label} listings yet`
          }
          columns={[
            {
              header: "",
              id: "thumb",
              accessor: (l) => (
                <button
                  type="button"
                  data-no-row
                  title="Edit listing"
                  onClick={() => setForm(l)}
                  className="block w-12 h-12 rounded-md overflow-hidden border bg-muted shrink-0 hover:ring-2 hover:ring-primary/30 transition-shadow"
                >
                  <BlurImage src={l.image_urls?.[0]} alt={l.title} className="w-full h-full" />
                </button>
              ),
            },
            {
              header: "Title",
              accessor: (l) => (
                <div>
                  <div className="font-medium">{l.title}</div>
                  <div className="text-xs text-muted-foreground" dir="rtl">
                    {l.title_ar}
                  </div>
                </div>
              ),
            },
            {
              header: "Type",
              accessor: (l) => {
                const badgeClass =
                  l.listing_type === "readymade"
                    ? "bg-primary/10 text-primary"
                    : "bg-amber-100 text-amber-800";
                return (
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badgeClass}`}>
                      {TYPE_LABELS[l.listing_type] ?? labelize(l.listing_type)}
                    </span>
                    {l.listing_type === "custom_stitch" && l.alteration_available && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-sky-100 text-sky-800">
                        Alteration
                      </span>
                    )}
                  </div>
                );
              },
            },
            { header: "Garment", accessor: (l) => l.garment_name ?? "—" },
            { header: "Style", accessor: (l) => l.style_category_name ?? "—" },
            {
              header: "For",
              accessor: (l) => (l.gender ? labelize(l.gender) : "—"),
            },
            {
              header: "Price",
              accessor: (l) => (
                <span>
                  {filsToAed(l.base_price_fils)}
                  {l.listing_type === "custom_stitch" && l.stitching_cost_fils ? (
                    <span className="text-xs text-muted-foreground">
                      {" "}
                      + {filsToAed(l.stitching_cost_fils)} stitch
                    </span>
                  ) : (
                    ""
                  )}
                </span>
              ),
            },
            {
              header: "Stock",
              accessor: (l) =>
                l.listing_type === "readymade" ? `${l.stock ?? 0}` : "made-to-measure",
            },
            { header: "Status", accessor: (l) => <StatusBadge status={l.status} /> },
            {
              header: "Actions",
              accessor: (l) => {
                const isActive = l.status === "active";
                return (
                  <div className="flex items-center gap-1" data-no-row>
                    <button
                      type="button"
                      className="p-1 rounded hover:bg-muted"
                      title="Edit"
                      onClick={() => setForm(l)}
                    >
                      <IconEdit size={15} />
                    </button>
                    {/* Active toggle — works from any status so the tailor can publish directly. */}
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded hover:bg-muted"
                      title={isActive ? "Make inactive" : "Make live"}
                      disabled={upsert.isPending}
                      onClick={() => toggleActive(l)}
                    >
                      <span
                        className={`w-8 h-4 rounded-full relative transition-colors ${isActive ? "bg-primary" : "bg-muted-foreground/30"}`}
                      >
                        <span
                          className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${isActive ? "left-4" : "left-0.5"}`}
                        />
                      </span>
                      {isActive ? "Active" : "Inactive"}
                    </button>
                    <button
                      type="button"
                      className="p-1 rounded hover:bg-muted text-destructive"
                      title="Delete"
                      disabled={del.isPending}
                      onClick={() => setDeleteTarget(l)}
                    >
                      <IconTrash size={15} />
                    </button>
                  </div>
                );
              },
            },
          ]}
        />
      )}

      {form && <ListingDialog listing={form} onClose={() => setForm(null)} />}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={`Delete "${deleteTarget?.title}"?`}
        description="This can't be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDeleteListing}
      />
    </div>
  );
}

function ListingDialog({ listing, onClose }: { listing: TailorListingRow; onClose: () => void }) {
  const [l, setL] = useState<TailorListingRow>(listing);
  const upsert = useUpsertListing();
  const mutationErrorToast = (fallback: string) => (e: unknown) =>
    toast.error((e as Error)?.message || fallback);
  const isEdit = !!listing.id;
  const set = (patch: Partial<TailorListingRow>) => setL((p) => ({ ...p, ...patch }));
  const cats = useMaterialsCatalog();
  const profile = useTailorProfile();
  // Garment options come from the admin-managed catalog — an empty
  // admin-configured list shows an empty dropdown, not a stale hardcoded fallback.
  const garmentsQ = useGarmentsPublic();
  const styleCategoriesQ = useStyleCategories();
  const sizesQ = useSizesPublic();
  // Admin-managed size labels (the Inventory → Sizes tab), gender-filtered —
  // falls back to the old hardcoded lists only if the admin hasn't configured
  // any sizes for that gender yet, so this can never leave the picker empty.
  const adminSizes = (sizesQ.data ?? [])
    .filter((s) => (l.gender === "kids" ? s.gender === "kids" : s.gender !== "kids"))
    .map((s) => s.label);
  const sizeOptions = adminSizes.length
    ? adminSizes
    : l.gender === "kids"
      ? KIDS_SIZES
      : ADULT_SIZES;
  const imgLimit = profile.data?.listing_image_limit ?? 1;
  const imgInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function addImages(files: FileList | null) {
    if (!files?.length) return;
    const room = imgLimit - (l.image_urls?.length ?? 0);
    if (room <= 0) {
      toast.error(
        `Your plan allows up to ${imgLimit} image${imgLimit === 1 ? "" : "s"} per listing. Upgrade for more.`,
      );
      return;
    }
    const picked = Array.from(files).slice(0, room);
    if (picked.length < files.length)
      toast.message(`Only ${room} more image(s) allowed on your plan.`);
    setUploading(true);
    try {
      const uploaded = await Promise.all(picked.map((f) => apiClient.uploadFile(f)));
      set({ image_urls: [...(l.image_urls ?? []), ...uploaded.map((u) => u.url)] });
    } catch (e: unknown) {
      toast.error((e as Error).message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!l.title.trim()) return;
    if (!["men", "women", "kids"].includes(String(l.gender))) {
      toast.error("Choose who it's for — Men, Women or Kids");
      return;
    }
    const { id, order_count, created_at, ...body } = l;
    upsert.mutate(
      { id: isEdit ? id : undefined, body },
      { onSuccess: onClose, onError: mutationErrorToast("Couldn't save the listing") },
    );
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit listing" : "New listing"}</DialogTitle>
          <DialogDescription className="sr-only">
            Configure your listing details, pricing, images and visibility.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Title (EN)">
              <Input value={l.title} onChange={(e) => set({ title: e.target.value })} required />
            </Field>
            <Field label="Title (AR)">
              <Input
                value={l.title_ar}
                onChange={(e) => set({ title_ar: e.target.value })}
                dir="rtl"
              />
            </Field>
            <Field label="Type">
              <Select
                value={l.listing_type}
                onValueChange={(v) => set({ listing_type: v as OrderType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TYPE_LABELS[t] ?? labelize(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Garment">
              <Select value={l.garment_slug ?? ""} onValueChange={(v) => set({ garment_slug: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a garment" />
                </SelectTrigger>
                <SelectContent>
                  {(garmentsQ.data ?? []).map((g) => (
                    <SelectItem key={g.slug} value={g.slug}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Style">
              <Select
                value={l.style_category_id ?? ""}
                onValueChange={(v) => set({ style_category_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a style" />
                </SelectTrigger>
                <SelectContent>
                  {(styleCategoriesQ.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {l.listing_type === "custom_stitch" && (
              <Field label="Fabric used (from catalog)">
                <Select
                  value={l.material_id ?? "none"}
                  onValueChange={(v) => set({ material_id: v === "none" ? null : v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(cats.data?.data ?? []).map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field label={priceLabel(l.listing_type)}>
              <Input
                type="number"
                value={l.base_price_fils / 100 || 0}
                onChange={(e) => set({ base_price_fils: Math.round(Number(e.target.value) * 100) })}
              />
            </Field>
            {l.listing_type === "custom_stitch" && (
              <Field label="Stitching cost (AED)">
                <Input
                  type="number"
                  value={(l.stitching_cost_fils ?? 0) / 100 || 0}
                  onChange={(e) =>
                    set({ stitching_cost_fils: Math.round(Number(e.target.value) * 100) })
                  }
                />
              </Field>
            )}
            {l.listing_type === "readymade" && (
              <Field label="Stock (units)">
                <Input
                  type="number"
                  value={l.stock ?? 0}
                  onChange={(e) => set({ stock: Number(e.target.value) })}
                />
              </Field>
            )}
          </div>

          <Field label="Description (EN)">
            <Textarea
              rows={2}
              value={l.description ?? ""}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="Describe the piece, fabric, craftsmanship…"
            />
          </Field>

          <Field label="Who it's for">
            <Select value={l.gender || ""} onValueChange={(v) => set({ gender: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Choose Men, Women or Kids" />
              </SelectTrigger>
              <SelectContent>
                {["men", "women", "kids"].map((g) => (
                  <SelectItem key={g} value={g}>
                    {labelize(g)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={`Photos (${l.image_urls?.length ?? 0} / ${imgLimit})`}>
            <input
              ref={imgInput}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => addImages(e.target.files)}
            />
            <div className="flex flex-wrap gap-2">
              {(l.image_urls ?? []).map((url, i) => (
                <div key={i} className="relative w-20 h-20 rounded-md overflow-hidden border group">
                  <img src={srcOf(url)} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    title="Remove"
                    aria-label="Remove photo"
                    className="absolute top-0.5 right-0.5 p-1 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100"
                    onClick={() =>
                      set({ image_urls: (l.image_urls ?? []).filter((_, j) => j !== i) })
                    }
                  >
                    <IconTrash size={12} />
                  </button>
                </div>
              ))}
              {(l.image_urls?.length ?? 0) < imgLimit && (
                <button
                  type="button"
                  onClick={() => imgInput.current?.click()}
                  disabled={uploading}
                  title="Add photo"
                  aria-label="Add photo"
                  className="w-20 h-20 rounded-md border border-dashed grid place-items-center text-muted-foreground hover:bg-muted"
                >
                  <IconPhoto size={20} />
                </button>
              )}
            </div>
            {uploading && <p className="text-xs text-muted-foreground mt-1">Uploading…</p>}
          </Field>

          <Field label="Colours (hex)">
            <div className="flex flex-wrap items-center gap-2">
              {l.colors.map((c, i) => (
                <span key={i} className="flex items-center gap-1">
                  <input
                    type="color"
                    value={c}
                    aria-label="colour"
                    className="h-8 w-8 rounded-full border p-0 cursor-pointer"
                    onChange={(e) => {
                      const a = l.colors.slice();
                      a[i] = e.target.value;
                      set({ colors: a });
                    }}
                  />
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive text-xs"
                    onClick={() => set({ colors: l.colors.filter((_, j) => j !== i) })}
                  >
                    ×
                  </button>
                </span>
              ))}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => set({ colors: [...l.colors, "#cccccc"] })}
              >
                + colour
              </Button>
            </div>
          </Field>

          {l.listing_type === "readymade" && (
            <Field
              label={l.gender === "kids" ? "Sizes available (kids & teen)" : "Sizes available"}
            >
              <div className="flex flex-wrap items-center gap-2">
                {sizeOptions.map((s) => {
                  const on = (l.sizes ?? []).includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() =>
                        set({
                          sizes: on
                            ? (l.sizes ?? []).filter((x) => x !== s)
                            : [...(l.sizes ?? []), s],
                        })
                      }
                      className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors ${
                        on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input hover:bg-muted"
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
                {/* Custom sizes (e.g. "38", "One size") the tailor typed */}
                {(l.sizes ?? [])
                  .filter((s) => !sizeOptions.includes(s))
                  .map((s) => (
                    <span
                      key={s}
                      className="px-3 py-1.5 rounded-md border border-primary bg-primary text-primary-foreground text-sm font-medium flex items-center gap-1"
                    >
                      {s}
                      <button
                        type="button"
                        aria-label={`Remove ${s}`}
                        onClick={() => set({ sizes: (l.sizes ?? []).filter((x) => x !== s) })}
                        className="hover:text-destructive-foreground/80"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                <Input
                  className="w-28 h-9"
                  placeholder="+ custom"
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    const v = e.currentTarget.value.trim().toUpperCase();
                    if (v && !(l.sizes ?? []).includes(v)) set({ sizes: [...(l.sizes ?? []), v] });
                    e.currentTarget.value = "";
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Only the sizes you toggle here show on the customer app — leave empty for one-size
                items.
              </p>
            </Field>
          )}

          {l.listing_type === "custom_stitch" && (
            <div className="rounded-lg border p-3 space-y-3">
              <p className="text-xs text-muted-foreground">
                Made-to-measure: final fabric &amp; fit are computed from the customer's
                measurements at order time. This reference image is also shown if you offer
                alteration for this garment below.
              </p>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={l.alteration_available}
                  onChange={(e) => set({ alteration_available: e.target.checked })}
                  className="h-4 w-4 rounded border-input"
                />
                Also offer alteration for this garment
              </label>
              {l.alteration_available && (
                <Field label="Alteration fee (AED)">
                  <Input
                    type="number"
                    value={(l.alteration_price_fils ?? 0) / 100 || 0}
                    onChange={(e) =>
                      set({ alteration_price_fils: Math.round(Number(e.target.value) * 100) })
                    }
                  />
                </Field>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={upsert.isPending}>
              {upsert.isPending ? "Saving…" : isEdit ? "Save" : "Create draft"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
