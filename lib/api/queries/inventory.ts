import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../client";
import type {
  Material,
  Category,
  CategoryInput,
  SubscriptionTier,
  SizeRow,
  GenderTarget,
  QualityTier,
  MaterialType,
  Paginated,
} from "../types";

// ── Materials ──

export type MaterialFilters = {
  search?: string;
  material_type?: MaterialType[];
  quality_tier?: QualityTier[];
  gender?: GenderTarget;
  color_name?: string;
  is_active?: boolean;
  page?: number;
  limit?: number;
  sort?: "name_asc" | "name_desc" | "created_desc";
};

export function useMaterials(filters: MaterialFilters) {
  return useQuery({
    queryKey: ["inventory", "materials", filters],
    queryFn: ({ signal }) =>
      apiClient.get<Paginated<Material>>("/inventory/materials", {
        params: filters,
        signal,
      }),
    staleTime: 2 * 60 * 1000,
    placeholderData: (prev) => prev,
  });
}

/** Tailor-readable catalog of active fabrics (any role; no admin 403). */
export function useMaterialsCatalog() {
  return useQuery({
    queryKey: ["inventory", "materials-catalog"],
    queryFn: ({ signal }) =>
      apiClient.get<Paginated<Material>>("/inventory/materials-catalog", { signal }),
    staleTime: 5 * 60 * 1000,
  });
}

export type GarmentOption = { slug: string; name: string; name_ar?: string; gender?: string };
/** Tailor-readable garment catalog for listing dropdowns (admin-managed). */
export function useGarmentsPublic() {
  return useQuery({
    queryKey: ["inventory", "garments-public"],
    queryFn: ({ signal }) =>
      apiClient.get<GarmentOption[]>("/inventory/garments-public", { signal }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useStyleCategories() {
  return useQuery({
    queryKey: ["inventory", "style-categories"],
    queryFn: ({ signal }) =>
      apiClient.get<{ id: string; name: string; name_ar: string; slug: string }[]>(
        "/inventory/style-categories-public",
        { signal },
      ),
    staleTime: 5 * 60 * 1000,
  });
}

export function useMaterial(id: string | undefined) {
  return useQuery({
    queryKey: ["inventory", "materials", id],
    queryFn: ({ signal }) => apiClient.get<Material>(`/inventory/materials/${id}`, { signal }),
    enabled: !!id,
  });
}

// ["inventory","materials"] doesn't prefix-match ["inventory","materials-catalog"]
// (different string at the same array index, not a shared prefix) — every
// material edit/delete/activation-toggle here left the tailor-facing fabric
// picker (useMaterialsCatalog, 5-minute staleTime) unrefreshed, so a tailor
// building a listing could keep selecting a material an admin had just
// deactivated or deleted for up to 5 minutes.
function invalidateMaterials(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["inventory", "materials"] });
  qc.invalidateQueries({ queryKey: ["inventory", "materials-catalog"] });
}

export function useUpsertMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: Partial<Material> }) =>
      id
        ? apiClient.put<Material>(`/inventory/materials/${id}`, body)
        : apiClient.post<Material>("/inventory/materials", body),
    onSuccess: () => invalidateMaterials(qc),
  });
}

export function useDeleteMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/inventory/materials/${id}`),
    onSuccess: () => invalidateMaterials(qc),
  });
}

export function useBulkSetMaterialActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, is_active }: { ids: string[]; is_active: boolean }) =>
      apiClient.post<{ updated: number }>("/inventory/materials/bulk-active", { ids, is_active }),
    onSuccess: () => invalidateMaterials(qc),
  });
}

// ── Categories ──

export function useCategories(gender: GenderTarget | "unisex" | "all" = "all") {
  return useQuery({
    queryKey: ["inventory", "categories", gender],
    queryFn: ({ signal }) =>
      apiClient.get<{ data: Category[] }>("/inventory/categories", {
        params: { gender, include_inactive: true },
        signal,
      }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpsertCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: CategoryInput }) =>
      id
        ? apiClient.put<Category>(`/inventory/categories/${id}`, body)
        : apiClient.post<Category>("/inventory/categories", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory", "categories"] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/inventory/categories/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory", "categories"] }),
  });
}

export function useReorderCategories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ordered_ids: string[]) =>
      apiClient.put<{ success: boolean }>("/inventory/categories/reorder", { ordered_ids }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory", "categories"] }),
  });
}

// ── Plans ──

export function usePlans() {
  return useQuery({
    queryKey: ["inventory", "plans"],
    queryFn: ({ signal }) => apiClient.get<SubscriptionTier[]>("/inventory/plans", { signal }),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<SubscriptionTier> }) =>
      apiClient.put<SubscriptionTier>(`/inventory/plans/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inventory", "plans"] }),
  });
}

// ── Material offering approvals ──

export type PendingMaterialOffering = {
  id: string;
  tailor_id: string;
  material_id: string;
  price_per_meter_fils: number;
  colours: { hex: string; name?: string }[];
  images: string[];
  updated_at: string;
  business_name: string;
  material_name: string;
  sku: string;
};

export function useMaterialOfferingsPending() {
  return useQuery({
    queryKey: ["inventory", "material-offerings", "pending"],
    queryFn: ({ signal }) =>
      apiClient.get<PendingMaterialOffering[]>("/inventory/material-offerings/pending", {
        signal,
      }),
    staleTime: 30 * 1000,
  });
}

export function useApproveMaterialOffering() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{ success: boolean }>(`/inventory/material-offerings/${id}/approve`, {}),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["inventory", "material-offerings", "pending"] }),
  });
}

export function useRejectMaterialOffering() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.post<{ success: boolean }>(`/inventory/material-offerings/${id}/reject`, {
        reason,
      }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["inventory", "material-offerings", "pending"] }),
  });
}

// ── Sizes ──

export function useSizes() {
  return useQuery({
    queryKey: ["inventory", "sizes"],
    queryFn: ({ signal }) => apiClient.get<SizeRow[]>("/inventory/sizes", { signal }),
    staleTime: 5 * 60 * 1000,
  });
}

/** Active sizes for the listing form's size toggles (any role; admin-managed). */
export function useSizesPublic() {
  return useQuery({
    queryKey: ["inventory", "sizes-public"],
    queryFn: ({ signal }) => apiClient.get<SizeRow[]>("/inventory/sizes-public", { signal }),
    staleTime: 5 * 60 * 1000,
  });
}

// ["inventory","sizes"] doesn't prefix-match ["inventory","sizes-public"] —
// same gap as materials above (see invalidateMaterials) — so an admin editing
// or deleting a size template left the tailor-facing listing-form size picker
// (useSizesPublic, 5-minute staleTime) showing the old/deleted size for up to
// 5 minutes.
function invalidateSizes(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["inventory", "sizes"] });
  qc.invalidateQueries({ queryKey: ["inventory", "sizes-public"] });
}

export function useUpsertSize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id?: string; body: Partial<SizeRow> }) =>
      id
        ? apiClient.put<SizeRow>(`/inventory/sizes/${id}`, body)
        : apiClient.post<SizeRow>("/inventory/sizes", body),
    onSuccess: () => invalidateSizes(qc),
  });
}

export function useDeleteSize() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete<void>(`/inventory/sizes/${id}`),
    onSuccess: () => invalidateSizes(qc),
  });
}
