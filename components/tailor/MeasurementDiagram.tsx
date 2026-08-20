// The precise Khyate body silhouette (front view) with a small numbered dot at each
// measurement point's true anatomical position — wrist on the wrist, etc. Empty dots
// take the person's gender colour (blue male / pink female, green if unknown); a dot
// fills solid green once its value is entered. The same numbers sit beside each input
// label (see measurements.tsx). The active point is enlarged.
import type { MeasurePoint } from "@/lib/api/queries/tailor";

// The silhouette's own coordinate space (viewBox).
const VB_W = 468.7;
const VB_H = 1089.26;

// Anatomical positions in that space.
// Coordinates verified against the real silhouette by rasterising it and overlaying
// each numbered dot, so every number sits on its true body part.
//
// This is a static, hand-placed map — it has no link back to the `measure_points`
// DB table. It's currently in exact sync with the 16 seeded points, but nothing
// enforces that sync going forward. Two backend-only endpoints can add a new
// measure_points row that this map doesn't know about: the admin CRUD in
// backend/src/routes/inventory.js (POST /measure-points) and the tailor
// custom-point endpoint in backend/src/routes/tailor-me.js (POST /measure-points).
// Neither is currently wired to any UI, so this is latent risk, not an active bug —
// but if either ever ships a way to add a point, that new key needs a matching
// entry added here manually, or `points.filter((p) => POS[p.key])` below will
// silently drop it from the diagram (it'll still show fine in the plain text-field
// list, just with no dot).
const POS: Record<string, { x: number; y: number }> = {
  neck: { x: 234, y: 188 },
  shoulder: { x: 146, y: 230 },
  chest: { x: 266, y: 289 },
  bust: { x: 200, y: 320 },
  arm_width: { x: 132, y: 330 },
  arm_length: { x: 110, y: 420 },
  // Waist and abdomen sit inline, at the same waist level, side by side.
  waistline: { x: 234, y: 420 },
  abdomen: { x: 278, y: 420 },
  sleeve_length: { x: 88, y: 521 },
  seat: { x: 301, y: 462 },
  // Off-centre and well below the leg split, on the inner-thigh fabric —
  // not on the crotch line, so it doesn't read as an anatomical marker.
  inseam: { x: 256, y: 660 },
  wrist: { x: 78, y: 588 },
  // Thigh: lower down, centred on the right thigh.
  thigh: { x: 282, y: 715 },
  foreleg: { x: 274, y: 875 },
  // Height = total, top-to-bottom: a marker above the head, well clear to the right.
  length: { x: 332, y: 70 },
  ankle: { x: 246, y: 1028 },
};

const TINT: Record<string, string> = { female: "#E91E63", male: "#1E88E5" };

export function MeasurementDiagram({
  points,
  values,
  onPick,
  activeKey,
  numbers,
  tint,
  maxHeightCss = "920px",
}: {
  points: MeasurePoint[];
  values: Record<string, string>;
  onPick?: (key: string) => void;
  activeKey?: string | null;
  numbers?: Record<string, number>;
  tint?: "female" | "male" | null;
  /** Upper bound only — the figure otherwise fills whatever box its parent gives it,
   *  so it's never a fixed vh guess that can overflow a short (laptop) viewport. */
  maxHeightCss?: string;
}) {
  const placed = points.filter((p) => POS[p.key]);
  const numOf = (key: string, i: number) => numbers?.[key] ?? i + 1;
  // A gendered person's empty dots are solid blue/pink; unknown → hollow green.
  const genderFill = tint ? TINT[tint] : null;
  const hasHeight = placed.some((p) => p.key === "length");

  return (
    <div className="flex h-full w-full min-h-0 min-w-0 items-center justify-center">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ height: "100%", width: "100%", maxHeight: maxHeightCss }}
        role="img"
        aria-label="Measurement points on the body"
      >
        {/* The real silhouette — transparent, placed 1:1, never stretched or shrunk */}
        <image
          href="/body-silhouette.svg"
          x="0"
          y="0"
          width={VB_W}
          height={VB_H}
          preserveAspectRatio="xMidYMid meet"
        />
        {/* Height is a top-to-bottom total, not a body-part cross-section — show it as a
            dimension line (head to feet) so the number 1 badge reads as "the whole span". */}
        {hasHeight && (
          <g opacity="0.55" stroke="var(--muted-foreground)" strokeWidth="1.5">
            <line x1="332" y1="34" x2="332" y2="1050" strokeDasharray="4 5" />
            <line x1="324" y1="34" x2="340" y2="34" />
            <line x1="324" y1="1050" x2="340" y2="1050" />
          </g>
        )}
        {/* Numbered points */}
        {placed.map((p, i) => {
          const { x, y } = POS[p.key];
          const n = numOf(p.key, i);
          const filled =
            !!values[p.key] && values[p.key] !== "" && !Number.isNaN(parseFloat(values[p.key]));
          const active = activeKey === p.key;
          // Solid colour when measured (green) or a gendered person (blue/pink); else hollow green.
          const solid = filled ? "var(--primary)" : genderFill;
          return (
            <g
              key={p.key}
              onClick={() => onPick?.(p.key)}
              style={{ cursor: onPick ? "pointer" : "default" }}
            >
              <title>{`${n}. ${p.label}`}</title>
              {/* larger invisible hit area for easy tapping */}
              <circle cx={x} cy={y} r="28" fill="transparent" />
              <circle
                cx={x}
                cy={y}
                r={active ? 19 : 15}
                fill={solid ?? "var(--card)"}
                stroke={solid ?? "var(--primary)"}
                strokeWidth={active ? 4.2 : 2.6}
              />
              <text
                x={x}
                y={y + 5.5}
                textAnchor="middle"
                fontSize="17"
                fontWeight="800"
                fill={solid ? "var(--primary-foreground)" : "var(--primary)"}
              >
                {n}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
