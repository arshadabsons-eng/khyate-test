import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../client";
import type { Paginated } from "../types";

export type SupportThread = {
  id: string;
  order_id: string | null;
  order_number: string | null;
  subject: string;
  status: "open" | "closed";
  created_at: string;
  last_message: string | null;
  last_at: string | null;
  unread_count: number;
  customer_name: string | null;
  tailor_name: string | null;
};

export type ThreadMessage = {
  id: string;
  body: string;
  created_at: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
};

export function useSupportThreads(status?: "open" | "closed" | "all") {
  return useQuery({
    queryKey: ["messages", "threads", status ?? "all"],
    queryFn: ({ signal }) =>
      apiClient.get<Paginated<SupportThread>>("/messages/threads", { params: { status }, signal }),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}

export function useThreadMessages(id: string | null) {
  return useQuery({
    queryKey: ["messages", "thread", id],
    queryFn: ({ signal }) => apiClient.get<ThreadMessage[]>(`/messages/threads/${id}`, { signal }),
    enabled: !!id,
    refetchInterval: 10_000,
  });
}

export function useReplyThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      apiClient.post(`/messages/threads/${id}/reply`, { body }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ["messages", "thread", id] });
      qc.invalidateQueries({ queryKey: ["messages", "threads"] });
    },
  });
}

export function useCloseThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/messages/threads/${id}/close`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages", "threads"] }),
  });
}

// Self-service undo for a thread closed by mistake — without this the only
// way back to "open" is the customer/tailor sending a new message.
export function useReopenThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/messages/threads/${id}/reopen`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages", "threads"] }),
  });
}
