import type { ReactNode } from "react";
import {
  IconAlertCircle,
  IconRefresh,
  IconInbox,
  IconLoader2,
  type Icon as TablerIcon,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApiError } from "@/lib/api/client";

export function ErrorState({
  error,
  onRetry,
  title = "Couldn't load this",
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  const apiErr = error as Partial<ApiError> | undefined;
  const status = apiErr?.status;
  const message = apiErr?.message ?? "Unknown error.";
  const isBackendOff = status === 0 || status === 404;
  return (
    <div className="border rounded-xl p-8 text-center bg-card">
      <div className="inline-flex w-12 h-12 rounded-full bg-destructive/10 text-destructive items-center justify-center mb-3">
        <IconAlertCircle size={24} />
      </div>
      <div className="font-medium">{title}</div>
      <div className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
        {isBackendOff ? "This data isn't available right now. Please try again shortly." : message}
      </div>
      {status ? (
        <div className="text-xs text-muted-foreground mt-2 font-mono">HTTP {status}</div>
      ) : null}
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-4">
          <IconRefresh size={14} className="mr-1.5" />
          Try again
        </Button>
      )}
    </div>
  );
}

export function LoadingRows({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-2">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-10 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function LoadingCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-xl" />
      ))}
    </div>
  );
}

export function CenteredSpinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <IconLoader2 size={28} className="animate-spin" />
      {label && <div className="text-sm mt-2">{label}</div>}
    </div>
  );
}

export function NoData({
  icon: Icon = IconInbox,
  title,
  description,
  action,
}: {
  icon?: TablerIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="text-center py-16 px-4">
      <div className="inline-flex w-12 h-12 rounded-full bg-muted items-center justify-center mb-3">
        <Icon size={24} className="text-muted-foreground" />
      </div>
      <div className="font-medium">{title}</div>
      {description && (
        <div className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">{description}</div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
