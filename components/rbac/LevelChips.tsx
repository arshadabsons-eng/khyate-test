import { IconStarFilled } from "@tabler/icons-react";
import type { PermLevel } from "@/lib/api/queries/rbac";

const LEVEL_LABEL: Record<PermLevel, string> = {
  none: "None",
  view: "View",
  edit: "Edit",
  admin: "Admin",
};

// Same semantic colors as today's dropdown (roles.tsx's LEVEL_STYLE), carried
// over so this redesign doesn't change what each level looks like, only how
// it's interacted with.
const LEVEL_STYLE: Record<PermLevel, string> = {
  none: "text-muted-foreground bg-muted/40 hover:bg-muted/70",
  view: "text-sky-700 bg-sky-50 hover:bg-sky-100",
  edit: "text-amber-700 bg-amber-50 hover:bg-amber-100",
  admin: "text-green-700 bg-green-50 hover:bg-green-100",
};

export type LevelChipsProps = {
  value: PermLevel;
  onChange: (level: PermLevel) => void;
  levels: PermLevel[];
  /** super_admin's cells: always full access, cannot be changed here — render
   *  a single locked, starred indicator instead of interactive chips. */
  locked?: boolean;
  /** Set when a role's rank can never clear this module's page-level rank
   *  floor (see _app.tsx's RANK_REQUIRED) regardless of what's granted here
   *  — e.g. Admin Users/Roles & Permissions require rank 3, which no custom
   *  role can ever reach (capped at rank 1). Unlike `locked`, this does NOT
   *  mean "always full access" — it means the opposite: no grant here can
   *  ever take effect, so the chips render disabled/grayed at whatever value
   *  is actually stored, with a tooltip explaining why, instead of a
   *  misleading interactive control. */
  rankCappedReason?: string;
  /** Smaller sizing for the matrix page's dense table cells. */
  compact?: boolean;
};

export function LevelChips({
  value,
  onChange,
  levels,
  locked,
  rankCappedReason,
  compact,
}: LevelChipsProps) {
  if (locked) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full font-medium text-amber-700 bg-amber-50 ${compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"}`}
        title="Super Admin always has full access — this can't be restricted."
      >
        <IconStarFilled size={compact ? 11 : 13} />
        Admin
      </span>
    );
  }
  if (rankCappedReason) {
    return (
      <div
        className="inline-flex items-center gap-1 opacity-40 cursor-not-allowed"
        title={rankCappedReason}
      >
        {levels.map((lvl) => (
          <span
            key={lvl}
            className={`rounded-full font-medium capitalize ${compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"} ${LEVEL_STYLE[lvl]} ${value === lvl ? "ring-2 ring-muted-foreground" : ""}`}
          >
            {LEVEL_LABEL[lvl]}
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-1">
      {levels.map((lvl) => (
        <button
          key={lvl}
          type="button"
          onClick={() => onChange(lvl)}
          className={`rounded-full font-medium capitalize transition-colors ${compact ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"} ${LEVEL_STYLE[lvl]} ${value === lvl ? "ring-2 ring-primary" : "opacity-60 hover:opacity-100"}`}
        >
          {LEVEL_LABEL[lvl]}
        </button>
      ))}
    </div>
  );
}
