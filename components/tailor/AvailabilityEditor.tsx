import { useEffect, useState } from "react";
import { IconBuildingStore, IconHome } from "@tabler/icons-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/common/AsyncStates";
import { useAvailability, useUpdateAvailability } from "@/lib/api/queries/tailor";
import type { AvailabilityRule } from "@/lib/api/types";
import { toast } from "sonner";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Row = {
  weekday: number;
  start_hm: string;
  end_hm: string;
  slot_capacity: number;
  in_shop: boolean;
  home_visit: boolean;
  is_active: boolean;
};

function defaultRows(): Row[] {
  return WEEKDAYS.map((_, i) => ({
    weekday: i,
    start_hm: "09:00",
    end_hm: "18:00",
    slot_capacity: 1,
    in_shop: true,
    home_visit: false,
    is_active: false,
  }));
}

/** Clean, checkbox-first weekly availability editor. Toggle a day on, set its
 *  hours, and pick in-shop / home-visit. Saves the full week at once. */
export function AvailabilityEditor() {
  const q = useAvailability();
  const update = useUpdateAvailability();
  const [rows, setRows] = useState<Row[]>(defaultRows());

  useEffect(() => {
    if (!q.data) return;
    const base = defaultRows();
    for (const r of q.data) {
      if (r.weekday < 0 || r.weekday > 6) continue;
      base[r.weekday] = {
        weekday: r.weekday,
        start_hm: (r.start_hm ?? "09:00").slice(0, 5),
        end_hm: (r.end_hm ?? "18:00").slice(0, 5),
        slot_capacity: (r as { slot_capacity?: number }).slot_capacity ?? 1,
        in_shop: r.in_shop ?? true,
        home_visit: r.home_visit ?? false,
        is_active: r.is_active !== false,
      };
    }
    setRows(base);
  }, [q.data]);

  const patch = (i: number, p: Partial<Row>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...p } : r)));

  const mutationErrorToast = (fallback: string) => (e: unknown) =>
    toast.error((e as Error)?.message || fallback);

  const save = () =>
    update.mutate(rows as AvailabilityRule[], {
      onSuccess: () => toast.success("Availability saved"),
      onError: mutationErrorToast("Couldn't save your availability"),
    });

  if (q.isError) {
    return (
      <ErrorState
        error={q.error}
        onRetry={() => q.refetch()}
        title="Couldn't load your availability"
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Tick the days you're open, set your hours, and choose how you take customers. Times are UAE
        (Asia/Dubai).
      </p>
      <div className="space-y-2">
        {rows.map((r, i) => (
          <div
            key={r.weekday}
            className={`rounded-lg border p-3 transition-colors ${r.is_active ? "bg-card" : "bg-muted/30"}`}
          >
            <div className="flex flex-wrap items-center gap-3">
              <Switch
                checked={r.is_active}
                onCheckedChange={(v) => patch(i, { is_active: v })}
                aria-label={`Available on ${WEEKDAYS[r.weekday]}`}
              />
              <span
                className={`font-medium text-sm w-24 ${r.is_active ? "" : "text-muted-foreground"}`}
              >
                {WEEKDAYS[r.weekday]}
              </span>
              {r.is_active ? (
                <>
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={r.start_hm}
                      onChange={(e) => patch(i, { start_hm: e.target.value })}
                      className="w-[118px]"
                    />
                    <span className="text-muted-foreground text-sm">to</span>
                    <Input
                      type="time"
                      value={r.end_hm}
                      onChange={(e) => patch(i, { end_hm: e.target.value })}
                      className="w-[118px]"
                    />
                  </div>
                  <div
                    className="flex items-center gap-1.5"
                    title="How many customers can book the same time slot"
                  >
                    <span className="text-xs text-muted-foreground">Seats / slot</span>
                    <Input
                      type="number"
                      min={1}
                      value={r.slot_capacity}
                      onChange={(e) =>
                        patch(i, { slot_capacity: Math.max(1, Number(e.target.value) || 1) })
                      }
                      className="w-16"
                      aria-label={`Seats per slot on ${WEEKDAYS[r.weekday]}`}
                    />
                  </div>
                  <div className="flex items-center gap-1.5 ml-auto">
                    <ModeToggle
                      active={r.in_shop}
                      onClick={() => patch(i, { in_shop: !r.in_shop })}
                      icon={IconBuildingStore}
                      label="In shop"
                    />
                    <ModeToggle
                      active={r.home_visit}
                      onClick={() => patch(i, { home_visit: !r.home_visit })}
                      icon={IconHome}
                      label="Home visit"
                    />
                  </div>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">Closed</span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        {/* Saves the FULL week at once (PUT is a full-week upsert, not a
            partial merge) — `rows` starts as all-days-closed and is only
            replaced once the real schedule loads (see the useEffect above).
            Disabling only on update.isPending let a click land while q.data
            was still in flight, silently overwriting the tailor's real
            availability with the all-closed default. */}
        <Button onClick={save} disabled={update.isPending || q.isLoading || !q.data}>
          {update.isPending ? "Saving…" : q.isLoading ? "Loading…" : "Save hours"}
        </Button>
      </div>
    </div>
  );
}

function ModeToggle({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof IconHome;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
        active
          ? "bg-primary/10 border-primary/30 text-primary"
          : "bg-muted/40 border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon size={14} /> {label}
    </button>
  );
}
