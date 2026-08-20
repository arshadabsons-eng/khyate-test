import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { IconPlus, IconEdit, IconBan } from "@tabler/icons-react";
import { Card } from "@/components/common/Page";
import { DataTable } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ErrorState, LoadingRows } from "@/components/common/AsyncStates";
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
  useTailorPromotions,
  useUpsertPromotion,
  useDeactivatePromotion,
} from "@/lib/api/queries/tailor";
import { useMarketplaceCaps } from "@/lib/api/queries/policy";
import { toast } from "sonner";
import { filsToAed, fmtDate } from "@/lib/format";
import type { TailorPromotion, PromoService } from "@/lib/api/types";

export const Route = createFileRoute("/tailor/promotions")({ component: PromotionsPage });

// Garments we create for (matches a listing's `category`).
const GARMENTS = ["Kandura", "Abaya", "Mahra"];
const SERVICES: { value: PromoService; label: string }[] = [
  { value: "readymade", label: "Readymade" },
  { value: "custom_stitch", label: "Stitching" },
  { value: "alteration", label: "Altering" },
];

function emptyPromo(): TailorPromotion {
  return {
    id: "",
    code: "",
    discount_type: "percentage",
    discount_value: 10,
    scope_type: "all",
    target_category: null,
    target_service: null,
    valid_from: null,
    valid_until: null,
    max_uses: 100,
    uses_count: 0,
    is_active: true,
  };
}

// A promo can be `is_active` in the DB yet functionally dead — exhausted or
// past its window. Mirrors the atomic checkout guard in index.js so the
// admin-hub badge never claims "Active" for a code every checkout would reject.
function isPromoCurrentlyActive(p: TailorPromotion): boolean {
  if (!p.is_active) return false;
  if (p.max_uses != null && p.uses_count >= p.max_uses) return false;
  if (p.valid_until != null && new Date(p.valid_until) <= new Date()) return false;
  return true;
}

function scopeLabel(p: TailorPromotion): string {
  if (p.scope_type === "category") return `All ${p.target_category ?? "—"}`;
  if (p.scope_type === "service")
    return SERVICES.find((s) => s.value === p.target_service)?.label ?? "Service";
  return "All my work";
}

function PromotionsPage() {
  const q = useTailorPromotions();
  const deact = useDeactivatePromotion();
  const policy = useMarketplaceCaps();
  const [form, setForm] = useState<TailorPromotion | null>(null);

  const mutationErrorToast = (fallback: string) => (e: unknown) =>
    toast.error((e as Error)?.message || fallback);

  const maxDays = policy.data?.max_promotion_duration_days ?? 30;
  const maxPct = policy.data?.max_discount_percentage ?? 50;
  const rows = q.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          Create your own discount codes. Platform caps: max <b>{maxDays} days</b> duration · max{" "}
          <b>{maxPct}%</b> discount.
        </div>
        <Button size="sm" onClick={() => setForm(emptyPromo())}>
          <IconPlus size={15} className="mr-1" /> New promotion
        </Button>
      </div>

      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} title="Couldn't load promotions" />
      ) : q.isLoading && !q.data ? (
        <LoadingRows cols={6} rows={4} />
      ) : (
        <DataTable
          rows={rows}
          emptyMessage="No promotions yet"
          columns={[
            {
              header: "Code",
              accessor: (p) => <span className="font-mono font-medium">{p.code}</span>,
            },
            {
              header: "Discount",
              accessor: (p) =>
                p.discount_type === "percentage"
                  ? `${p.discount_value}%`
                  : filsToAed(p.discount_value * 100),
            },
            { header: "Scope", accessor: (p) => scopeLabel(p) },
            {
              header: "Window",
              accessor: (p) => `${fmtDate(p.valid_from)} → ${fmtDate(p.valid_until)}`,
            },
            {
              header: "Used",
              accessor: (p) => `${p.uses_count}${p.max_uses ? ` / ${p.max_uses}` : ""}`,
            },
            {
              header: "Status",
              accessor: (p) => (
                <StatusBadge status={isPromoCurrentlyActive(p) ? "active" : "inactive"} />
              ),
            },
            {
              header: "Actions",
              accessor: (p) => (
                <div className="flex gap-1" data-no-row>
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-muted"
                    title="Edit"
                    onClick={() => setForm(p)}
                  >
                    <IconEdit size={15} />
                  </button>
                  {p.is_active && (
                    <button
                      type="button"
                      className="p-1 rounded hover:bg-muted text-destructive"
                      title="Deactivate"
                      onClick={() =>
                        deact.mutate(p.id, {
                          onError: mutationErrorToast("Couldn't deactivate this promotion"),
                        })
                      }
                    >
                      <IconBan size={15} />
                    </button>
                  )}
                </div>
              ),
            },
          ]}
        />
      )}

      {form && (
        <PromoDialog promo={form} maxDays={maxDays} maxPct={maxPct} onClose={() => setForm(null)} />
      )}
    </div>
  );
}

function daysBetween(a: string | null, b: string | null) {
  if (!a || !b) return 0;
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

function PromoDialog({
  promo,
  maxDays,
  maxPct,
  onClose,
}: {
  promo: TailorPromotion;
  maxDays: number;
  maxPct: number;
  onClose: () => void;
}) {
  const [p, setP] = useState<TailorPromotion>(promo);
  const upsert = useUpsertPromotion();
  const isEdit = !!promo.id;
  const set = (patch: Partial<TailorPromotion>) => setP((prev) => ({ ...prev, ...patch }));
  const [err, setErr] = useState("");

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!p.code.trim()) return setErr("Enter a code");
    if (p.discount_type === "percentage" && p.discount_value > maxPct)
      return setErr(`Discount can't exceed ${maxPct}%`);
    if (daysBetween(p.valid_from, p.valid_until) > maxDays)
      return setErr(`Duration can't exceed ${maxDays} days`);
    if (p.scope_type === "category" && !p.target_category)
      return setErr("Choose a garment category");
    if (p.scope_type === "service" && !p.target_service) return setErr("Choose a service");
    const { id, uses_count, ...body } = p;
    upsert.mutate(
      { id: isEdit ? id : undefined, body },
      {
        onSuccess: onClose,
        onError: (e: unknown) => setErr((e as Error)?.message || "Couldn't save this promotion"),
      },
    );
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit promotion" : "New promotion"}</DialogTitle>
          <DialogDescription className="sr-only">
            Configure your discount code, value, scope and validity window.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <Field label="Code">
            <Input
              value={p.code}
              onChange={(e) => {
                set({ code: e.target.value.toUpperCase() });
                setErr("");
              }}
              placeholder="EID15"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Discount type">
              <Select
                value={p.discount_type}
                onValueChange={(v) => set({ discount_type: v as TailorPromotion["discount_type"] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="fixed_fils">Fixed (AED)</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field
              label={p.discount_type === "percentage" ? `Value (max ${maxPct}%)` : "Value (AED)"}
            >
              <Input
                type="number"
                value={p.discount_value}
                onChange={(e) => {
                  set({ discount_value: Number(e.target.value) });
                  setErr("");
                }}
              />
            </Field>
            <Field label="From">
              <Input
                type="date"
                value={p.valid_from?.slice(0, 10) ?? ""}
                onChange={(e) => {
                  set({ valid_from: e.target.value || null });
                  setErr("");
                }}
              />
            </Field>
            <Field label="Until">
              <Input
                type="date"
                value={p.valid_until?.slice(0, 10) ?? ""}
                onChange={(e) => {
                  set({ valid_until: e.target.value || null });
                  setErr("");
                }}
              />
            </Field>
            <Field label="Max uses (blank = ∞)">
              <Input
                type="number"
                value={p.max_uses ?? ""}
                onChange={(e) =>
                  set({ max_uses: e.target.value === "" ? null : Number(e.target.value) })
                }
              />
            </Field>
          </div>

          <Field label="Applies to">
            <Select
              value={p.scope_type}
              onValueChange={(v) =>
                set({
                  scope_type: v as TailorPromotion["scope_type"],
                  target_category: null,
                  target_service: null,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All my work</SelectItem>
                <SelectItem value="category">A garment category</SelectItem>
                <SelectItem value="service">A service</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {p.scope_type === "category" && (
            <Field label="Garment">
              <Select
                value={p.target_category || undefined}
                onValueChange={(v) => set({ target_category: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a garment" />
                </SelectTrigger>
                <SelectContent>
                  {GARMENTS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          {p.scope_type === "service" && (
            <Field label="Service">
              <Select
                value={p.target_service || undefined}
                onValueChange={(v) => set({ target_service: v as PromoService })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a service" />
                </SelectTrigger>
                <SelectContent>
                  {SERVICES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          {err && <p className="text-sm text-destructive">{err}</p>}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
