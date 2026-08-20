import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../client";
import type {
  AdminUserListResponse,
  AdminUserRow,
  AdminAuditEntry,
  AdminRole,
  OwnerMetrics,
} from "../types";

/** Read-only owner/investor dashboard metrics (platform_owner + super_admin). */
export function useOwnerMetrics() {
  return useQuery({
    queryKey: ["owner-metrics"],
    queryFn: ({ signal }) => apiClient.get<OwnerMetrics>("/admin/owner-metrics", { signal }),
    staleTime: 60 * 1000,
  });
}

export function useAdminUsers(search?: string, limit?: number) {
  return useQuery({
    queryKey: ["admin-users", search, limit],
    queryFn: ({ signal }) =>
      apiClient.get<AdminUserListResponse>("/admin/users", { params: { search, limit }, signal }),
    staleTime: 60 * 1000,
    placeholderData: (prev) => prev,
  });
}

export function useAdminAuditLog(admin_id: string | undefined) {
  return useQuery({
    queryKey: ["admin-users", admin_id, "audit"],
    queryFn: ({ signal }) =>
      apiClient.get<AdminAuditEntry[]>(`/admin/users/${admin_id}/audit`, { signal }),
    enabled: !!admin_id,
  });
}

export function useCreateAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { full_name: string; email: string; role: AdminRole }) =>
      apiClient.post<AdminUserRow>("/admin/users", payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}

export function useDeactivateAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/admin/users/${id}/deactivate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}

export function useActivateAdmin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/admin/users/${id}/activate`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}

export function useUpdateAdminRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: AdminRole }) =>
      apiClient.put(`/admin/users/${id}/role`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}

export function useResetAdminTotp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/admin/users/${id}/reset-2fa`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}

export function useUpdateAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      full_name,
      email,
      staff_perk_enabled,
    }: {
      id: string;
      full_name?: string;
      email?: string;
      staff_perk_enabled?: boolean;
    }) =>
      apiClient.put(`/admin/users/${id}`, {
        ...(full_name !== undefined ? { full_name } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(staff_perk_enabled !== undefined ? { staff_perk_enabled } : {}),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}

export function useDeleteAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete<{ deleted: boolean; deactivated?: boolean }>(`/admin/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
  });
}

export function useResetAdminPassword() {
  return useMutation({
    mutationFn: ({ id, new_password }: { id: string; new_password?: string }) =>
      apiClient.post<{ temp_password: string | null; password_set: boolean }>(
        `/admin/users/${id}/reset-password`,
        new_password ? { new_password } : {},
      ),
  });
}

export function useGlobalAuditLog(page = 1, action?: string, entity_type?: string) {
  return useQuery({
    queryKey: ["audit-logs", page, action, entity_type],
    queryFn: ({ signal }) =>
      apiClient.get<{ data: AdminAuditEntry[]; total: number }>("/admin/audit-logs", {
        params: {
          page,
          limit: 50,
          ...(action ? { action } : {}),
          ...(entity_type ? { entity_type } : {}),
        },
        signal,
      }),
    staleTime: 30 * 1000,
    placeholderData: (prev) => prev,
  });
}
