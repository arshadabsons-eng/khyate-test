import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../client";

export type ContentReportPreview = {
  snippet?: string;
  title?: string;
  business_name?: string;
  thumb?: string | null;
  rating?: number;
};

export type ContentReport = {
  id: string;
  entity_type:
    | "review"
    | "listing"
    | "tailor_profile"
    | "message"
    | "portfolio_image"
    | "material_offering_image";
  entity_id: string;
  reason: string | null;
  status: "open" | "dismissed" | "actioned";
  created_at: string;
  reporter_name: string | null;
  reporter_id: string | null;
  preview?: ContentReportPreview | null;
};

export type ContentReportsResponse = {
  data: ContentReport[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  kpi: {
    open: string;
    dismissed: string;
    actioned: string;
    reviews: string;
    listings: string;
    tailor_profiles: string;
  };
};

export function useContentReports(opts: { entity_type?: string; status?: string; page?: number }) {
  return useQuery({
    queryKey: ["content-reports", opts],
    queryFn: ({ signal }) =>
      apiClient.get<ContentReportsResponse>("/content-reports", { params: opts, signal }),
    staleTime: 30 * 1000,
    placeholderData: (p) => p,
  });
}

// Lightweight count for the sidebar badge: open content reports. Polls every
// 60s; disabled for platform owners (no access to the moderation queue).
export function useOpenReportCount(enabled = true) {
  return useQuery({
    queryKey: ["content-reports-badge"],
    queryFn: ({ signal }) =>
      apiClient.get<ContentReportsResponse>("/content-reports", {
        params: { status: "open", limit: 1 },
        signal,
      }),
    select: (r) => Number(r.kpi?.open ?? 0),
    refetchInterval: 60 * 1000,
    enabled,
  });
}

export function useDismissReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/content-reports/${id}/dismiss`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-reports"] });
      // ["content-reports"] doesn't prefix-match ["content-reports-badge"]
      // (different string, not a shared array prefix) — same gap as the
      // disputes badge, so the sidebar count only ever updated on its own
      // 60s poll, never right after actually dismissing/actioning a report.
      qc.invalidateQueries({ queryKey: ["content-reports-badge"] });
    },
  });
}

export function useActionReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/content-reports/${id}/action`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["content-reports"] });
      qc.invalidateQueries({ queryKey: ["content-reports-badge"] });
    },
  });
}
