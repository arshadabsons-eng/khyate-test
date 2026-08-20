import { cn } from "@/lib/utils";

type Variant = "success" | "warning" | "danger" | "info" | "neutral" | "primary";

const styles: Record<Variant, string> = {
  success: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning-foreground border-warning/30",
  danger: "bg-destructive/15 text-destructive border-destructive/30",
  info: "bg-info/15 text-info border-info/30",
  neutral: "bg-muted text-muted-foreground border-border",
  primary: "bg-primary-soft text-primary-dark border-primary/20",
};

export function StatusBadge({
  status,
  className,
}: {
  status: string | null | undefined;
  className?: string;
}) {
  const v = mapVariant(status ?? "");
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
        styles[v],
        className,
      )}
    >
      {status ?? "—"}
    </span>
  );
}

function mapVariant(s: string): Variant {
  const k = s.toLowerCase();
  if (["active", "verified", "completed", "delivered", "paid", "resolved", "success"].includes(k))
    return "success";
  if (
    [
      "pending",
      "pending review",
      "under review",
      "processing",
      "awaiting response",
      "in progress",
      "ready",
      "warning",
      "disputed",
      "peer_resolution",
    ].includes(k)
  )
    return "warning";
  if (
    [
      "blocked",
      "rejected",
      "failed",
      "cancelled",
      "escalated",
      "suspended",
      "refunded",
      "expired",
      "actioned",
    ].includes(k)
  )
    return "danger";
  if (["confirmed", "open", "info", "featured"].includes(k)) return "info";
  if (["bronze", "silver", "gold", "platinum"].includes(k)) return "primary";
  return "neutral";
}
