import { IconArrowDownRight, IconArrowUpRight, type Icon } from "@tabler/icons-react";
import { useCountUp } from "@/hooks/useCountUp";
import { Dh } from "@/components/common/Money";

export function StatCard({
  label,
  value,
  delta,
  suffix,
  icon: IconCmp,
  className,
  money = false,
}: {
  label: string;
  value: string | number;
  delta?: number;
  suffix?: string;
  icon?: Icon;
  className?: string;
  money?: boolean;
}) {
  const positive = (delta ?? 0) >= 0;
  const animated = useCountUp(value);

  return (
    <div
      className={`group kh-card kh-stat bg-card border rounded-xl p-4 sm:p-5 ${className ?? ""}`}
    >
      <div className="flex items-start justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          {label}
        </div>
        {IconCmp ? (
          <IconCmp
            size={18}
            className="text-muted-foreground shrink-0 transition-colors duration-200 group-hover:text-primary"
          />
        ) : null}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">
        {money ? <Dh className="mr-1 opacity-80" /> : null}
        <span className="kh-value">{animated}</span>
        {suffix ? <span className="text-sm text-muted-foreground ml-1">{suffix}</span> : null}
      </div>
      {delta !== undefined && (
        <div
          className={`mt-2 inline-flex items-center gap-1 text-xs font-medium ${positive ? "text-success" : "text-destructive"}`}
        >
          {positive ? <IconArrowUpRight size={14} /> : <IconArrowDownRight size={14} />}
          {Math.abs(delta).toFixed(1)}%{" "}
          <span className="text-muted-foreground font-normal">vs yesterday</span>
        </div>
      )}
    </div>
  );
}
