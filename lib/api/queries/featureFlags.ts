import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../client";

export type FeatureFlag = {
  name: string;
  label: string;
  description: string | null;
  enabled_tailor: boolean;
  enabled_customer: boolean;
  sort_order: number;
  updated_at: string;
};

export function useFeatureFlags() {
  return useQuery({
    queryKey: ["feature-flags"],
    queryFn: ({ signal }) => apiClient.get<FeatureFlag[]>("/feature-flags", { signal }),
    staleTime: 5 * 60 * 1000,
    // Don't retry aggressively — the table may not exist in all envs yet.
    retry: 1,
  });
}

/** Returns true if a given flag is enabled for tailor (defaults to true when loading/missing). */
export function useTailorFlag(name: string): boolean {
  const q = useFeatureFlags();
  if (!q.data) return true;
  const flag = q.data.find((f) => f.name === name);
  return flag === undefined ? true : flag.enabled_tailor;
}

export function useUpdateFeatureFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      name,
      enabled_tailor,
      enabled_customer,
    }: {
      name: string;
      enabled_tailor: boolean;
      enabled_customer: boolean;
    }) =>
      apiClient.put<FeatureFlag>(`/feature-flags/${name}`, { enabled_tailor, enabled_customer }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feature-flags"] }),
  });
}
