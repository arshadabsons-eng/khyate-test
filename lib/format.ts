import { format } from "date-fns";
import { toast } from "sonner";

// Money: monetary values cross the wire as integer fils. These helpers return the
// NUMBER ONLY (no "AED"/"Dh" text) — the UAE Dirham symbol is rendered as the
// official glyph via the <Money>/<Dh> components (components/common/Money.tsx),
// per UAE Central Bank guidance to use the new symbol instead of text.
// Coerce anything (incl. Postgres numeric-as-string) to a finite number so the
// money/chart formatters never crash with "toFixed is not a function".
const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const aed = (n: number | null | undefined) =>
  num(n).toLocaleString("en-AE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const filsToAed = (fils: number | null | undefined) => aed(num(fils) / 100);

// Compact display for chart axes (e.g. 12k, 1.4m) — number only.
export const aedCompact = (fils: number | null | undefined) => {
  const aedValue = num(fils) / 100;
  if (Math.abs(aedValue) >= 1_000_000) return `${(aedValue / 1_000_000).toFixed(1)}m`;
  if (Math.abs(aedValue) >= 1_000) return `${(aedValue / 1_000).toFixed(1)}k`;
  return `${aedValue.toFixed(0)}`;
};

// Parse to a valid Date or null (guards against null/undefined/"" /bad strings).
const toDate = (d: Date | string | number | null | undefined): Date | null => {
  if (d === null || d === undefined || d === "") return null;
  const date = d instanceof Date ? d : new Date(d);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const fmtDate = (d: Date | string | null | undefined) => {
  const date = toDate(d);
  return date ? format(date, "dd MMM yyyy") : "—";
};

export const fmtDateTime = (d: Date | string | null | undefined) => {
  const date = toDate(d);
  return date ? format(date, "dd MMM yyyy, HH:mm") : "—";
};

export const relTime = (d: Date | string | number | null | undefined) => {
  const date = toDate(d);
  if (!date) return "—";
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export const fmtNumber = (n: number | null | undefined) => (n ?? 0).toLocaleString();

// Build a CSV from an array of flat objects and trigger a download. Every
// call site passes `data?.data ?? []` straight from a query with no loading
// guard — clicking Export while the table is still loading (or after a
// filter narrows results to zero) used to silently no-op with no feedback
// at all, reading as "the button doesn't work."
export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) {
    toast.error("Nothing to export yet — wait for the table to load or adjust your filters.");
    return;
  }
  const headers = Object.keys(rows[0]);
  // CSV/formula-injection guard: a cell whose text starts with =, +, -, @, tab
  // or CR is interpreted as a live formula by Excel/Sheets the moment this
  // export is opened — quoting alone (below) does not prevent that. Several
  // exported fields (tailor/customer name, city) are user-supplied at
  // signup, so this isn't hypothetical. Prefixing with a bare apostrophe
  // forces spreadsheet apps to treat the cell as literal text while leaving
  // the value itself, and every non-formula cell, completely unchanged.
  const esc = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join(
    "\n",
  );
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// Mask name as "First L." for review reviewers, customer references, etc.
export const maskName = (name?: string | null) => {
  const parts = (name ?? "").trim().split(" ").filter(Boolean);
  const first = parts[0] ?? "";
  const lastInitial = parts.length > 1 ? `${parts[parts.length - 1][0]}.` : "";
  return `${first} ${lastInitial}`.trim();
};

// Mask a phone number to "+971••••43" (keep the country/area prefix + last
// two digits, hide the rest) until an admin explicitly reveals it.
export const maskPhone = (phone?: string | null) => {
  const p = (phone ?? "").trim();
  if (p.length < 6) return p || "—";
  return `${p.slice(0, 4)}••••${p.slice(-2)}`;
};

export const initialsOf = (name: string | null | undefined) =>
  (name ?? "")
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

// Format a duration in seconds as "Xh Ym" or "BREACHED · Xh Ym ago"
export const fmtSlaRemaining = (seconds: number) => {
  const breached = seconds <= 0;
  const abs = Math.abs(seconds);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  return breached ? `BREACHED · ${h}h ${m}m ago` : `${h}h ${m}m`;
};
