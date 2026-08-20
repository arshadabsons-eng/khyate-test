import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../client";
import type {
  DisputeListResponse,
  DisputeDetail,
  DisputeStatus,
  DisputeType,
  ResolutionAction,
} from "../types";

export type DisputeFilters = {
  status?: DisputeStatus | "all" | "open";
  dispute_type?: DisputeType[];
  assigned_to?: string;
  sla_breached?: boolean;
  date_from?: string;
  date_to?: string;
  tailor_id?: string;
  customer_id?: string;
  page?: number;
  limit?: number;
  sort?: "sla_asc" | "sla_desc" | "raised_asc" | "raised_desc";
};

export function useDisputes(filters: DisputeFilters) {
  return useQuery({
    queryKey: ["disputes", filters],
    queryFn: ({ signal }) =>
      apiClient.get<DisputeListResponse>("/disputes", { params: filters, signal }),
    refetchInterval: 30 * 1000,
    placeholderData: (prev) => prev,
  });
}

// Lightweight count for the sidebar badge: disputes needing admin attention
// (open + escalated). Polls every 60s; disabled for platform owners (no access).
export function useOpenDisputeCount(enabled = true) {
  return useQuery({
    queryKey: ["disputes-badge"],
    queryFn: ({ signal }) =>
      apiClient.get<DisputeListResponse>("/disputes", { params: { limit: 1 }, signal }),
    select: (r) => Number(r.kpi?.open ?? 0) + Number(r.kpi?.escalated ?? 0),
    refetchInterval: 60 * 1000,
    enabled,
  });
}

export function useDispute(id: string | undefined) {
  return useQuery({
    queryKey: ["disputes", id],
    queryFn: ({ signal }) => apiClient.get<DisputeDetail>(`/disputes/${id}`, { signal }),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

type DisputeAnalytics = {
  total: number;
  open: number;
  avg_resolution_hours: number | null;
  escalation_rate_pct: number | null;
};

export function useDisputeAnalytics(from?: string, to?: string) {
  return useQuery({
    queryKey: ["disputes", "analytics", from, to],
    queryFn: ({ signal }) =>
      apiClient.get<DisputeAnalytics>("/disputes/analytics", { params: { from, to }, signal }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useClaimDispute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/disputes/${id}/claim`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["disputes", id] });
      qc.invalidateQueries({ queryKey: ["disputes"] });
      // React Query matches invalidateQueries by array PREFIX — ["disputes"]
      // does not match ["disputes-badge"] (different string, not a prefix of
      // it), so the sidebar badge count was never refreshed by any of these
      // mutations and only ever updated on its own 60s poll.
      qc.invalidateQueries({ queryKey: ["disputes-badge"] });
    },
  });
}

// Self-service takeover for a stuck claim — no idle-claim auto-expiry exists,
// so this is the manual equivalent (the claiming admin releasing their own
// claim, or a manager force-releasing someone else's).
export function useReleaseDispute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/disputes/${id}/release`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["disputes", id] });
      qc.invalidateQueries({ queryKey: ["disputes"] });
      qc.invalidateQueries({ queryKey: ["disputes-badge"] });
    },
  });
}

export function usePostDisputeMessage() {
  const qc = useQueryClient();
  return useMutation({
    // Backend expects `body` (not `content`); keep the FE prop name for callers.
    mutationFn: ({
      id,
      content,
      is_internal,
    }: {
      id: string;
      content: string;
      is_internal: boolean;
    }) => apiClient.post(`/disputes/${id}/messages`, { body: content, is_internal }),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["disputes", vars.id] }),
  });
}

/** Helpdesk: mark a claim genuine so an admin knows to issue the refund. */
export function useFlagGenuine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/disputes/${id}/flag-genuine`),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["disputes", id] });
      qc.invalidateQueries({ queryKey: ["disputes"] });
      qc.invalidateQueries({ queryKey: ["disputes-badge"] });
    },
  });
}

export function useResolveDispute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      action,
      refund_amount_fils,
      resolution_note,
    }: {
      id: string;
      action: ResolutionAction;
      refund_amount_fils?: number;
      resolution_note: string;
    }) =>
      apiClient.post(`/disputes/${id}/resolve`, { action, refund_amount_fils, resolution_note }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["disputes", vars.id] });
      qc.invalidateQueries({ queryKey: ["disputes"] });
      qc.invalidateQueries({ queryKey: ["disputes-badge"] });
    },
  });
}

// Lightweight "end/close" for escalated or stale disputes (no refund).
export function useCloseDispute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      apiClient.post(`/disputes/${id}/close`, note ? { note } : {}),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["disputes", vars.id] });
      qc.invalidateQueries({ queryKey: ["disputes"] });
      qc.invalidateQueries({ queryKey: ["disputes-badge"] });
    },
  });
}
