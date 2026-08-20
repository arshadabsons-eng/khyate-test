import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  IconRuler,
  IconHome,
  IconBuildingStore,
  IconClockHour4,
  IconSend2,
  IconDownload,
  IconTrash,
  IconHistory,
} from "@tabler/icons-react";
import { Card } from "@/components/common/Page";
import { CenteredSpinner, ErrorState, NoData } from "@/components/common/AsyncStates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogFullContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { apiClient } from "@/lib/api/client";
import {
  useAppointments,
  useMeasurePoints,
  useUploadMeasurements,
  useAppointmentMeasurements,
  useDismissAppointment,
  useTailorProfile,
  useMeasurementLog,
  useDeleteMeasurementLogEntry,
  useSetMeasurementRetention,
  type MeasurePoint,
  type AppointmentMeasurements,
} from "@/lib/api/queries/tailor";
import { MeasurementDiagram } from "@/components/tailor/MeasurementDiagram";
import { labelize } from "@/components/inventory/options";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/tailor/measurements")({ component: MeasurementsPage });

function uaeTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Dubai",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// Fallback only — the panel actually closes on the animation's own end event
// (works correctly under prefers-reduced-motion, where the CSS duration
// collapses to ~0 but a fixed timer wouldn't know that). This is just a safety
// net in case the animationend event doesn't fire for some reason.
const SEND_ANIM_FALLBACK_MS = 1500;

const REGION_LABELS: Record<string, string> = {
  upper: "Upper body",
  lower: "Lower body",
  full: "Full body",
  other: "Other",
};

function MeasurementsPage() {
  const appts = useAppointments();
  const points = useMeasurePoints();
  const upload = useUploadMeasurements();
  const dismiss = useDismissAppointment();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const profile = useTailorProfile();
  const log = useMeasurementLog();
  const deleteLogEntry = useDeleteMeasurementLogEntry();
  const setRetention = useSetMeasurementRetention();
  const [deleteLogId, setDeleteLogId] = useState<string | null>(null);
  const [retentionValue, setRetentionValue] = useState("");
  const [retentionUnit, setRetentionUnit] = useState<"days" | "months" | "years">("days");

  const [active, setActive] = useState<{
    id: string;
    customer: string;
    gender: "female" | "male" | null;
  } | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [activeKey, setActiveKey] = useState<string | null>(null);
  // True for the brief moment the panel is folding + flying off after a successful save.
  const [sending, setSending] = useState(false);
  const existing = useAppointmentMeasurements(active?.id ?? null);
  const pick = (key: string) => {
    setActiveKey(key);
    setTimeout(() => document.getElementById(key)?.focus(), 0);
  };

  // Reflect the saved retention (always stored/returned in days) into the
  // value+unit form once the profile loads — always shown back in "days"
  // rather than guessing a "3 months"-style unit from an arbitrary day count.
  useEffect(() => {
    const d = profile.data?.measurement_retention_days;
    setRetentionValue(d ? String(d) : "");
    setRetentionUnit("days");
  }, [profile.data?.measurement_retention_days]);

  // Pre-fill from whatever was already sent for this booking, so re-opening it
  // shows the real saved chart instead of a blank form that reads as data loss.
  // Skipped while `sending` — don't clobber what the tailor just typed and is
  // mid-way through submitting.
  useEffect(() => {
    if (!active || sending || !existing.data) return;
    const body = existing.data.body || {};
    setValues(Object.fromEntries(Object.entries(body).map(([k, v]) => [k, String(v)])));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when the fetched profile itself changes
  }, [existing.data]);

  // Safety net: if the CSS animationend event never fires for some reason
  // (browser quirk, tab backgrounded), still close instead of leaving the
  // panel stuck open forever.
  useEffect(() => {
    if (!sending) return;
    const t = setTimeout(finishSendAnimation, SEND_ANIM_FALLBACK_MS);
    return () => clearTimeout(t);
  }, [sending]);

  if (appts.isLoading || points.isLoading) return <CenteredSpinner />;
  if (appts.isError) return <ErrorState error={appts.error} onRetry={() => appts.refetch()} />;
  // A failed /measure-points fetch used to fall straight through to
  // `points.data ?? []`, rendering the page as though the platform simply had
  // no measurement points configured — indistinguishable from a real empty
  // state, so a tailor would conclude the feature was unavailable rather than
  // retrying a transient error.
  if (points.isError) return <ErrorState error={points.error} onRetry={() => points.refetch()} />;

  const allPoints = points.data ?? [];
  const booked = (appts.data ?? []).filter((a) =>
    ["pending", "confirmed", "en_route", "arrived"].includes(a.status),
  );
  // Once sent, a booking used to just vanish from this page (it dropped out of
  // "booked" and there was nowhere else to find it) — reading as if the chart
  // had been lost. Keep it visible here so a sent measurement is never a dead end.
  // Excludes rows the tailor has explicitly removed from their own dashboard
  // (tailor_dismissed_at) — the customer's saved measurement data is untouched
  // either way, this list is purely this tailor's own view.
  const measured = (appts.data ?? []).filter(
    (a) => a.status === "measured" && !a.tailor_dismissed_at,
  );

  // Group the global points by body region for a tidy form (one set, measured once).
  const groups = new Map<string, MeasurePoint[]>();
  for (const p of allPoints) {
    const r = p.body_region || "other";
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(p);
  }
  // One canonical number per point, shared by the figure dots AND the field labels.
  const numbers: Record<string, number> = {};
  allPoints.forEach((p, i) => {
    numbers[p.key] = i + 1;
  });

  function openFor(a: {
    id: string;
    customer_name: string;
    required_tailor_gender?: string | null;
    customer_gender?: string | null;
    gender?: string | null;
  }) {
    // Tint the figure pink (female) / blue (male), else neutral.
    // customer_gender/gender are read first for forward-compatibility, but
    // NEITHER column exists on `appointments` — the tailor appointments query
    // selects `a.*` plus the customer's name/phone only, so both were always
    // undefined and this tint was permanently neutral, i.e. dead code.
    // required_tailor_gender ('men' | 'women' | 'any') is a real column on the
    // table and does reach the client via `a.*`; it's the modesty preference
    // the customer themselves set when booking, so it's the best available
    // signal for who is being measured. 'any' correctly stays neutral.
    const g = (a.customer_gender || a.gender || a.required_tailor_gender || "")
      .toString()
      .toLowerCase();
    const gender =
      g === "female" || g === "women" ? "female" : g === "male" || g === "men" ? "male" : null;
    setActive({ id: a.id, customer: a.customer_name, gender });
    // Pre-filled by the effect below once the read-back query resolves — start
    // blank only for a booking that was never sent.
    setValues({});
  }

  function close() {
    if (sending) return; // ignore stray closes while the send animation is playing
    setActive(null);
  }

  function submit() {
    if (!active) return;
    const measurements: Record<string, number> = {};
    for (const [k, v] of Object.entries(values)) {
      const n = parseFloat(v);
      if (!Number.isNaN(n)) measurements[k] = n;
    }
    if (Object.keys(measurements).length === 0) {
      toast.error("Enter at least one measurement before sending");
      return;
    }
    upload.mutate(
      { id: active.id, measurements, person_name: active.customer, gender: active.gender },
      {
        onSuccess: () => {
          toast.success("Measurements sent to the customer for approval");
          // Fold the panel up and let it fly off before actually closing — reads as
          // "sent", not an abrupt dismissal. Actual close happens on the
          // animation's own end event (see onAnimationEnd below); this timeout
          // is only a safety net.
          setSending(true);
        },
        onError: () => toast.error("Could not save measurements"),
      },
    );
  }

  function finishSendAnimation() {
    setActive(null);
    setSending(false);
  }

  // Downloads the sent measurement chart as JSON before it's (optionally)
  // removed from this dashboard — the tailor's own record, independent of
  // the customer's copy which stays on their account regardless.
  async function downloadMeasurements(a: {
    id: string;
    customer_name: string;
    slot_start: string;
  }) {
    setDownloadingId(a.id);
    try {
      const data = await apiClient.get<AppointmentMeasurements | null>(
        `/tailors/me/appointments/${a.id}/measurements`,
      );
      if (!data) {
        toast.error("No measurement data to download for this booking");
        return;
      }
      const rows = allPoints.map((p) => ({
        point: p.label,
        unit: p.unit,
        value: data.body[p.key] ?? null,
      }));
      const payload = {
        customer: a.customer_name,
        measured_at: data.created_at,
        approved_at: data.approved_at,
        gender: data.gender,
        measurements: rows,
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const datePart = uaeTime(a.slot_start).replace(/[,:]/g, "").replace(/\s+/g, "-");
      link.download = `measurements-${a.customer_name.replace(/\s+/g, "-")}-${datePart}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Could not download measurements");
    } finally {
      setDownloadingId(null);
    }
  }

  const UNIT_TO_DAYS: Record<typeof retentionUnit, number> = { days: 1, months: 30, years: 365 };
  function saveRetention() {
    const n = parseInt(retentionValue, 10);
    if (!retentionValue.trim()) {
      setRetention.mutate(null, {
        onSuccess: () =>
          toast.success("Auto-expiry turned off — logs are kept until you delete them"),
        onError: () => toast.error("Could not update retention setting"),
      });
      return;
    }
    if (!Number.isFinite(n) || n < 1) {
      toast.error("Enter a number of days, months, or years");
      return;
    }
    const days = Math.round(n * UNIT_TO_DAYS[retentionUnit]);
    setRetention.mutate(days, {
      onSuccess: () =>
        toast.success(`Measurement logs now auto-expire after ${retentionValue} ${retentionUnit}`),
      onError: () => toast.error("Could not update retention setting"),
    });
  }

  function removeFromDashboard(a: { id: string; customer_name: string }) {
    if (
      !window.confirm(
        `Remove ${a.customer_name}'s measurement from your dashboard? The customer keeps their saved chart — this only clears it from your own list.`,
      )
    ) {
      return;
    }
    dismiss.mutate(
      { id: a.id },
      {
        onSuccess: () => toast.success("Removed from your dashboard"),
        onError: () => toast.error("Could not remove — try again"),
      },
    );
  }

  return (
    <div className="space-y-6">
      <Card
        title="Record measurements"
        action={
          <span className="text-xs text-muted-foreground">
            Measure each point once — reused for every garment
          </span>
        }
      >
        {booked.length === 0 ? (
          <NoData
            icon={IconClockHour4}
            title="No bookings to measure"
            description="Measurement bookings from customers appear here."
          />
        ) : (
          <ul className="divide-y">
            {booked.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 text-primary grid place-items-center">
                  {a.type === "home_visit" ? (
                    <IconHome size={18} />
                  ) : (
                    <IconBuildingStore size={18} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{a.customer_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {uaeTime(a.slot_start)} · {labelize(a.type)}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => openFor(a)}>
                  <IconRuler size={15} className="mr-1" /> Record
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {measured.length > 0 && (
        <Card
          title="Already measured"
          action={
            <span className="text-xs text-muted-foreground">Sent — tap to review or correct</span>
          }
        >
          <ul className="divide-y">
            {measured.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-3">
                <div className="w-9 h-9 rounded-full bg-success/10 text-success grid place-items-center">
                  <IconRuler size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{a.customer_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {uaeTime(a.slot_start)} · {labelize(a.type)}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => openFor(a)}>
                  Review
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  title="Download this measurement chart"
                  disabled={downloadingId === a.id}
                  onClick={() => downloadMeasurements(a)}
                >
                  <IconDownload size={16} />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  title="Remove from your dashboard"
                  className="text-destructive hover:text-destructive"
                  disabled={dismiss.isPending}
                  onClick={() => removeFromDashboard(a)}
                >
                  <IconTrash size={16} />
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* The durable archive: every measurement this tailor has ever recorded,
          independent of the appointment it came from (unlike "Already measured"
          above, this never empties just because a booking got dismissed). */}
      <Card
        title="Measurement log"
        action={
          <span className="text-xs text-muted-foreground">Every customer you've measured</span>
        }
      >
        <div className="mb-4 flex flex-wrap items-end gap-2 rounded-md border bg-muted/20 px-3 py-2.5">
          <div className="space-y-1">
            <Label className="text-xs">Auto-delete logs after</Label>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                min={1}
                inputMode="numeric"
                placeholder="Never"
                value={retentionValue}
                onChange={(e) => setRetentionValue(e.target.value)}
                className="w-20"
              />
              <Select
                value={retentionUnit}
                onValueChange={(v) => setRetentionUnit(v as typeof retentionUnit)}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="days">Days</SelectItem>
                  <SelectItem value="months">Months</SelectItem>
                  <SelectItem value="years">Years</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={setRetention.isPending}
            onClick={saveRetention}
          >
            {setRetention.isPending ? "Saving…" : "Save"}
          </Button>
          <p className="text-xs text-muted-foreground basis-full">
            Leave blank and save to keep logs indefinitely (manual delete only). A log still linked
            to an active order is never auto-deleted.
          </p>
        </div>

        {log.isLoading ? (
          <CenteredSpinner />
        ) : log.isError ? (
          <ErrorState error={log.error} onRetry={() => log.refetch()} />
        ) : !log.data || log.data.length === 0 ? (
          <NoData
            icon={IconHistory}
            title="No measurement history yet"
            description="Customers you've measured will appear here."
          />
        ) : (
          <ul className="divide-y">
            {log.data.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 py-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 text-primary grid place-items-center">
                  <IconHistory size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{entry.customer_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {uaeTime(entry.created_at)}
                    {entry.approved_at ? " · Approved by customer" : " · Awaiting approval"}
                    {entry.in_use ? " · Linked to an order" : ""}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  title={
                    entry.in_use ? "Linked to an order — can't be deleted" : "Delete this log entry"
                  }
                  className="text-destructive hover:text-destructive"
                  disabled={entry.in_use || deleteLogEntry.isPending}
                  onClick={() => setDeleteLogId(entry.id)}
                >
                  <IconTrash size={16} />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={!!deleteLogId}
        onOpenChange={(v) => !v && setDeleteLogId(null)}
        title="Delete this measurement log entry?"
        description="This removes it from your log permanently. It doesn't affect the customer's own saved measurements — they can still be measured again in future."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (!deleteLogId) return;
          const id = deleteLogId;
          setDeleteLogId(null);
          deleteLogEntry.mutate(id, {
            onSuccess: () => toast.success("Log entry deleted"),
            onError: (e: unknown) => toast.error((e as Error)?.message || "Could not delete"),
          });
        }}
      />

      {/* Full-screen takeover — not a small popup and not a routed page per booking,
          just this same route expanding to fill the screen while recording. */}
      <Dialog open={!!active} onOpenChange={(o) => !o && close()}>
        {/* While the custom fold+fly-away animation is playing (kh-fold-send below),
            the panel is already fully faded/transformed off-screen by the time this
            Dialog's `open` flips to false. Radix's own built-in close transition
            would then still fire on top of that — a second, unrelated motion in a
            different direction right as the content disappears, reading as a
            stutter/jitter. Suppressing it here means the custom animation is the
            only motion the user ever sees. kh-shell-fade dissolves the shell
            (background + close button) across the same window instead of leaving
            it frozen and opaque behind the shrinking content, and the close
            button itself is hidden — a lone interactive element sitting on an
            otherwise-animating screen reads as broken. */}
        <DialogFullContent
          className={
            sending
              ? "data-[state=closed]:animate-none duration-0 kh-shell-fade [&>button:last-child]:hidden"
              : undefined
          }
        >
          <div
            className={cn("flex h-full flex-col", sending && "kh-fold-send pointer-events-none")}
            onAnimationEnd={(e) => {
              if (e.animationName === "kh-fold-send") finishSendAnimation();
            }}
          >
            <div className="shrink-0 border-b px-6 py-4 md:px-8">
              <DialogTitle>Measurements — {active?.customer}</DialogTitle>
              <DialogDescription>
                One measurement set per customer — reused across every garment and tailor. Tap a
                point on the figure or a number below to enter it.
              </DialogDescription>
              {existing.data && !sending && (
                <p className="mt-1.5 text-xs text-primary font-medium">
                  Already sent to the customer
                  {existing.data.approved_at ? " and approved" : " — awaiting their approval"}.
                  Editing and sending again will update it.
                </p>
              )}
            </div>

            <div className="flex flex-1 min-h-0 flex-col md:flex-row">
              <div
                className="hidden md:flex shrink-0 min-h-0 items-center justify-center border-r bg-muted/20 p-4"
                style={{ width: "clamp(340px, 30vw, 540px)" }}
              >
                <MeasurementDiagram
                  points={allPoints}
                  values={values}
                  activeKey={activeKey}
                  onPick={pick}
                  numbers={numbers}
                  tint={active?.gender ?? null}
                />
              </div>
              <div className="flex-1 min-h-0 min-w-0 overflow-y-auto p-6 md:p-8">
                <div className="space-y-6">
                  {[...groups.entries()].map(([region, pts]) => (
                    <div key={region} className="space-y-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {REGION_LABELS[region] ?? region}
                      </div>
                      <div className="grid gap-x-4 gap-y-3 grid-cols-[repeat(auto-fit,minmax(190px,1fr))]">
                        {pts.map((p) => (
                          <div key={p.key} className="space-y-1">
                            <Label htmlFor={p.key} className="text-xs flex items-center gap-1.5">
                              <span
                                className={`inline-flex w-5 h-5 rounded-full items-center justify-center text-[10px] font-bold shrink-0 ${activeKey === p.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                              >
                                {numbers[p.key]}
                              </span>
                              {p.label} ({p.unit})
                            </Label>
                            <Input
                              id={p.key}
                              type="number"
                              inputMode="decimal"
                              value={values[p.key] ?? ""}
                              onFocus={() => setActiveKey(p.key)}
                              onChange={(e) =>
                                setValues((v) => ({ ...v, [p.key]: e.target.value }))
                              }
                              placeholder="0"
                              className={activeKey === p.key ? "ring-2 ring-primary" : ""}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {allPoints.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No measurement points configured yet — the platform admin defines these.
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Need a point that isn't listed? Ask the platform to add it to the master list.
                  </p>
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t px-6 py-4 md:px-8 flex justify-end gap-2">
              <Button variant="outline" onClick={close} disabled={upload.isPending || sending}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={upload.isPending || sending}>
                <IconSend2 size={15} className="mr-1" />
                {upload.isPending ? "Saving…" : sending ? "Sent" : "Send to customer"}
              </Button>
            </div>
          </div>
        </DialogFullContent>
      </Dialog>
    </div>
  );
}
