// Shared between the KYC Review Queue (routes/_app/kyc-review.tsx) and the
// Verification page (routes/_app/verification.tsx) — both render ocr_flags
// values attached by kyc-ocr.js to the same tailor_documents rows. Used to
// live as two independently-maintained copies that had drifted apart (some
// wording, and verification.tsx had no severity split at all — every flag
// rendered the same plain amber regardless of how serious it was). One
// source of truth now, so the two pages can never disagree on what a flag
// means or how urgent it looks.
export const OCR_FLAG_LABEL: Record<string, string> = {
  unreadable: "OCR couldn't read this document",
  expired: "OCR reads this document as already expired",
  mismatch: "ID number doesn't match the partner's stored EID",
  expiry_mismatch: "Declared expiry doesn't match the document",
};

export const FLAG_SEVERITY: Record<string, "danger" | "amber"> = {
  unreadable: "danger",
  mismatch: "danger",
  expiry_mismatch: "danger",
  expired: "amber",
};
