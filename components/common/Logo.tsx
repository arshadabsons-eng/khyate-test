/**
 * Khyate brand components — backed by the official logo set.
 *
 * /khyate-logo.png                          = needle-K mark only (favicon, avatar fallback)
 * /khyate-new-logo-set_khyate logo.png      = full green lockup (خياطي · K · KHYATE) for light surfaces
 * /khyate-new-logo-set_khyate logo_white.png= full white lockup for dark surfaces (green sidebar)
 *
 * BrandMark   — K-only icon, optionally on a white plate
 * BrandLockup — full lockup image sized for sidebars/topbars
 * BrandHero   — large full lockup for the login / marketing surfaces
 */

const LOGO_MARK = "/khyate-logo.png";
const LOGO_GREEN = "/khyate-new-logo-set_khyate logo.png";
const LOGO_WHITE = "/khyate-new-logo-set_khyate logo_white.png";

// ── BrandMark — needle-K icon only ───────────────────────────────────────────
export function BrandMark({
  size = 36,
  plate = true,
  className = "",
}: {
  size?: number;
  plate?: boolean;
  className?: string;
}) {
  if (!plate) {
    return (
      <span className={`inline-flex ${className}`} style={{ width: size, height: size }}>
        <img
          src={LOGO_MARK}
          alt="Khyate"
          width={size}
          height={size}
          className="object-contain"
          draggable={false}
        />
      </span>
    );
  }

  const plateSize = Math.round(size * 1.18);
  const inner = Math.round(size * 0.82);
  return (
    <span
      className={`inline-flex items-center justify-center rounded-xl bg-white shadow-sm shrink-0 ${className}`}
      style={{ width: plateSize, height: plateSize }}
    >
      <img
        src={LOGO_MARK}
        alt="Khyate"
        width={inner}
        height={inner}
        className="object-contain"
        draggable={false}
      />
    </span>
  );
}

// ── BrandLockup — full lockup image (sidebar / topbar) ───────────────────────
export function BrandLockup({
  subtitle,
  markSize = 32,
  onColor = false,
}: {
  subtitle?: string;
  markSize?: number;
  onColor?: boolean;
}) {
  // Lockup height roughly tracks the requested mark size.
  const h = Math.round(markSize * 1.1);
  return (
    <div className="flex flex-col gap-0.5">
      <img
        src={onColor ? LOGO_WHITE : LOGO_GREEN}
        alt="Khyate خياطي"
        style={{ height: h }}
        className="object-contain w-auto self-start"
        draggable={false}
      />
      {subtitle && (
        <span
          className={`text-[10px] uppercase tracking-wider ${onColor ? "text-white/80" : "text-muted-foreground"}`}
        >
          {subtitle}
        </span>
      )}
    </div>
  );
}

// ── BrandHero — large full lockup for the login page ─────────────────────────
export function BrandHero({
  compact = false,
  onColor = false,
  tagline = true,
}: {
  compact?: boolean;
  onColor?: boolean;
  tagline?: boolean;
}) {
  const h = compact ? 56 : 116;
  return (
    <div className="flex flex-col items-center select-none gap-4">
      <img
        src={onColor ? LOGO_WHITE : LOGO_GREEN}
        alt="Khyate خياطي"
        style={{ height: h }}
        className="object-contain w-auto"
        draggable={false}
      />
      {tagline && !compact && (
        <p className="text-xs tracking-[0.25em] uppercase text-primary/55">منصة الخياطة المخصصة</p>
      )}
    </div>
  );
}
