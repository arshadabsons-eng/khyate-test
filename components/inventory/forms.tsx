import { useRef, useState, type ReactNode } from "react";
import {
  IconPlus,
  IconTrash,
  IconInfoCircle,
  IconCircleCheck,
  IconCircleX,
  IconPhoto,
} from "@tabler/icons-react";
import { apiClient } from "@/lib/api/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/common/StatusBadge";
import { CategoryIcon } from "./CategoryIcon";
import {
  QUALITY_TIERS,
  GENDERS,
  WEAVE_TYPES,
  SEASONS,
  PROPERTY_OPTIONS,
  CERT_PRESETS,
  CATEGORY_ICON_NAMES,
  labelize,
  tempId,
  flattenCategories,
} from "./options";
import {
  useUpsertMaterial,
  useUpsertCategory,
  useUpdatePlan,
  useUpsertSize,
  useCategories,
} from "@/lib/api/queries/inventory";
import type {
  Material,
  QualityTier,
  GenderTarget,
  FabricConstruction,
  Season,
  MaterialProperty,
  MaterialColor,
  Category,
  CategoryInput,
  SubscriptionTier,
  SizeRow,
} from "@/lib/api/types";

// ── Shared bits ───────────────────────────────────────────────────────────────

export function ReadOnlyBanner() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm text-foreground">
      <IconInfoCircle size={16} className="text-warning shrink-0" />
      You have read-only access to inventory. Editing is limited to Super Admins and Operations
      Admins.
    </div>
  );
}

// Reusable image uploader → pushes uploaded /uploads URLs into `value`.
function ImageUploader({
  value,
  onChange,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  async function add(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      const uploaded = await Promise.all(Array.from(files).map((f) => apiClient.uploadFile(f)));
      onChange([...value, ...uploaded.map((u) => u.url)]);
    } catch (e: unknown) {
      toast.error((e as Error).message || "Upload failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => add(e.target.files)}
      />
      <div className="flex flex-wrap gap-2">
        {value.map((url, i) => (
          <div key={i} className="relative w-20 h-20 rounded-md overflow-hidden border">
            <img src={url} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              title="Remove image"
              aria-label="Remove image"
              className="absolute top-0.5 right-0.5 p-1 rounded bg-black/60 text-white"
              onClick={() => onChange(value.filter((_, j) => j !== i))}
            >
              <IconTrash size={12} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          title="Add photo"
          aria-label="Add photo"
          className="w-20 h-20 rounded-md border border-dashed grid place-items-center text-muted-foreground hover:bg-muted"
        >
          <IconPhoto size={20} />
        </button>
      </div>
      {busy && <p className="text-xs text-muted-foreground mt-1">Uploading…</p>}
    </div>
  );
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function num(v: string): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Ids of `id`'s descendants within a depth-tagged, pre-order-flattened list
// (matches flattenCategories' traversal: children immediately follow their
// parent, and the subtree ends as soon as depth drops back to <= the
// ancestor's own depth). Used to keep the "Parent category" picker from
// offering a category's own descendant, which would create a parent_id cycle.
function descendantIds(list: Array<{ id: string; depth: number }>, id: string): Set<string> {
  const idx = list.findIndex((p) => p.id === id);
  if (idx === -1) return new Set();
  const baseDepth = list[idx].depth;
  const out = new Set<string>();
  for (let i = idx + 1; i < list.length; i++) {
    if (list[i].depth <= baseDepth) break;
    out.add(list[i].id);
  }
  return out;
}

// ── Material create / edit ──────────────────────────────────────────────────────

export function MaterialFormDialog({
  open,
  material,
  onClose,
}: {
  open: boolean;
  material: Material;
  onClose: () => void;
}) {
  const [m, setM] = useState<Material>(material);
  const upsert = useUpsertMaterial();
  const categoriesQ = useCategories();
  const categories = flattenCategories(categoriesQ.data?.data ?? []);
  const isEdit = !!material.id;
  const set = (patch: Partial<Material>) => setM((prev) => ({ ...prev, ...patch }));

  const mutationErrorToast = (fallback: string) => (e: unknown) =>
    toast.error((e as Error)?.message || fallback);

  const compTotal = m.composition.reduce((s, c) => s + (Number(c.pct) || 0), 0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!m.name.trim()) return;
    const { id, ...rest } = m;
    upsert.mutate(
      { id: isEdit ? id : undefined, body: rest },
      { onSuccess: onClose, onError: mutationErrorToast("Couldn't save material") },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Material" : "Add Material"}</DialogTitle>
          <DialogDescription>
            This creates a fabric in the shared platform catalogue — it's what every tailor picks
            from. It does <strong>not</strong> include price, stock, or colours: each tailor sets
            those themselves for the fabrics they choose to offer, from their own Fabrics page. A
            material only becomes visible to customers once at least one active tailor offers it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          {/* Identity */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name (EN)">
              <Input
                value={m.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="Egyptian Cotton"
                required
              />
            </Field>
            <Field label="Name (AR)">
              <Input
                value={m.name_ar}
                onChange={(e) => set({ name_ar: e.target.value })}
                placeholder="قطن مصري"
                dir="rtl"
              />
            </Field>
            <Field
              label="SKU"
              hint="Your own internal reference code for this fabric — used to tell near-identical materials apart in reports and search. Not shown to customers; make it up yourself (e.g. fabric type + origin + a running number)."
            >
              <Input
                value={m.sku}
                onChange={(e) => set({ sku: e.target.value })}
                placeholder="CT-EGY-014"
              />
            </Field>
            <Field
              label="Origin country"
              hint="Where the fabric itself is milled/woven, not where the tailor is based."
            >
              <Input
                value={m.origin_country}
                onChange={(e) => set({ origin_country: e.target.value })}
                placeholder="Egypt"
              />
            </Field>
          </div>

          {/* Classification */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Category" hint="Groups this material for the customer-facing catalog.">
              <Select
                value={m.category_id ?? "none"}
                onValueChange={(v) => set({ category_id: v === "none" ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uncategorized</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {"—".repeat(c.depth)} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field
              label="Quality tier"
              hint="How this fabric is grouped/filtered for customers browsing by budget — set it relative to your other materials, not on an absolute scale."
            >
              <Select
                value={m.quality_tier}
                onValueChange={(v) => set({ quality_tier: v as QualityTier })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUALITY_TIERS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {labelize(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {/* Fabric spec */}
          <div className="grid grid-cols-4 gap-3">
            <Field
              label="Weight (GSM)"
              hint="Grams per square metre — how heavy/thick the fabric feels. Light shirting is ~100-150, mid-weight suiting ~200-300, heavy wool/coating 350+."
            >
              <Input
                type="number"
                value={m.weight_gsm}
                onChange={(e) => set({ weight_gsm: num(e.target.value) })}
              />
            </Field>
            <Field
              label="Width (cm)"
              hint="The usable roll width — affects how many metres a customer needs to buy for their piece."
            >
              <Input
                type="number"
                value={m.width_cm}
                onChange={(e) => set({ width_cm: num(e.target.value) })}
              />
            </Field>
            <Field label="Weave">
              <Select
                value={m.weave_type}
                onValueChange={(v) => set({ weave_type: v as FabricConstruction })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEAVE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {labelize(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Season">
              <Select value={m.season} onValueChange={(v) => set({ season: v as Season })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEASONS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {labelize(t)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Mill / brand">
              <Input
                value={m.mill_brand ?? ""}
                onChange={(e) => set({ mill_brand: e.target.value || null })}
                placeholder="Reda"
              />
            </Field>
          </div>

          {/* Composition */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">
                Composition{" "}
                {compTotal !== 100 && (
                  <span className="text-warning">· {compTotal}% (should total 100)</span>
                )}
              </Label>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => set({ composition: [...m.composition, { fiber: "", pct: 0 }] })}
              >
                <IconPlus size={14} className="mr-1" /> Fibre
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Fibre blend shown to customers on the material detail page, e.g. "80% Cotton, 20%
              Linen" — add one row per fibre and the percentages should add up to 100%.
            </p>
            {m.composition.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  className="flex-1"
                  value={row.fiber}
                  placeholder="Cotton"
                  onChange={(e) => {
                    const c = m.composition.slice();
                    c[i] = { ...c[i], fiber: e.target.value };
                    set({ composition: c });
                  }}
                />
                <Input
                  className="w-24"
                  type="number"
                  value={row.pct}
                  onChange={(e) => {
                    const c = m.composition.slice();
                    c[i] = { ...c[i], pct: num(e.target.value) };
                    set({ composition: c });
                  }}
                />
                <span className="text-xs text-muted-foreground">%</span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => set({ composition: m.composition.filter((_, j) => j !== i) })}
                >
                  <IconTrash size={14} />
                </Button>
              </div>
            ))}
          </div>

          {/* Colours are NOT set here. The platform catalogues the fabric (images +
              specs); each tailor adds the specific colours THEY stock when they
              build an offering on this material (tailor › Materials). */}

          {/* Properties */}
          <Field
            label="Properties"
            hint="Tap to toggle — these become filter chips customers can search/browse by (e.g. Stretch, Breathable, Wrinkle-resistant)."
          >
            <div className="flex flex-wrap gap-1.5">
              {PROPERTY_OPTIONS.map((p) => {
                const on = m.properties.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() =>
                      set({
                        properties: on
                          ? m.properties.filter((x) => x !== p)
                          : [...m.properties, p as MaterialProperty],
                      })
                    }
                    className={`px-2.5 py-1 rounded-full text-xs border ${on ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {labelize(p)}
                  </button>
                );
              })}
            </div>
          </Field>

          {/* Certifications */}
          <Field
            label="Certifications"
            hint="Tap to toggle any that genuinely apply — shown to customers as trust badges (e.g. OEKO-TEX, GOTS Organic). Only add ones you can back up."
          >
            <div className="flex flex-wrap gap-1.5">
              {CERT_PRESETS.map((c) => {
                const on = m.certifications.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() =>
                      set({
                        certifications: on
                          ? m.certifications.filter((x) => x !== c)
                          : [...m.certifications, c],
                      })
                    }
                    className={`px-2.5 py-1 rounded-full text-xs border ${on ? "bg-success/20 border-success/40" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </Field>

          {/* Care + images + active */}
          <Field label="Care instructions">
            <Textarea
              value={m.care_instructions}
              onChange={(e) => set({ care_instructions: e.target.value })}
              rows={2}
              placeholder="Machine wash cold. Tumble dry low."
            />
          </Field>
          <Field label="Photos" hint="Upload fabric photos — shown to tailors and customers.">
            <ImageUploader value={m.images} onChange={(urls) => set({ images: urls })} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={m.is_active} onCheckedChange={(v: boolean) => set({ is_active: v })} />{" "}
            Active (visible to tailors &amp; customers)
          </label>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={upsert.isPending}>
              {upsert.isPending ? "Saving…" : isEdit ? "Save changes" : "Create material"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Material detail (rich showcase) ──────────────────────────────────────────────

export function MaterialDetailDialog({
  material,
  onClose,
}: {
  material: Material;
  onClose: () => void;
}) {
  const m = material;
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {m.name}
            <StatusBadge status={m.is_active ? "active" : "inactive"} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span dir="rtl">{m.name_ar}</span> · <span className="font-mono text-xs">{m.sku}</span>
          </div>

          <div className="aspect-[16/9] rounded-lg bg-muted overflow-hidden">
            {m.images[0] ? (
              <img src={m.images[0]} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full grid place-items-center text-muted-foreground text-sm">
                No image
              </div>
            )}
          </div>

          {/* Spec grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-border rounded-lg overflow-hidden text-sm">
            <Spec label="Type" value={labelize(m.material_type)} />
            <Spec label="Quality" value={labelize(m.quality_tier)} />
            <Spec label="Weight" value={`${m.weight_gsm} gsm`} />
            <Spec label="Weave" value={labelize(m.weave_type)} />
            <Spec label="Width" value={`${m.width_cm} cm`} />
            <Spec label="Origin" value={m.origin_country || "—"} />
            <Spec label="Mill / brand" value={m.mill_brand || "—"} />
            <Spec label="Season" value={labelize(m.season)} />
          </div>

          <DetailBlock title="Composition">
            <div className="flex flex-wrap gap-2">
              {m.composition.length === 0 ? (
                <span className="text-sm text-muted-foreground">—</span>
              ) : (
                m.composition.map((c, i) => (
                  <span key={i} className="text-xs px-2 py-1 rounded-full bg-muted">
                    {c.fiber} {c.pct}%
                  </span>
                ))
              )}
            </div>
          </DetailBlock>

          {m.properties.length > 0 && (
            <DetailBlock title="Properties">
              <div className="flex flex-wrap gap-1.5">
                {m.properties.map((p) => (
                  <span
                    key={p}
                    className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary"
                  >
                    {labelize(p)}
                  </span>
                ))}
              </div>
            </DetailBlock>
          )}

          {m.certifications.length > 0 && (
            <DetailBlock title="Certifications">
              <div className="flex flex-wrap gap-1.5">
                {m.certifications.map((c) => (
                  <span key={c} className="text-xs px-2 py-1 rounded-full bg-success/15">
                    {c}
                  </span>
                ))}
              </div>
            </DetailBlock>
          )}

          {m.care_instructions && (
            <DetailBlock title="Care">
              <p className="text-sm text-muted-foreground">{m.care_instructions}</p>
            </DetailBlock>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function DetailBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground mb-1.5">{title}</div>
      {children}
    </div>
  );
}

// ── Category create / edit ────────────────────────────────────────────────────────

export function CategoryFormDialog({
  open,
  category,
  parents,
  onClose,
}: {
  open: boolean;
  category: Partial<Category> & { parent_id?: string | null };
  parents: Array<{ id: string; name: string; depth: number }>;
  onClose: () => void;
}) {
  const isEdit = !!category.id;
  const [c, setC] = useState<CategoryInput>({
    id: category.id,
    name: category.name ?? "",
    name_ar: category.name_ar ?? "",
    slug: category.slug ?? "",
    gender: category.gender ?? "unisex",
    icon: category.icon ?? null,
    parent_id: category.parent_id ?? null,
    is_active: category.is_active ?? true,
  });
  const upsert = useUpsertCategory();
  const set = (patch: Partial<CategoryInput>) => setC((prev) => ({ ...prev, ...patch }));
  // Excludes the category's own descendants too — picking one as its own
  // parent would create a parent_id cycle that silently vanishes both
  // categories from the tree (neither is ever null nor reachable from a root).
  const excludedParentIds = c.id ? descendantIds(parents, c.id) : new Set<string>();

  const mutationErrorToast = (fallback: string) => (e: unknown) =>
    toast.error((e as Error)?.message || fallback);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!c.name.trim()) return;
    const slug = c.slug.trim() || c.name.trim().toLowerCase().replace(/\s+/g, "-");
    upsert.mutate(
      { id: isEdit ? c.id : undefined, body: { ...c, slug } },
      { onSuccess: onClose, onError: mutationErrorToast("Couldn't save category") },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Category" : "Add Category"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name (EN)">
              <Input
                value={c.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="Kandura"
                required
              />
            </Field>
            <Field label="Name (AR)">
              <Input
                value={c.name_ar}
                onChange={(e) => set({ name_ar: e.target.value })}
                dir="rtl"
                placeholder="كندورة"
              />
            </Field>
            <Field label="Slug" hint="Auto-generated from name if left blank.">
              <Input
                value={c.slug}
                onChange={(e) => set({ slug: e.target.value })}
                placeholder="kandura"
              />
            </Field>
            <Field label="Gender">
              <Select value={c.gender} onValueChange={(v) => set({ gender: v as GenderTarget })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {labelize(g)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Parent category" hint="Leave as “None” for a top-level category.">
            <Select
              value={c.parent_id ?? "none"}
              onValueChange={(v) => set({ parent_id: v === "none" ? null : v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (top level)</SelectItem>
                {parents
                  .filter((p) => p.id !== c.id && !excludedParentIds.has(p.id))
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {" ".repeat(p.depth * 2)}
                      {p.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Icon">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => set({ icon: null })}
                className={`w-9 h-9 grid place-items-center rounded-lg border ${!c.icon ? "border-primary text-primary" : "text-muted-foreground"}`}
              >
                <CategoryIcon name={null} />
              </button>
              {CATEGORY_ICON_NAMES.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => set({ icon: name })}
                  className={`w-9 h-9 grid place-items-center rounded-lg border ${c.icon === name ? "border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <CategoryIcon name={name} />
                </button>
              ))}
            </div>
          </Field>

          <label className="flex items-center gap-2 text-sm">
            <Switch checked={c.is_active} onCheckedChange={(v: boolean) => set({ is_active: v })} />{" "}
            Active
          </label>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={upsert.isPending}>
              {upsert.isPending ? "Saving…" : isEdit ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Plan edit ──────────────────────────────────────────────────────────────────

export function PlanFormDialog({ plan, onClose }: { plan: SubscriptionTier; onClose: () => void }) {
  const [p, setP] = useState<SubscriptionTier>(plan);
  const update = useUpdatePlan();
  const set = (patch: Partial<SubscriptionTier>) => setP((prev) => ({ ...prev, ...patch }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // PUT /plans/:id reads a different shape than GET /plans returns (which is
    // what populates `p`) — price_fils/commission_rate_bps (not the display
    // monthly_price_fils/commission_rate_pct), max_listings (not
    // max_active_listings), and the four toggles packed into one `features`
    // object instead of top-level booleans. Sending `p` as-is nulled out
    // price/commission/cap/features on every save since the backend never
    // recognized any of the frontend's field names.
    const body = {
      name: p.name,
      name_ar: p.name_ar,
      price_fils: p.monthly_price_fils,
      commission_rate_bps: Math.round((p.commission_rate_pct || 0) * 100),
      max_listings: p.max_active_listings,
      max_promotions: p.max_promotions,
      max_portfolio_images: p.max_portfolio_images,
      max_images_per_listing: p.max_images_per_listing,
      max_orders_per_month: p.max_orders_per_month,
      duration_months: p.duration_months,
      description: p.description,
      is_active: p.is_active,
      features: {
        featured_placement: p.can_feature_listings,
        featured_slots: p.max_featured_slots,
        priority_support: p.priority_dispute_handling,
        verified_badge: p.verified_badge,
        female_customer_access: p.female_customer_eligible,
      },
    };
    update.mutate({ id: p.id, body }, { onSuccess: onClose });
  };

  const Toggle = ({ k, label }: { k: keyof SubscriptionTier; label: string }) => (
    <label className="flex items-center justify-between text-sm py-1">
      <span>{label}</span>
      <Switch
        checked={!!p[k]}
        onCheckedChange={(v: boolean) => set({ [k]: v } as Partial<SubscriptionTier>)}
      />
    </label>
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Plan · {p.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Monthly price (AED)">
              <Input
                type="number"
                value={p.monthly_price_fils / 100 || 0}
                onChange={(e) => set({ monthly_price_fils: Math.round(num(e.target.value) * 100) })}
              />
            </Field>
            <Field label="Annual price (AED)" hint="10× monthly — not separately configurable.">
              <Input
                type="number"
                value={(p.monthly_price_fils * 10) / 100 || 0}
                disabled
                readOnly
              />
            </Field>
            <Field label="Commission rate (%)">
              <Input
                type="number"
                value={p.commission_rate_pct}
                onChange={(e) => set({ commission_rate_pct: num(e.target.value) })}
              />
            </Field>
            <Field label="Max active listings" hint="Blank = unlimited">
              <Input
                type="number"
                value={p.max_active_listings ?? ""}
                onChange={(e) =>
                  set({ max_active_listings: e.target.value === "" ? null : num(e.target.value) })
                }
              />
            </Field>
            <Field label="Max portfolio images" hint="Gallery photos">
              <Input
                type="number"
                value={p.max_portfolio_images}
                onChange={(e) => set({ max_portfolio_images: num(e.target.value) })}
              />
            </Field>
            <Field label="Images per listing" hint="Free = 1">
              <Input
                type="number"
                value={p.max_images_per_listing ?? 1}
                onChange={(e) => set({ max_images_per_listing: num(e.target.value) })}
              />
            </Field>
            <Field label="Max featured slots">
              <Input
                type="number"
                value={p.max_featured_slots}
                onChange={(e) => set({ max_featured_slots: num(e.target.value) })}
              />
            </Field>
            <Field label="Max orders / month" hint="Blank = unlimited">
              <Input
                type="number"
                value={p.max_orders_per_month ?? ""}
                onChange={(e) =>
                  set({ max_orders_per_month: e.target.value === "" ? null : num(e.target.value) })
                }
              />
            </Field>
            <Field label="Duration (months)" hint="Billing period">
              <Input
                type="number"
                value={p.duration_months ?? 1}
                onChange={(e) => set({ duration_months: num(e.target.value) || 1 })}
              />
            </Field>
          </div>
          <Field label="Description" hint="Shown to tailors choosing a plan">
            <Input
              value={p.description ?? ""}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="e.g. For growing tailors — more listings, lower commission"
            />
          </Field>
          <div className="border-t pt-3">
            <Toggle k="can_feature_listings" label="Can feature listings" />
            <Toggle k="priority_dispute_handling" label="Priority dispute handling" />
            <Toggle k="verified_badge" label="Verified badge" />
            <Toggle k="female_customer_eligible" label="Female customer access" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Save plan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Size create / edit ───────────────────────────────────────────────────────────

export function SizeFormDialog({ size, onClose }: { size: SizeRow; onClose: () => void }) {
  const [s, setS] = useState<SizeRow>(size);
  const upsert = useUpsertSize();
  const isEdit = !!size.id;
  const set = (patch: Partial<SizeRow>) => setS((prev) => ({ ...prev, ...patch }));
  const numOrNull = (v: string) => (v === "" ? null : num(v));

  const mutationErrorToast = (fallback: string) => (e: unknown) =>
    toast.error((e as Error)?.message || fallback);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!s.label.trim()) return;
    const { id, ...body } = s;
    upsert.mutate(
      { id: isEdit ? id : undefined, body },
      { onSuccess: onClose, onError: mutationErrorToast("Couldn't save size") },
    );
  };

  const Range = ({
    label,
    minK,
    maxK,
  }: {
    label: string;
    minK: keyof SizeRow;
    maxK: keyof SizeRow;
  }) => (
    <Field label={`${label} (cm)`}>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          placeholder="min"
          value={(s[minK] as number | null) ?? ""}
          onChange={(e) => set({ [minK]: numOrNull(e.target.value) } as Partial<SizeRow>)}
        />
        <span className="text-muted-foreground">–</span>
        <Input
          type="number"
          placeholder="max"
          value={(s[maxK] as number | null) ?? ""}
          onChange={(e) => set({ [maxK]: numOrNull(e.target.value) } as Partial<SizeRow>)}
        />
      </div>
    </Field>
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Size" : "Add Size"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Label">
              <Input
                value={s.label}
                onChange={(e) => set({ label: e.target.value })}
                placeholder="M"
                required
              />
            </Field>
            <Field label="Gender">
              <Select value={s.gender} onValueChange={(v) => set({ gender: v as GenderTarget })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {labelize(g)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Sort order">
              <Input
                type="number"
                value={s.sort_order}
                onChange={(e) => set({ sort_order: num(e.target.value) })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <Range label="Chest" minK="chest_min_cm" maxK="chest_max_cm" />
            <Range label="Waist" minK="waist_min_cm" maxK="waist_max_cm" />
            <Range label="Hips" minK="hips_min_cm" maxK="hips_max_cm" />
          </div>
          <Field label="Description">
            <Input
              value={s.description ?? ""}
              onChange={(e) => set({ description: e.target.value || null })}
              placeholder="Medium"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={s.is_active} onCheckedChange={(v: boolean) => set({ is_active: v })} />{" "}
            Active
          </label>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={upsert.isPending}>
              {upsert.isPending ? "Saving…" : isEdit ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Re-export so the route can render confirm states without another import line.
export { IconCircleCheck, IconCircleX };
export type { MaterialColor };
