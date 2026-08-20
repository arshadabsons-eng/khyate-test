import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../client";
import type { Notification } from "../types";

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: ({ signal }) =>
      apiClient.get<{ data: Notification[]; unread_count: number }>("/notifications", {
        params: { limit: 5, sort: "newest" },
        signal,
      }),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/notifications/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export type AdminAlert = {
  key: string;
  label: string;
  count: number;
  severity: "high" | "medium" | "low";
  link: string;
};

// "What needs my attention" — computed live from each domain's own state
// (escalated disputes, KYC backlog, failed payouts, content reports,
// low-stock materials), not the per-user notifications table, which no
// backend code path ever writes an admin/role-targeted row into.
export function useAdminAlerts() {
  return useQuery({
    queryKey: ["admin-alerts"],
    queryFn: ({ signal }) =>
      apiClient.get<{ alerts: AdminAlert[]; total: number }>("/admin/alerts", { signal }),
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });
}
