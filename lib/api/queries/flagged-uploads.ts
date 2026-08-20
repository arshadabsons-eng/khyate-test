import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../client";

// Backed by backend/src/routes/uploads.js's proactive SightEngine screening
// queue — previously had complete backend routes with no frontend consumer
// anywhere, so flagged content was invisible to every admin role.
export type FlaggedUpload = {
  id: string;
  upload_url: string;
  user_id: string | null;
  uploader_name: string | null;
  uploader_email: string | null;
  reasons: string[] | null;
  raw_score: Record<string, unknown> | null;
  status: "pending" | "dismissed" | "removed";
  created_at: string;
};

export type FlaggedUploadsResponse = {
  items: FlaggedUpload[];
  page: number;
  limit: number;
  total: number;
};

export function useFlaggedUploads(page: number) {
  return useQuery({
    queryKey: ["flagged-uploads", page],
    queryFn: ({ signal }) =>
      apiClient.get<FlaggedUploadsResponse>("/uploads/flagged", {
        params: { page, limit: 20 },
        signal,
      }),
    staleTime: 30 * 1000,
  });
}

export function useDismissFlaggedUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/uploads/flagged/${id}/dismiss`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["flagged-uploads"] }),
  });
}

export function useRemoveFlaggedUpload() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/uploads/flagged/${id}/remove`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["flagged-uploads"] }),
  });
}
