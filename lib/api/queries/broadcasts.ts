import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../client";
import type { BroadcastRow, MessageThread, ThreadMessage, Paginated } from "../types";

export function useBroadcasts(page = 1) {
  return useQuery({
    queryKey: ["broadcasts", page],
    queryFn: ({ signal }) =>
      apiClient.get<Paginated<BroadcastRow>>("/notifications/broadcasts", {
        params: { page, limit: 20 },
        signal,
      }),
    staleTime: 30 * 1000,
    placeholderData: (prev) => prev,
  });
}

export function useSendBroadcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      title_en: string;
      title_ar: string;
      body_en: string;
      body_ar: string;
      target_audience: "all" | "tailors" | "customers" | "specific_tier";
      target_tier?: string;
    }) => apiClient.post<BroadcastRow>("/notifications/broadcast/send", payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["broadcasts"] }),
  });
}

export function useMessageThreads(page = 1, search?: string) {
  return useQuery({
    queryKey: ["message-threads", page, search],
    queryFn: ({ signal }) =>
      apiClient.get<Paginated<MessageThread>>("/messages/threads", {
        params: { page, limit: 30, search },
        signal,
      }),
    staleTime: 15 * 1000,
    placeholderData: (prev) => prev,
  });
}

export function useThreadMessages(thread_id: string | undefined) {
  return useQuery({
    queryKey: ["message-threads", thread_id, "messages"],
    queryFn: ({ signal }) =>
      apiClient.get<ThreadMessage[]>(`/messages/threads/${thread_id}`, { signal }),
    enabled: !!thread_id,
    refetchInterval: 10 * 1000,
  });
}

export function useReplyToThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ thread_id, content }: { thread_id: string; content: string }) =>
      apiClient.post(`/messages/threads/${thread_id}/reply`, { content }),
    onSuccess: (_, { thread_id }) => {
      qc.invalidateQueries({ queryKey: ["message-threads", thread_id, "messages"] });
    },
  });
}

export function useCloseThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (thread_id: string) => apiClient.post(`/messages/threads/${thread_id}/close`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["message-threads"] }),
  });
}
