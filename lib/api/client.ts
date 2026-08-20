// Thin typed fetch wrapper for the Khyate admin API.
// Talks to the live backend; set VITE_API_BASE_URL to point at a non-default host.

import { auth } from "@/lib/auth";

// Exported for the few raw-fetch call sites (login/signup) that can't use the
// wrapper (no auth token yet) but must still honor a non-default API host.
export const BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE_URL) || "/api";

export class ApiError extends Error {
  status: number;
  code?: string;
  fields?: Record<string, string>;
  constructor(message: string, status: number, code?: string, fields?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type RequestOptions = {
  params?: Record<string, string | number | boolean | undefined | null | (string | number)[]>;
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

let accessToken: string | null = null;
export function setAccessToken(token: string | null) {
  accessToken = token;
}

// Resolve the bearer token: in-memory first, else the stored login token.
function resolveToken(): string | null {
  if (accessToken) return accessToken;
  if (typeof localStorage !== "undefined") return localStorage.getItem("khyate.token");
  return null;
}

// Guard so a burst of concurrent 401s only triggers one logout/redirect.
let sessionExpiredHandled = false;
function handleSessionExpired() {
  if (sessionExpiredHandled) return;
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  // Don't bounce while already on the auth screens (e.g. a failed login attempt).
  if (path.startsWith("/login") || path.startsWith("/verify")) return;
  sessionExpiredHandled = true;
  setAccessToken(null);
  auth.logout();
  // Carry the current location through so a forced re-login can return the
  // admin to where they were, instead of always landing on a fixed
  // role-based home — a real place-losing annoyance on every session expiry.
  const back = window.location.pathname + window.location.search;
  const redirect = back && back !== "/" ? `?redirect=${encodeURIComponent(back)}` : "";
  window.location.assign(`/login${redirect}`);
}

function buildQuery(params: RequestOptions["params"]): string {
  if (!params) return "";
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      usp.set(k, v.join(","));
    } else {
      usp.set(k, String(v));
    }
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

async function request<T>(method: Method, path: string, opts: RequestOptions = {}): Promise<T> {
  const url = `${BASE_URL}${path}${buildQuery(opts.params)}`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...opts.headers,
  };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const token = resolveToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: "include",
      signal: opts.signal,
    });
  } catch (err) {
    throw new ApiError("Network error — backend not reachable.", 0, "network_error");
  }

  if (res.status === 204) return undefined as T;

  // Expired / invalid session: if we sent a token and the server rejected it,
  // clear auth and bounce to login once (avoids the silent 401-retry cascade).
  if (res.status === 401 && token) {
    handleSessionExpired();
  }

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const payload: unknown = isJson
    ? await res.json().catch(() => null)
    : await res.text().catch(() => null);

  if (!res.ok) {
    const errBody = (payload ?? {}) as {
      error?: string;
      message?: string;
      code?: string;
      fields?: Record<string, string>;
    };
    const message = errBody.error || errBody.message || `Request failed with status ${res.status}`;
    throw new ApiError(message, res.status, errBody.code, errBody.fields);
  }

  return payload as T;
}

/** Upload a single file (image or PDF) via multipart → returns { url }. */
async function uploadFile(file: File): Promise<{ url: string; mime: string; name: string }> {
  const token = resolveToken();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE_URL}/uploads`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
    credentials: "include",
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(payload?.error || "Upload failed", res.status);
  return payload;
}

/** Upload a KYC document to the encrypted, private pipeline (NOT /uploads). */
async function uploadSecureDoc(
  file: File,
  docType: string,
  partnerId?: string | null,
  expiryDate?: string | null,
  idNumber?: string | null,
): Promise<{ id: string; doc_type: string; partner_id: string | null; status: string }> {
  const token = resolveToken();
  const form = new FormData();
  form.append("file", file);
  form.append("doc_type", docType);
  if (partnerId) form.append("partner_id", partnerId);
  if (expiryDate) form.append("expiry_date", expiryDate);
  if (idNumber) form.append("id_number", idNumber);
  const res = await fetch(`${BASE_URL}/secure-docs`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body: form,
    credentials: "include",
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(payload?.error || "Upload failed", res.status);
  return payload;
}

/** Fetch a KYC document with the bearer token and return an object-URL for <img>/preview.
 *  Caller must URL.revokeObjectURL() when done. */
async function fetchSecureDocUrl(id: string): Promise<{ url: string; mime: string }> {
  const token = resolveToken();
  const res = await fetch(`${BASE_URL}/secure-docs/${id}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    credentials: "include",
  });
  if (!res.ok) throw new ApiError("Could not load document", res.status);
  const blob = await res.blob();
  return { url: URL.createObjectURL(blob), mime: blob.type };
}

/** Fetch a PDF (or any binary) with the bearer token and return an object-URL for
 *  inline display (e.g. an <iframe>/<embed>). Caller must URL.revokeObjectURL()
 *  when done (or before fetching a fresh one) to avoid leaking memory. */
async function fetchBlobUrl(path: string): Promise<{ url: string; mime: string }> {
  const token = resolveToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    credentials: "include",
  });
  if (!res.ok) throw new ApiError("Could not load the document", res.status);
  const blob = await res.blob();
  return { url: URL.createObjectURL(blob), mime: blob.type };
}

/** Fetch a PDF (e.g. an invoice) with the bearer token and download it. */
async function downloadPdf(path: string, filename = "document.pdf"): Promise<void> {
  const token = resolveToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    credentials: "include",
  });
  if (!res.ok) throw new ApiError("Could not generate the PDF", res.status);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export const apiClient = {
  uploadFile,
  uploadSecureDoc,
  fetchSecureDocUrl,
  fetchBlobUrl,
  downloadPdf,
  get: <T>(path: string, opts?: Omit<RequestOptions, "body">) => request<T>("GET", path, opts),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "body">) =>
    request<T>("POST", path, { ...opts, body }),
  put: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "body">) =>
    request<T>("PUT", path, { ...opts, body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "body">) =>
    request<T>("PATCH", path, { ...opts, body }),
  delete: <T>(path: string, opts?: Omit<RequestOptions, "body">) =>
    request<T>("DELETE", path, opts),
};
