import { useEffect, useState } from "react";
import { IconTool } from "@tabler/icons-react";
import { useMaintenance } from "@/lib/api/queries/maintenance";

// Counts down to a scheduled maintenance window so users are warned in advance
// instead of walking into a wall mid-task. Renders nothing at all unless the
// backend says we're inside the admin-configured notice window (or already
// down) — see GET /api/maintenance and lib/maintenance.js.
function humanizeUntil(target: Date, now: number): string {
  const ms = target.getTime() - now;
  if (ms <= 0) return "now";
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${m}m`;
  return `${m}m`;
}

export function MaintenanceBanner() {
  const { data } = useMaintenance();
  // Re-render every 30s so the countdown actually ticks down.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!data?.show_notice) return null;

  const start = data.starts_at ? new Date(data.starts_at) : null;
  const end = data.ends_at ? new Date(data.ends_at) : null;
  const fmt = (d: Date) =>
    d.toLocaleString(undefined, {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
      day: "numeric",
      month: "short",
    });

  return (
    <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 p-3.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
      <IconTool size={18} className="shrink-0" />
      <div className="text-sm flex-1 min-w-0">
        {data.active ? (
          <>
            <span className="font-medium">Maintenance in progress.</span>{" "}
            {data.message || "Some features are temporarily unavailable while we upgrade Khyate."}
            {end && <> Expected back by {fmt(end)}.</>}
          </>
        ) : (
          <>
            <span className="font-medium">
              Scheduled maintenance{start ? ` in ${humanizeUntil(start, now)}` : ""}.
            </span>{" "}
            {data.message ||
              (start && end
                ? `Khyate will be unavailable from ${fmt(start)} to ${fmt(end)}.`
                : "Khyate will be briefly unavailable.")}
          </>
        )}
      </div>
    </div>
  );
}
