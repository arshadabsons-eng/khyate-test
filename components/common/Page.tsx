import type { ReactNode } from "react";
import { IconInbox, type Icon as TablerIcon } from "@tabler/icons-react";

/**
 * Shared content width for every page. Fills the viewport on laptops/desktops
 * (the wide cap only engages past ~1980px once the 220px sidebar is accounted
 * for) so dense pages use the screen instead of stranding content in a column.
 * Owns the horizontal page padding so it tracks the content width.
 *
 * width:
 *  - "wide"   (default) — dashboards/lists: fill the screen up to 1760px
 *  - "form"   — settings/detail forms: comfortable, still wide enough for 2 cols
 *  - "narrow" — opt-in single-column (rarely needed)
 */
const WIDTHS = {
  wide: "max-w-[1760px]",
  form: "max-w-[1100px]",
  narrow: "max-w-3xl",
} as const;

export function PageContainer({
  children,
  className = "",
  width = "wide",
}: {
  children: ReactNode;
  className?: string;
  width?: keyof typeof WIDTHS;
}) {
  return (
    <div className={`mx-auto w-full ${WIDTHS[width]} px-4 sm:px-6 lg:px-8 xl:px-10 ${className}`}>
      {children}
    </div>
  );
}

/**
 * Responsive form grid — one column on small screens, two on lg+ so settings &
 * detail forms use the available width instead of a stranded 768px column.
 * Wrap each card/section in <FormSection> (use span="full" for full-width rows).
 */
export function FormLayout({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 items-start ${className}`}>
      {children}
    </div>
  );
}

export function FormSection({
  children,
  span = "one",
  className = "",
}: {
  children: ReactNode;
  span?: "one" | "full";
  className?: string;
}) {
  return <div className={`${span === "full" ? "lg:col-span-2" : ""} ${className}`}>{children}</div>;
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 kh-section">
      <div className="min-w-0">
        <h1 className="kh-h1 font-serif text-foreground truncate">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1.5">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** For pages whose title lives in the topbar (tailor pages): carries description + actions without a second <h1>. */
export function PageSubheader({
  description,
  actions,
}: {
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4 kh-section">
      {description && <p className="text-sm text-muted-foreground max-w-2xl">{description}</p>}
      {actions && <div className="flex flex-wrap items-center gap-2 sm:ml-auto">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon: Icon = IconInbox,
  title,
  description,
}: {
  icon?: TablerIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="text-center py-16 px-4">
      <div className="inline-flex w-12 h-12 rounded-full bg-muted items-center justify-center mb-3">
        <Icon size={24} className="text-muted-foreground" />
      </div>
      <div className="kh-h3 font-serif">{title}</div>
      {description && <div className="text-sm text-muted-foreground mt-1">{description}</div>}
    </div>
  );
}

export function Card({
  children,
  className = "",
  title,
  action,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  action?: ReactNode;
}) {
  return (
    <div className={`kh-card bg-card border rounded-xl ${className}`}>
      {(title || action) && (
        <div className="px-5 py-4 border-b flex items-center justify-between">
          {title && <h3 className="kh-h3 font-serif">{title}</h3>}
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
}
