import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../client";

export type Delivery = {
  id: string;
  order_id: string;
  order_number: string;
  customer_name: string;
  tailor_name: string;
  status: string;
  emirate: string;
  customer_fee_fils: number;
  driver_cost_fils: number | null;
  profit_fils: number;
  courier_name: string | null;
  tracking_url: string | null;
  partner: string | null;
  partner_job_id: string | null;
  requested_at: string;
  assigned_at: string | null;
  delivered_at: string | null;
};
export type DeliveryKpi = {
  total: number;
  active: number;
  delivered: number;
  revenue_fils: number;
  cost_fils: number;
  profit_fils: number;
  avg_profit_fils: number;
};

export function useDeliveries(status: string) {
  return useQuery({
    queryKey: ["deliveries", status],
    queryFn: ({ signal }) =>
      apiClient.get<{ data: Delivery[]; kpi: DeliveryKpi }>("/deliveries", {
        params: { status },
        signal,
      }),
  });
}

export function useAssignDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      driver_cost_fils?: number;
      courier_name?: string;
      tracking_url?: string;
    }) => apiClient.post(`/deliveries/${id}/assign`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deliveries"] }),
  });
}

export function useUpdateDeliveryStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiClient.post(`/deliveries/${id}/status`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deliveries"] }),
  });
}

/** On-demand status refresh straight from the courier (independent of their webhook). */
export function useSyncDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post<Delivery>(`/deliveries/${id}/sync`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["deliveries"] }),
  });
}
