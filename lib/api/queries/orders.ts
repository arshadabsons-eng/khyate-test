import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../client";
import type {
  OrderListResponse,
  OrderDetail,
  OrderStatus,
  OrderType,
  PaymentStatus,
} from "../types";

export type OrderFilters = {
  status?: OrderStatus | "all";
  order_type?: OrderType[];
  date_from?: string;
  date_to?: string;
  tailor_id?: string;
  customer_id?: string;
  value_min_fils?: number;
  value_max_fils?: number;
  payment_status?: PaymentStatus[];
  flagged?: boolean;
  page?: number;
  limit?: number;
  sort?: "newest" | "oldest" | "value_desc" | "sla_breach_first";
};

export function useOrders(filters: OrderFilters) {
  return useQuery({
    queryKey: ["orders", filters],
    queryFn: ({ signal }) =>
      apiClient.get<OrderListResponse>("/orders", { params: filters, signal }),
    refetchInterval:
      filters.status === "pending" || filters.status === "in_progress" ? 60_000 : false,
    staleTime: 30 * 1000,
    placeholderData: (prev) => prev,
  });
}

export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: ["orders", id],
    queryFn: ({ signal }) => apiClient.get<OrderDetail>(`/orders/${id}`, { signal }),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

export function useRefundOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      amount_fils,
      reason,
      refund_type,
    }: {
      id: string;
      amount_fils: number;
      reason: string;
      refund_type: "full" | "partial";
    }) => apiClient.post(`/orders/${id}/refund`, { amount_fils, reason, refund_type }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["orders", vars.id] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export function useForceCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      reason,
      refund_full,
    }: {
      id: string;
      reason: string;
      refund_full: boolean;
    }) => apiClient.post(`/orders/${id}/force-cancel`, { reason, refund_full }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["orders", vars.id] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export function useEscalateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      dispute_type,
      description,
    }: {
      id: string;
      dispute_type: string;
      description: string;
    }) => apiClient.post(`/orders/${id}/escalate`, { dispute_type, description }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["orders", vars.id] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export function useSaveOrderNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      apiClient.post(`/orders/${id}/admin-note`, { note }),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["orders", vars.id] }),
  });
}

export function useMarkDelivered() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => apiClient.post(`/orders/${id}/mark-delivered`),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["orders", vars.id] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}
