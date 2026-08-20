import { IconStarFilled, IconStar, IconStarHalfFilled } from "@tabler/icons-react";

/** Simple read-only star rating display. */
export function Stars({
  rating,
  size = 16,
  className = "",
}: {
  rating: number;
  size?: number;
  className?: string;
}) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  return (
    <span className={`inline-flex items-center gap-0.5 text-gold ${className}`}>
      {Array.from({ length: 5 }).map((_, i) => {
        if (i < full) return <IconStarFilled key={i} size={size} />;
        if (i === full && half) return <IconStarHalfFilled key={i} size={size} />;
        return <IconStar key={i} size={size} className="text-muted-foreground/40" />;
      })}
    </span>
  );
}
