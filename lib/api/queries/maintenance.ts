import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../client";
import type { MaintenanceScope } from "../types";

export type MaintenanceStatus = {
  active: boolean;
  scope: MaintenanceScope;
  starts_at: string | null;
  ends_at: string | null;
  message: string;
  /** True once the countdown banner should show — already down, or inside the
   *  admin-configured notice window before a planned start. */
  show_notice: boolean;
};

/** Public maintenance schedule. Polled (not just fetched once) so a window
 *  scheduled while someone is mid-session still reaches them, and so the
 *  banner clears itself when the window ends without needing a reload. */
export function useMaintenance() {
  return useQuery({
    queryKey: ["maintenance"],
    queryFn: ({ signal }) => apiClient.get<MaintenanceStatus>("/maintenance", { signal }),
    staleTime: 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    // Never surface a failure here — a missing banner is strictly better than
    // an error state on every page because a status probe hiccupped.
    retry: false,
  });
}
