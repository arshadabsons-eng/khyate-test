import { IconStarFilled } from "@tabler/icons-react";

export function Avatar({ initials, size = 32 }: { initials: string; size?: number }) {
  return (
    <div
      className="rounded-full bg-primary-soft text-primary-dark inline-flex items-center justify-center font-semibold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </div>
  );
}

export function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      <IconStarFilled size={14} className="text-warning" />
      <span className="text-sm font-medium">{rating.toFixed(1)}</span>
    </span>
  );
}
