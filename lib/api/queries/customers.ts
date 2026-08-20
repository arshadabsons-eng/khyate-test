import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../client";
import type {
  CustomerListResponse,
  CustomerDetail,
  CustomerActivityEvent,
  Paginated,
  CustomerOrderRow,
  CustomerDisputeRow,
  CustomerReviewRow,
} from "../types";

export type CustomerFilters = {
  search?: string;
  status?: "active" | "suspended" | "flagged" | "all";
  city?: string;
  joined_from?: string;
  joined_to?: string;
  page?: number;
  limit?: number;
  sort?: "newest" | "oldest" | "spent_desc" | "orders_desc" | "name_asc";
};

export function useCustomers(filters: CustomerFilters) {
  return useQuery({
    queryKey: ["customers", filters],
    queryFn: ({ signal }) =>
      apiClient.get<CustomerListResponse>("/customers", { params: filters, signal }),
    staleTime: 30 * 1000,
    placeholderData: (prev) => prev,
  });
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: ["customers", id],
    queryFn: ({ signal }) => apiClient.get<CustomerDetail>(`/customers/${id}`, { signal }),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

export function useCustomerOrders(id: string | undefined, page = 1) {
  return useQuery({
    queryKey: ["customers", id, "orders", page],
    queryFn: ({ signal }) =>
      apiClient.get<Paginated<CustomerOrderRow>>(`/customers/${id}/orders`, {
        params: { page, limit: 20 },
        signal,
      }),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

export function useCustomerDisputes(id: string | undefined) {
  return useQuery({
    queryKey: ["customers", id, "disputes"],
    queryFn: ({ signal }) =>
      apiClient.get<Paginated<CustomerDisputeRow>>(`/customers/${id}/disputes`, { signal }),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

export function useCustomerReviews(id: string | undefined) {
  return useQuery({
    queryKey: ["customers", id, "reviews"],
    queryFn: ({ signal }) =>
      apiClient.get<Paginated<CustomerReviewRow>>(`/customers/${id}/reviews`, { signal }),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

export function useCustomerActivity(id: string | undefined) {
  return useQuery({
    queryKey: ["customers", id, "activity"],
    queryFn: ({ signal }) =>
      apiClient.get<CustomerActivityEvent[]>(`/customers/${id}/activity`, { signal }),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

export function useSuspendCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/customers/${id}/suspend`, { reason }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customers", id] });
    },
  });
}

export function useReinstateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/customers/${id}/reinstate`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customers", id] });
    },
  });
}

export function useResetCustomerPassword() {
  return useMutation({
    mutationFn: ({ id, new_password }: { id: string; new_password?: string }) =>
      apiClient.post<{ success: boolean; temp_password: string | null; password_set: boolean }>(
        `/customers/${id}/reset-password`,
        new_password ? { new_password } : {},
      ),
  });
}

export function useFlagCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/customers/${id}/flag`, { reason }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customers", id] });
    },
  });
}

export function useUnflagCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/customers/${id}/unflag`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["customers", id] });
    },
  });
}

export function useRevealPhone() {
  return useMutation({
    mutationFn: (id: string) => apiClient.post<{ phone: string }>(`/customers/${id}/reveal-phone`),
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/customers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useRequestCustomerDeletion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post(`/customers/${id}/request-deletion`, { reason }),
    onSuccess: (_, { id }) => qc.invalidateQueries({ queryKey: ["customers", id] }),
  });
}

export function useCancelCustomerDeletionRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/customers/${id}/cancel-deletion-request`),
    onSuccess: (_, id) => qc.invalidateQueries({ queryKey: ["customers", id] }),
  });
}
