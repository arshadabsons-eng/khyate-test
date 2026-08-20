import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../client";

// ── KYC review queue (swipe/pi-validator style, one-doc-at-a-time) ──
// Distinct from the tailor-level Verification queue in tailors.ts: this is the
// per-document, multi-reviewer quorum flow served by backend/src/routes/kyc-review.js.

export type KycReviewDocument = {
  id: string;
  tailor_id: string;
  partner_id: string | null;
  doc_type: string;
  status: string;
  id_number?: string | null;
  declared_expiry_mismatch?: boolean;
  ocr_status?: "pending" | "done" | "error" | "unavailable" | null;
  ocr_fields?: Record<string, unknown> | null;
  ocr_flags?: string[] | null;
  ocr_confidence?: number | null;
  business_name?: string | null;
  city?: string | null;
  partner_name?: string | null;
  partner_role?: string | null;
  stream_url: string;
};

export type NextReviewResponse =
  // unassigned_reviewer: true means validator teams exist but I'm not on one
  // — the queue looking empty isn't "nothing left to review", it's "ask an
  // admin to add me to a team" (see backend/src/routes/validator-teams.js).
  | { done: true; document: null; unassigned_reviewer?: boolean }
  | {
      done: false;
      reviewers_required: number;
      passes_so_far: number;
      team_name?: string | null;
      document: KycReviewDocument;
    };

// No refetchInterval on purpose — the reviewer explicitly pulls the next card
// after voting (via the invalidation below); auto-polling would refetch out
// from under them mid-read.
export function useNextReviewDocument() {
  return useQuery({
    queryKey: ["kyc-review", "next"],
    queryFn: ({ signal }) =>
      apiClient.get<NextReviewResponse>("/verification/review/next", { signal }),
    staleTime: 0,
  });
}

export function useReviewDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      verdict,
      reason,
      field_checks,
    }: {
      id: string;
      verdict: "pass" | "fail";
      reason?: string;
      field_checks?: Record<string, unknown>;
    }) =>
      apiClient.post<{ success: boolean; outcome: "approved" | "rejected" | "pending" }>(
        `/verification/documents/${id}/review`,
        { verdict, reason, field_checks },
      ),
    // Also invalidate on error (e.g. a 409 stale-claim if someone else graded
    // it first) so the queue refetches into a consistent state either way.
    // Grading a document here can also change a tailor's status (rejecting an
    // approved doc demotes an active tailor; approving one can auto-reactivate
    // a suspended one) — the Verification page (tailors.ts) reads the exact
    // same tailor_documents/tailor_profiles rows through its own query keys,
    // and previously never refreshed if it happened to be open at the same
    // time in another tab.
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["kyc-review", "next"] });
      qc.invalidateQueries({ queryKey: ["verification"] });
      qc.invalidateQueries({ queryKey: ["tailors"] });
    },
  });
}

export function useReleaseDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<{ success: boolean }>(`/verification/documents/${id}/release`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kyc-review", "next"] }),
  });
}
