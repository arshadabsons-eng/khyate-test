import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../client";

export type DeliveryZoneRule = {
  emirate: string;
  partner: "jeebly" | "aramex" | "manual";
  updated_at: string | null;
  updated_by_name: string | null;
};
export type DeliverySettings = {
  delivery_active_partner: "jeebly" | "aramex" | "manual";
  zones: DeliveryZoneRule[];
  jeebly_connected: boolean;
  aramex_connected: boolean;
};
export type DeliveryActivityRow = {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
  created_at: string;
  actor_name: string | null;
};

export function useDeliverySettings() {
  return useQuery({
    queryKey: ["settings", "delivery"],
    queryFn: ({ signal }) => apiClient.get<DeliverySettings>("/settings/delivery", { signal }),
  });
}

export function useSetActivePartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (delivery_active_partner: string) =>
      apiClient.put("/settings/delivery", { delivery_active_partner }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings", "delivery"] }),
  });
}

export function useSetZonePartner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ emirate, partner }: { emirate: string; partner: string }) =>
      apiClient.put(`/settings/delivery/zones/${encodeURIComponent(emirate)}`, { partner }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings", "delivery"] }),
  });
}

export function useDeliveryActivity(page: number) {
  return useQuery({
    queryKey: ["deliveries", "activity", page],
    queryFn: ({ signal }) =>
      apiClient.get<{ data: DeliveryActivityRow[]; page: number; total_pages: number }>(
        "/deliveries/activity",
        { params: { page }, signal },
      ),
  });
}
