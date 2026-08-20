import { createFileRoute, useSearch, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Card, PageHeader } from "@/components/common/Page";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ErrorState, NoData } from "@/components/common/AsyncStates";
import {
  useMaterials,
  useUpsertMaterial,
  useDeleteMaterial,
  useBulkSetMaterialActive,
  useCategories,
  useDeleteCategory,
  useReorderCategories,
  useSizes,
  useDeleteSize,
  useMaterialOfferingsPending,
  useApproveMaterialOffering,
  useRejectMaterialOffering,
  type MaterialFilters,
  type PendingMaterialOffering,
} from "@/lib/api/queries/inventory";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { fmtNumber, fmtDateTime } from "@/lib/format";
import { Money } from "@/components/common/Money";
import { auth } from "@/lib/auth";
import { toast } from "sonner";
import {
  IconBox,
  IconCategory,
  IconStar,
  IconRuler,
  IconLayoutGrid,
  IconPlus,
  IconSearch,
  IconDotsVertical,
  IconEdit,
  IconCopy,
  IconTrash,
  IconEye,
  IconChevronUp,
  IconChevronDown,
  IconChecks,
  IconPalette,
  IconClockHour4,
  IconCheck,
  IconX,
} from "@tabler/icons-react";
import type { Material, Category, SizeRow } from "@/lib/api/types";
import {
  MATERIAL_TYPES,
  QUALITY_TIERS,
  GENDERS,
  labelize,
  emptyMaterial,
  flattenCategories,
  totalColorCount,
} from "@/components/inventory/options";
import { CategoryIcon } from "@/components/inventory/CategoryIcon";
import { LiquidTabs } from "@/components/common/LiquidTabs";
import {
  ReadOnlyBanner,
  MaterialFormDialog,
  MaterialDetailDialog,
  CategoryFormDialog,
  SizeFormDialog,
} from "@/components/inventory/forms";

const TABS = ["materials", "categories", "sizes", "pending-approvals"] as const;
type TabKey = (typeof TABS)[number];

type InventorySearch = { tab?: TabKey };

export const Route = createFileRoute("/_app/inventory")({
  component: InventoryPage,
  validateSearch: (search: Record<string, unknown>): InventorySearch => {
    const t = search.tab;
    return { tab: TABS.includes(t as TabKey) ? (t as TabKey) : undefined };
  },
});

function useCanWrite() {
  // Was a role-label string check ("Super Admin"/"Operations Admin") — a
  // custom role (via Roles & Permissions) with rank >= 2 always displays as
  // the generic "Admin" label (ADMIN_ROLE_LABEL only maps the 4 built-in
  // roles), so it never matched either string and silently lost every write
  // action here despite the backend's own /inventory route guard being
  // rank-based, not role-string-based. auth.canWrite() is the same rank
  // check already used correctly on disputes.$id.tsx/promotions.tsx.
  return auth.canWrite();
}

function InventoryPage() {
  const { tab } = useSearch({ from: "/_app/inventory" });
  const navigate = useNavigate({ from: "/inventory" });
  const activeTab: TabKey = tab ?? "materials";
  const canWrite = useCanWrite();

  const setTab = (t: TabKey) => navigate({ search: { tab: t } });

  const tabConfig = [
    { id: "materials", label: "Materials", icon: IconLayoutGrid },
    { id: "categories", label: "Categories", icon: IconCategory },
    { id: "sizes", label: "Size Management", icon: IconRuler },
    { id: "pending-approvals", label: "Pending Approvals", icon: IconClockHour4 },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Inventory" description="Manage materials, categories and sizes" />

      {!canWrite && <ReadOnlyBanner />}

      <LiquidTabs
        tabs={tabConfig}
        value={activeTab}
        onChange={(id) => setTab(id as TabKey)}
        className="-mt-1"
      />

      {activeTab === "materials" && <MaterialsTab canWrite={canWrite} />}
      {activeTab === "categories" && <CategoriesTab canWrite={canWrite} />}
      {activeTab === "sizes" && <SizesTab canWrite={canWrite} />}
      {activeTab === "pending-approvals" && <PendingApprovalsTab canWrite={canWrite} />}
    </div>
  );
}

// ── Confirm dialog ────────────────────────────────────────────────────────────

function ConfirmDialog({
  title,
  message,
  confirmLabel = "Delete",
  pending,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{message}</p>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── KPI strip ─────────────────────────────────────────────────────────────────

function KpiStrip({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{children}</div>;
}

// ── Materials ───────────────────────────────────────────────────────────────────

function MaterialsTab({ canWrite }: { canWrite: boolean }) {
  const [search, setSearch] = useState("");
  const dSearch = useDebouncedValue(search, 300);
  const [type, setType] = useState<string>("all");
  const [tier, setTier] = useState<string>("all");
  const [gender, setGender] = useState<string>("all");
  const [activeOnly, setActiveOnly] = useState(false);
  const [sort, setSort] = useState<NonNullable<MaterialFilters["sort"]>>("created_desc");

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [formMaterial, setFormMaterial] = useState<Material | null>(null);
  const [detail, setDetail] = useState<Material | null>(null);
  const [toDelete, setToDelete] = useState<Material | null>(null);

  const filters = useMemo<MaterialFilters>(
    () => ({
      page: 1,
      limit: 24,
      sort,
      search: dSearch || undefined,
      material_type: type === "all" ? undefined : [type as Material["material_type"]],
      quality_tier: tier === "all" ? undefined : [tier as Material["quality_tier"]],
      gender: gender === "all" ? undefined : (gender as Material["gender_target"]),
      is_active: activeOnly ? true : undefined,
    }),
    [dSearch, type, tier, gender, activeOnly, sort],
  );

  const q = useMaterials(filters);
  const upsert = useUpsertMaterial();
  const del = useDeleteMaterial();
  const bulk = useBulkSetMaterialActive();

  const mutationErrorToast = (fallback: string) => (e: unknown) =>
    toast.error((e as Error)?.message || fallback);

  const rows = q.data?.data ?? [];
  const kpiActive = rows.filter((m) => m.is_active).length;
  const kpiTiers = new Set(rows.map((m) => m.quality_tier)).size;

  const toggleSel = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const clearSel = () => {
    setSelected(new Set());
    setSelectMode(false);
  };

  const runBulk = (is_active: boolean) =>
    bulk.mutate(
      { ids: [...selected], is_active },
      { onSuccess: clearSel, onError: mutationErrorToast("Couldn't update materials") },
    );

  return (
    <div className="space-y-4">
      <KpiStrip>
        <StatCard
          label="Materials"
          value={fmtNumber(q.data?.total ?? rows.length)}
          icon={IconBox}
        />
        <StatCard label="Active" value={kpiActive} icon={IconChecks} />
        <StatCard
          label="With photos"
          value={rows.filter((m) => (m.images?.length ?? 0) > 0).length}
          icon={IconPalette}
        />
        <StatCard label="Quality tiers" value={kpiTiers} icon={IconStar} />
      </KpiStrip>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <IconSearch
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Search name or SKU…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <FilterSelect value={type} onChange={setType} all="All types" options={MATERIAL_TYPES} />
        <FilterSelect value={tier} onChange={setTier} all="All tiers" options={QUALITY_TIERS} />
        <FilterSelect value={gender} onChange={setGender} all="All genders" options={GENDERS} />
        <Select
          value={sort}
          onValueChange={(v) => setSort(v as NonNullable<MaterialFilters["sort"]>)}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_desc">Newest</SelectItem>
            <SelectItem value="name_asc">Name A–Z</SelectItem>
            <SelectItem value="name_desc">Name Z–A</SelectItem>
          </SelectContent>
        </Select>
        <ToggleChip on={activeOnly} onClick={() => setActiveOnly((v) => !v)}>
          Active only
        </ToggleChip>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">
          {q.data ? `${fmtNumber(q.data.total)} material${q.data.total === 1 ? "" : "s"}` : null}
          {selectMode && selected.size > 0 && (
            <span className="ml-2">· {selected.size} selected</span>
          )}
        </div>
        {canWrite && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => (selectMode ? clearSel() : setSelectMode(true))}
            >
              {selectMode ? "Done" : "Select"}
            </Button>
            <Button type="button" size="sm" onClick={() => setFormMaterial(emptyMaterial())}>
              <IconPlus size={15} className="mr-1" /> Add Material
            </Button>
          </div>
        )}
      </div>

      {/* Bulk bar */}
      {canWrite && selectMode && selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={bulk.isPending}
              onClick={() => runBulk(true)}
            >
              Activate
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={bulk.isPending}
              onClick={() => runBulk(false)}
            >
              Deactivate
            </Button>
          </div>
        </div>
      )}

      {/* Grid */}
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} title="Couldn't load materials" />
      ) : q.isLoading && !q.data ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-72 rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <NoData
            icon={IconBox}
            title="No materials match"
            description="Adjust filters or add a new material."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((m) => (
            <MaterialCard
              key={m.id}
              material={m}
              canWrite={canWrite}
              selectMode={selectMode}
              selected={selected.has(m.id)}
              onToggleSel={() => toggleSel(m.id)}
              onView={() => setDetail(m)}
              onEdit={() => setFormMaterial(m)}
              onDuplicate={() =>
                setFormMaterial({ ...m, id: "", sku: `${m.sku}-COPY`, name: `${m.name} (copy)` })
              }
              onToggleActive={() => upsert.mutate({ id: m.id, body: { is_active: !m.is_active } })}
              onDelete={() => setToDelete(m)}
            />
          ))}
        </div>
      )}

      {formMaterial && (
        <MaterialFormDialog open material={formMaterial} onClose={() => setFormMaterial(null)} />
      )}
      {detail && <MaterialDetailDialog material={detail} onClose={() => setDetail(null)} />}
      {toDelete && (
        <ConfirmDialog
          title="Delete material"
          message={`Permanently remove “${toDelete.name}”? This cannot be undone.`}
          pending={del.isPending}
          onConfirm={() =>
            del.mutate(toDelete.id, {
              onSuccess: () => setToDelete(null),
              onError: mutationErrorToast("Couldn't delete material"),
            })
          }
          onClose={() => setToDelete(null)}
        />
      )}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  all,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  all: string;
  options: string[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[140px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{all}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {labelize(o)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ToggleChip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 rounded-md text-sm border ${on ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}

const TIER_BADGE_CLASS: Record<string, string> = {
  economy: "!bg-success/20",
  standard: "!bg-info/20",
  premium: "!bg-warning/20",
  luxury: "!bg-primary-soft",
};

function compositionSummary(m: Material): string {
  if (!m.composition.length) return labelize(m.material_type);
  const main = m.composition[0];
  const extra = m.composition.length - 1;
  return `${main.pct}% ${main.fiber}${extra > 0 ? ` +${extra}` : ""}`;
}

function MaterialCard({
  material,
  canWrite,
  selectMode,
  selected,
  onToggleSel,
  onView,
  onEdit,
  onDuplicate,
  onToggleActive,
  onDelete,
}: {
  material: Material;
  canWrite: boolean;
  selectMode: boolean;
  selected: boolean;
  onToggleSel: () => void;
  onView: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
}) {
  const m = material;
  const tierClass = TIER_BADGE_CLASS[m.quality_tier] ?? "";

  const onCardClick = () => {
    if (selectMode) onToggleSel();
    else onView();
  };

  return (
    <div
      className={`bg-card border rounded-xl overflow-hidden cursor-pointer transition-shadow hover:shadow-sm ${selected ? "ring-2 ring-primary" : ""} ${!m.is_active ? "opacity-60" : ""}`}
      onClick={onCardClick}
    >
      <div className="relative aspect-[16/10] bg-muted">
        {m.images[0] ? (
          <img src={m.images[0]} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full grid place-items-center text-muted-foreground">
            <IconBox size={32} />
          </div>
        )}
        {selectMode && (
          <div
            className="absolute top-2 left-2"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSel();
            }}
          >
            <Checkbox checked={selected} />
          </div>
        )}
        {!selectMode && (
          <div className="absolute top-2 left-2">
            <StatusBadge status={m.gender_target} />
          </div>
        )}
        <div className="absolute top-2 right-2 flex items-center gap-1">
          <StatusBadge status={m.quality_tier} className={tierClass} />
          {canWrite && !selectMode && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Material actions"
                  title="Actions"
                  className="w-7 h-7 grid place-items-center rounded-md bg-card/90 border hover:bg-card"
                  onClick={(e) => e.stopPropagation()}
                >
                  <IconDotsVertical size={15} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={onView}>
                  <IconEye size={15} className="mr-2" /> View
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onEdit}>
                  <IconEdit size={15} className="mr-2" /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDuplicate}>
                  <IconCopy size={15} className="mr-2" /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onToggleActive}>
                  {m.is_active ? "Deactivate" : "Activate"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={onDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <IconTrash size={15} className="mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{m.name}</div>
            <div className="text-xs text-muted-foreground">
              {compositionSummary(m)} · {m.weight_gsm} gsm
            </div>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground shrink-0">{m.sku}</span>
        </div>
        {/* Colours are supplied by each tailor on their offering, not the catalog. */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {labelize(m.weave_type)} · {m.width_cm}cm
          </span>
          <span className="tabular-nums">{m.origin_country}</span>
        </div>
      </div>
    </div>
  );
}

// ── Categories ───────────────────────────────────────────────────────────────────

function CategoriesTab({ canWrite }: { canWrite: boolean }) {
  const q = useCategories("all");
  const del = useDeleteCategory();
  const reorder = useReorderCategories();

  const mutationErrorToast = (fallback: string) => (e: unknown) =>
    toast.error((e as Error)?.message || fallback);
  const [form, setForm] = useState<(Partial<Category> & { parent_id?: string | null }) | null>(
    null,
  );
  const [toDelete, setToDelete] = useState<Category | null>(null);

  if (q.isError)
    return (
      <ErrorState error={q.error} onRetry={() => q.refetch()} title="Couldn't load categories" />
    );
  if (q.isLoading) return <Skeleton className="h-96" />;

  const tree = q.data?.data ?? [];
  const flat = flattenCategories(tree);
  const parentOptions = flat.map((c) => ({ id: c.id, name: c.name, depth: c.depth }));
  const total = flat.length;
  const activeCount = flat.filter((c) => c.is_active).length;
  const materialTotal = flat.reduce((s, c) => s + Number(c.material_count ?? 0), 0);

  const moveRoot = (id: string, dir: -1 | 1) => {
    const ids = tree.map((c) => c.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    reorder.mutate(ids);
  };

  return (
    <div className="space-y-4">
      <KpiStrip>
        <StatCard label="Categories" value={total} icon={IconCategory} />
        <StatCard label="Active" value={activeCount} icon={IconChecks} />
        <StatCard label="Top-level" value={tree.length} icon={IconLayoutGrid} />
        <StatCard label="Materials" value={fmtNumber(materialTotal)} icon={IconBox} />
      </KpiStrip>

      {tree.length === 0 ? (
        <Card>
          <NoData
            icon={IconCategory}
            title="No categories yet"
            description="Add gender → category → subcategory to organize listings."
          />
          {canWrite && (
            <div className="text-center mt-4">
              <Button onClick={() => setForm({})}>
                <IconPlus size={15} className="mr-1" /> Add Category
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <Card
          title="Category tree"
          action={
            canWrite ? (
              <Button size="sm" onClick={() => setForm({})}>
                <IconPlus size={15} className="mr-1" /> Add Category
              </Button>
            ) : undefined
          }
        >
          <ul className="divide-y">
            {tree.map((c, idx) => (
              <CategoryRow
                key={c.id}
                category={c}
                depth={0}
                canWrite={canWrite}
                isFirst={idx === 0}
                isLast={idx === tree.length - 1}
                onMove={(dir) => moveRoot(c.id, dir)}
                onEdit={(cat) => setForm(cat)}
                onAddChild={(parentId) => setForm({ parent_id: parentId })}
                onDelete={(cat) => setToDelete(cat)}
              />
            ))}
          </ul>
        </Card>
      )}

      {form && (
        <CategoryFormDialog
          open
          category={form}
          parents={parentOptions}
          onClose={() => setForm(null)}
        />
      )}
      {toDelete && (
        <ConfirmDialog
          title="Delete category"
          message={`Delete “${toDelete.name}”? If it's in use by any materials, it will be deactivated instead of deleted.`}
          pending={del.isPending}
          onConfirm={() =>
            del.mutate(toDelete.id, {
              onSuccess: () => setToDelete(null),
              onError: mutationErrorToast("Couldn't delete category"),
            })
          }
          onClose={() => setToDelete(null)}
        />
      )}
    </div>
  );
}

const DEPTH_PADDING = ["pl-0", "pl-6", "pl-12"] as const;

function CategoryRow({
  category,
  depth,
  canWrite,
  isFirst,
  isLast,
  onMove,
  onEdit,
  onAddChild,
  onDelete,
}: {
  category: Category;
  depth: number;
  canWrite: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  onMove?: (dir: -1 | 1) => void;
  onEdit: (c: Category) => void;
  onAddChild: (parentId: string) => void;
  onDelete: (c: Category) => void;
}) {
  const padClass = DEPTH_PADDING[Math.min(depth, DEPTH_PADDING.length - 1)];
  return (
    <li>
      <div className={`flex items-center gap-3 py-2.5 hover:bg-muted/30 ${padClass}`}>
        <CategoryIcon name={category.icon} className="text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{category.name}</div>
          <div className="text-xs text-muted-foreground">
            {category.name_ar} · {labelize(String(category.gender))}
          </div>
        </div>
        <span className="text-xs text-muted-foreground tabular-nums">
          {fmtNumber(category.material_count ?? 0)} materials
        </span>
        <StatusBadge status={category.is_active ? "active" : "inactive"} />
        {canWrite && (
          <div className="flex items-center gap-0.5">
            {depth === 0 && onMove && (
              <>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-muted disabled:opacity-30"
                  disabled={isFirst}
                  onClick={() => onMove(-1)}
                  title="Move up"
                >
                  <IconChevronUp size={15} />
                </button>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-muted disabled:opacity-30"
                  disabled={isLast}
                  onClick={() => onMove(1)}
                  title="Move down"
                >
                  <IconChevronDown size={15} />
                </button>
              </>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Category actions"
                  title="Actions"
                  className="p-1 rounded hover:bg-muted"
                >
                  <IconDotsVertical size={15} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(category)}>
                  <IconEdit size={15} className="mr-2" /> Edit
                </DropdownMenuItem>
                {depth < 2 && (
                  <DropdownMenuItem onClick={() => onAddChild(category.id)}>
                    <IconPlus size={15} className="mr-2" /> Add subcategory
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(category)}
                  className="text-destructive focus:text-destructive"
                >
                  <IconTrash size={15} className="mr-2" /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
      {category.children?.length > 0 && (
        <ul>
          {category.children.map((c) => (
            <CategoryRow
              key={c.id}
              category={c}
              depth={depth + 1}
              canWrite={canWrite}
              onEdit={onEdit}
              onAddChild={onAddChild}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// ── Sizes ─────────────────────────────────────────────────────────────────────────

function emptySize(): SizeRow {
  return {
    id: "",
    label: "",
    gender: "unisex",
    chest_min_cm: null,
    chest_max_cm: null,
    waist_min_cm: null,
    waist_max_cm: null,
    hips_min_cm: null,
    hips_max_cm: null,
    description: null,
    is_active: true,
    sort_order: 0,
  };
}

function SizesTab({ canWrite }: { canWrite: boolean }) {
  const q = useSizes();
  const del = useDeleteSize();
  const [form, setForm] = useState<SizeRow | null>(null);
  const [toDelete, setToDelete] = useState<SizeRow | null>(null);

  const mutationErrorToast = (fallback: string) => (e: unknown) =>
    toast.error((e as Error)?.message || fallback);

  if (q.isError)
    return <ErrorState error={q.error} onRetry={() => q.refetch()} title="Couldn't load sizes" />;
  if (q.isLoading) return <Skeleton className="h-72" />;
  const sizes = q.data ?? [];

  return (
    <div className="space-y-4">
      <Card
        title="Standard Sizes"
        action={
          canWrite ? (
            <Button size="sm" onClick={() => setForm(emptySize())}>
              <IconPlus size={15} className="mr-1" /> Add Size
            </Button>
          ) : undefined
        }
      >
        {sizes.length === 0 ? (
          <NoData icon={IconRuler} title="No sizes configured" />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="text-left py-2">Label</th>
                <th className="text-left">Gender</th>
                <th className="text-left">Chest (cm)</th>
                <th className="text-left">Waist (cm)</th>
                <th className="text-left">Hips (cm)</th>
                <th className="text-left">Description</th>
                <th className="text-left">Active</th>
                {canWrite && <th className="text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {sizes.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="py-2 font-medium">{s.label}</td>
                  <td className="text-muted-foreground">{labelize(s.gender)}</td>
                  <td>{rangeOrDash(s.chest_min_cm, s.chest_max_cm)}</td>
                  <td>{rangeOrDash(s.waist_min_cm, s.waist_max_cm)}</td>
                  <td>{rangeOrDash(s.hips_min_cm, s.hips_max_cm)}</td>
                  <td className="text-muted-foreground">{s.description ?? "—"}</td>
                  <td>
                    <StatusBadge status={s.is_active ? "active" : "inactive"} />
                  </td>
                  {canWrite && (
                    <td className="text-right">
                      <div className="inline-flex gap-1">
                        <button
                          type="button"
                          className="p-1 rounded hover:bg-muted"
                          onClick={() => setForm(s)}
                          title="Edit"
                        >
                          <IconEdit size={15} />
                        </button>
                        <button
                          type="button"
                          className="p-1 rounded hover:bg-muted text-destructive"
                          onClick={() => setToDelete(s)}
                          title="Delete"
                        >
                          <IconTrash size={15} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {form && <SizeFormDialog size={form} onClose={() => setForm(null)} />}
      {toDelete && (
        <ConfirmDialog
          title="Delete size"
          message={`Remove size “${toDelete.label}”?`}
          pending={del.isPending}
          onConfirm={() =>
            del.mutate(toDelete.id, {
              onSuccess: () => setToDelete(null),
              onError: mutationErrorToast("Couldn't delete size"),
            })
          }
          onClose={() => setToDelete(null)}
        />
      )}
    </div>
  );
}

// ── Pending Approvals ────────────────────────────────────────────────────────
// Fabric offerings a tailor saved while the "material sale requires approval"
// marketplace setting is on — every save lands here as approval_status='pending'
// and hidden (is_active=FALSE) until approved or rejected here.

function PendingApprovalsTab({ canWrite }: { canWrite: boolean }) {
  const q = useMaterialOfferingsPending();
  const approve = useApproveMaterialOffering();
  const reject = useRejectMaterialOffering();

  if (q.isError)
    return (
      <ErrorState
        error={q.error}
        onRetry={() => q.refetch()}
        title="Couldn't load pending offerings"
      />
    );
  if (q.isLoading) return <Skeleton className="h-72" />;

  const rows = q.data ?? [];

  const doApprove = (o: PendingMaterialOffering) =>
    approve.mutate(o.id, {
      onSuccess: () =>
        toast.success(`Approved "${o.material_name}" — now live for ${o.business_name}`),
      onError: (e: unknown) => toast.error((e as Error)?.message || "Couldn't approve"),
    });

  const doReject = (o: PendingMaterialOffering) => {
    const reason = window.prompt(
      "Why is this fabric offering being rejected? (the tailor sees this)",
    );
    if (!reason) return;
    reject.mutate(
      { id: o.id, reason },
      {
        onSuccess: () => toast.message("Offering rejected — tailor notified"),
        onError: (e: unknown) => toast.error((e as Error)?.message || "Couldn't reject"),
      },
    );
  };

  return (
    <div className="space-y-4">
      <KpiStrip>
        <StatCard label="Pending review" value={fmtNumber(rows.length)} icon={IconClockHour4} />
      </KpiStrip>

      <Card title="Fabric offerings awaiting approval">
        {rows.length === 0 ? (
          <NoData
            icon={IconClockHour4}
            title="Nothing pending"
            description="Tailor fabric offerings submitted for approval will show up here."
          />
        ) : (
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="text-left py-2">Fabric</th>
                <th className="text-left">Tailor</th>
                <th className="text-left">Price / metre</th>
                <th className="text-left">Colours</th>
                <th className="text-left">Submitted</th>
                {canWrite && <th className="text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className="border-t">
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      {o.images?.[0] ? (
                        <img
                          src={o.images[0]}
                          alt=""
                          className="w-9 h-9 rounded-md object-cover border shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-md bg-muted grid place-items-center shrink-0">
                          <IconBox size={16} className="text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="font-medium truncate">{o.material_name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{o.sku}</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-muted-foreground">{o.business_name}</td>
                  <td>
                    <Money fils={o.price_per_meter_fils} />
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      {(o.colours ?? []).slice(0, 5).map((c, i) => (
                        <ColorDot key={i} hex={c.hex} title={c.name ?? c.hex} />
                      ))}
                      {(o.colours ?? []).length === 0 && (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </td>
                  <td className="text-muted-foreground">{fmtDateTime(o.updated_at)}</td>
                  {canWrite && (
                    <td className="text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-success hover:text-success"
                          disabled={approve.isPending}
                          onClick={() => doApprove(o)}
                        >
                          <IconCheck size={15} className="mr-1" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          disabled={reject.isPending}
                          onClick={() => doReject(o)}
                        >
                          <IconX size={15} className="mr-1" /> Reject
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function rangeOrDash(min: number | null, max: number | null) {
  if (min == null && max == null) return "—";
  return `${min ?? "?"} – ${max ?? "?"}`;
}

// ── Tiny visuals ───────────────────────────────────────────────────────────────

function ColorDot({ hex, title, muted }: { hex: string; title: string; muted?: boolean }) {
  return (
    <span
      className={`w-5 h-5 rounded-full border shadow-sm ${muted ? "opacity-40" : ""}`}
      style={{ backgroundColor: hex }}
      title={muted ? `${title} (out of stock)` : title}
    />
  );
}
