import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  IconPlus,
  IconEdit,
  IconTrash,
  IconSearch,
  IconEye,
  IconEyeOff,
} from "@tabler/icons-react";
import { Card } from "@/components/common/Page";
import { StatusBadge } from "@/components/common/StatusBadge";
import { BlurImage } from "@/components/common/BlurImage";
import { ErrorState, LoadingCards, NoData } from "@/components/common/AsyncStates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  useMaterialCatalog,
  useUpsertMaterialOffering,
  useStopMaterialOffering,
  type InheritedMaterial,
  type MaterialColour,
} from "@/lib/api/queries/tailor";
import { filsToAed } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/tailor/materials")({ component: MaterialsPage });

// Must stay in sync with backend/src/routes/tailor-me.js, which hard-truncates
// the submitted colour list with `.slice(0, 5)`.
const MAX_COLOURS = 5;

function MaterialsPage() {
  const q = useMaterialCatalog();
  const stop = useStopMaterialOffering();
  const [edit, setEdit] = useState<InheritedMaterial | null>(null);
  const [search, setSearch] = useState("");

  const all = q.data ?? [];
  const rows = all.filter((m) =>
    m.material_name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const offered = all.filter((m) => m.is_offered).length;

  return (
    <div className="space-y-5">
      <header className="kh-section">
        <h1 className="kh-h1 font-serif">Fabrics</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Every fabric in the Khyate catalogue is available to you — you don't re-add Cotton or
          Wool. Just set the <span className="font-medium">colours you stock</span> and your price
          on the ones you work with, and choose whether to show them on your storefront.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-56 max-w-sm">
          <IconSearch
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search fabrics…"
            className="pl-9"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{offered}</span> of {all.length} offered
        </span>
      </div>

      {q.isError ? (
        <ErrorState
          error={q.error}
          onRetry={() => q.refetch()}
          title="Couldn't load the fabric catalogue"
        />
      ) : q.isLoading ? (
        <LoadingCards />
      ) : rows.length === 0 ? (
        <Card>
          <NoData icon={IconSearch} title="No fabrics match your search" />
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((m) => (
            <div
              key={m.material_id}
              className="bg-card border rounded-xl overflow-hidden flex flex-col"
            >
              <div className="aspect-[4/3] bg-muted relative">
                <BlurImage
                  src={m.image_urls?.[0]}
                  alt={m.material_name}
                  className="w-full h-full"
                />
                {m.is_offered && (
                  <span
                    className={`absolute top-2 right-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${m.is_public ? "bg-green-600 text-white" : "bg-muted-foreground/80 text-white"}`}
                  >
                    {m.is_public ? "On storefront" : "Private"}
                  </span>
                )}
              </div>
              <div className="p-3 flex-1 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{m.material_name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[m.material_type, m.weight_gsm ? `${m.weight_gsm} gsm` : null]
                        .filter(Boolean)
                        .join(" · ") || "Fabric"}
                    </div>
                  </div>
                  {m.quality_tier && <StatusBadge status={m.quality_tier} />}
                </div>

                {m.is_offered ? (
                  <>
                    <div className="flex items-center gap-1.5 flex-wrap min-h-6">
                      {m.colours.length === 0 ? (
                        <span className="text-xs text-muted-foreground">No colours set</span>
                      ) : (
                        m.colours
                          .slice(0, 10)
                          .map((c, i) => (
                            <span
                              key={i}
                              title={c.name || c.hex}
                              className="w-4 h-4 rounded-full border"
                              style={{ backgroundColor: c.hex }}
                            />
                          ))
                      )}
                      {m.colours.length > 10 && (
                        <span className="text-xs text-muted-foreground">
                          +{m.colours.length - 10}
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-medium">
                      {filsToAed(m.price_per_meter_fils ?? 0)}
                      <span className="text-xs text-muted-foreground font-normal"> / m</span>
                    </div>
                    <div className="flex items-center gap-2 mt-auto pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => setEdit(m)}
                      >
                        <IconEdit size={14} className="mr-1.5" /> Edit
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Stop offering"
                        className="text-destructive"
                        onClick={() => {
                          if (
                            !window.confirm(
                              `Stop offering ${m.material_name}? Your colours & price for it are removed.`,
                            )
                          )
                            return;
                          stop.mutate(m.material_id, {
                            onSuccess: () => toast.success("Removed from your fabrics"),
                            onError: (e: unknown) =>
                              toast.error((e as Error)?.message || "Couldn't remove"),
                          });
                        }}
                      >
                        <IconTrash size={15} />
                      </Button>
                    </div>
                  </>
                ) : (
                  <Button size="sm" className="mt-auto" onClick={() => setEdit(m)}>
                    <IconPlus size={14} className="mr-1.5" /> Offer this fabric
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {edit && <OfferDialog material={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function OfferDialog({ material, onClose }: { material: InheritedMaterial; onClose: () => void }) {
  const upsert = useUpsertMaterialOffering();
  const [colours, setColours] = useState<MaterialColour[]>(material.colours ?? []);
  const [priceAed, setPriceAed] = useState<number>((material.price_per_meter_fils ?? 0) / 100);
  const [stock, setStock] = useState<string>(
    material.stock_meters != null ? String(material.stock_meters) : "",
  );
  const [minMeters, setMinMeters] = useState<string>(String(material.minimum_order_meters ?? 4));
  const [totalColours, setTotalColours] = useState<string>(
    material.total_colours_available != null ? String(material.total_colours_available) : "",
  );
  const [isPublic, setIsPublic] = useState<boolean>(material.is_public);
  const [spunLength, setSpunLength] = useState<string>(material.spun_length ?? "");
  const [fiberGrade, setFiberGrade] = useState<string>(material.fiber_grade ?? "");
  const [washCount, setWashCount] = useState<string>(
    material.wash_durability_count != null ? String(material.wash_durability_count) : "",
  );

  const save = () => {
    if (priceAed <= 0) return toast.error("Set a price per metre");
    upsert.mutate(
      {
        materialId: material.material_id,
        body: {
          colours: colours.filter((c) => c.hex),
          price_per_meter_fils: Math.round(priceAed * 100),
          stock_meters: stock.trim() === "" ? null : Number(stock),
          min_meters: Math.max(1, Math.round(Number(minMeters) || 4)),
          total_colours_available: totalColours.trim() === "" ? null : Number(totalColours),
          is_public: isPublic,
          spun_length: spunLength.trim() === "" ? null : spunLength.trim(),
          fiber_grade: fiberGrade.trim() === "" ? null : fiberGrade.trim(),
          wash_durability_count: washCount.trim() === "" ? null : Number(washCount),
        },
      },
      {
        onSuccess: () => {
          toast.success(`${material.material_name} updated`);
          onClose();
        },
        onError: (e: unknown) => toast.error((e as Error)?.message || "Couldn't save"),
      },
    );
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{material.material_name}</DialogTitle>
          <DialogDescription>
            Set the colours you stock and your price. The fabric itself is the platform's — you only
            add your details.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Colours you stock ({colours.length}/{MAX_COLOURS})</Label>
              {/* The backend silently truncates to the first 5 swatches
                  (tailor-me.js: `.slice(0, 5)`), so an unlimited picker here
                  produced a success toast and then quietly discarded the
                  extras — the tailor only discovered it by reopening the
                  dialog. Enforce the same cap at the point of entry. */}
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={colours.length >= MAX_COLOURS}
                title={
                  colours.length >= MAX_COLOURS
                    ? `You can list up to ${MAX_COLOURS} colours per material.`
                    : undefined
                }
                onClick={() => setColours([...colours, { name: "", hex: "#cccccc" }])}
              >
                <IconPlus size={14} className="mr-1" /> Colour
              </Button>
            </div>
            {colours.length >= MAX_COLOURS && (
              <p className="text-xs text-muted-foreground">
                Maximum {MAX_COLOURS} colours per material — remove one to add another.
              </p>
            )}
            {colours.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No colours yet — add the shades you keep in stock.
              </p>
            )}
            <div className="space-y-2">
              {colours.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={c.hex}
                    aria-label="colour"
                    className="h-8 w-8 rounded-full border p-0 cursor-pointer"
                    onChange={(e) => {
                      const a = colours.slice();
                      a[i] = { ...a[i], hex: e.target.value };
                      setColours(a);
                    }}
                  />
                  <Input
                    className="flex-1"
                    value={c.name ?? ""}
                    placeholder="e.g. Sky Blue"
                    onChange={(e) => {
                      const a = colours.slice();
                      a[i] = { ...a[i], name: e.target.value };
                      setColours(a);
                    }}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => setColours(colours.filter((_, j) => j !== i))}
                  >
                    <IconTrash size={14} />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Total colours available</Label>
            <Input
              type="number"
              min={0}
              className="w-32"
              value={totalColours}
              placeholder="Optional"
              onChange={(e) => setTotalColours(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The full number of shades you can supply, even beyond the swatches above. Customers
              see this as "N colours available".
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Price / metre (AED)</Label>
              <Input
                type="number"
                min={0}
                step="0.5"
                value={priceAed || 0}
                onChange={(e) => setPriceAed(Math.max(0, Number(e.target.value)))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Stock (metres)</Label>
              <Input
                type="number"
                min={0}
                value={stock}
                placeholder="Optional"
                onChange={(e) => setStock(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Min. metres</Label>
              <Input
                type="number"
                min={1}
                value={minMeters}
                placeholder="4"
                onChange={(e) => setMinMeters(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            Customers must buy at least this many metres (platform default is 4). Raise or lower it
            for this fabric.
          </p>

          <div className="space-y-2 rounded-md border p-3">
            <div>
              <div className="text-sm font-medium">Quality & durability (optional)</div>
              <div className="text-xs text-muted-foreground">
                For your own batch of this fabric — helps customers judge quality. Leave blank if
                you're not sure.
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Spun / staple length</Label>
                <Input
                  value={spunLength}
                  placeholder='e.g. "34mm — Extra-Long Staple"'
                  onChange={(e) => setSpunLength(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fibre / lint grade</Label>
                <Input
                  value={fiberGrade}
                  placeholder='e.g. "Grade 1 — Premium Combed"'
                  onChange={(e) => setFiberGrade(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Wash durability</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground shrink-0">Holds up to</span>
                <Input
                  type="number"
                  min={0}
                  className="w-24"
                  value={washCount}
                  placeholder="50"
                  onChange={(e) => setWashCount(e.target.value)}
                />
                <span className="text-sm text-muted-foreground shrink-0">washes</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border px-3 py-2.5">
            <div>
              <div className="text-sm font-medium flex items-center gap-1.5">
                {isPublic ? <IconEye size={15} /> : <IconEyeOff size={15} />} Show on my storefront
              </div>
              <div className="text-xs text-muted-foreground">
                Public fabrics appear to customers; private ones are for your own reference.
              </div>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={upsert.isPending}>
            {upsert.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
