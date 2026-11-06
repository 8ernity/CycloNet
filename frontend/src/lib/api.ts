export class ApiClientError extends Error {
  status: number;
  retryAfter?: number;
  detail?: string;

  constructor(message: string, status: number, retryAfter?: number, detail?: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.retryAfter = retryAfter;
    this.detail = detail;
  }
}

const rawUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
let cleaned = rawUrl.replace(/\/+$/, "").replace(/\/api$/, "");
if (cleaned && !cleaned.startsWith("http://") && !cleaned.startsWith("https://")) {
  cleaned = `https://${cleaned}`;
}
export const API_BASE_URL = cleaned;

/**
 * Dynamic API Base URL resolver that respects user-configured CUSTOM data source in Settings (Fix #37, UI-07).
 */
export function getApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    try {
      const source = localStorage.getItem("cyclonet_data_source");
      if (source === "CUSTOM") {
        const customUrl = localStorage.getItem("cyclonet_custom_api_url");
        if (customUrl && customUrl.trim()) {
          let clean = customUrl.trim().replace(/\/+$/, "").replace(/\/api$/, "");
          if (clean && !clean.startsWith("http://") && !clean.startsWith("https://")) {
            clean = `https://${clean}`;
          }
          if (clean) return clean;
        }
      }
    } catch {
      // Fallback on restricted browser environments or SSR
    }
  }
  return API_BASE_URL;
}

export function getStoredAuthToken(): string | null {
  if (typeof window !== "undefined") {
    try {
      // FIX 04: Prefer short-lived session storage credentials before long-lived localStorage
      return sessionStorage.getItem("cyclonet_auth_token") || localStorage.getItem("cyclonet_auth_token") || null;
    } catch {
      return null;
    }
  }
  return null;
}

export function setStoredAuthToken(token: string, persistent: boolean = false): void {
  if (typeof window !== "undefined") {
    try {
      if (persistent) {
        localStorage.setItem("cyclonet_auth_token", token);
      } else {
        sessionStorage.setItem("cyclonet_auth_token", token);
      }
    } catch {
      // Ignore in restricted environments
    }
  }
}

export function clearStoredAuthToken(): void {
  if (typeof window !== "undefined") {
    try {
      sessionStorage.removeItem("cyclonet_auth_token");
      localStorage.removeItem("cyclonet_auth_token");
    } catch {
      // Ignore
    }
  }
}

export function isTrustedOrigin(url: string): boolean {
  try {
    const parsed = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
    const currentOrigin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    if (parsed.origin === currentOrigin) return true;

    // Compare against configured first-party backend base URL
    const backendOrigin = new URL(API_BASE_URL).origin;
    if (parsed.origin === backendOrigin) return true;

    // Allow localhost / loopback for local development
    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Robust fetch wrapper with timeout, exponential backoff retries with jitter,
 * authentication header attachment, and Retry-After handling (UI-01, SEC-05, SEC-06, FIX-04).
 */
export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit & { token?: string; timeoutMs?: number; maxRetries?: number } = {}
): Promise<T> {
  const {
    token,
    timeoutMs = 12000,
    maxRetries = 2,
    ...fetchOptions
  } = options;

  const baseUrl = getApiBaseUrl();
  const url = endpoint.startsWith("http") ? endpoint : `${baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
  const method = (fetchOptions.method || "GET").toUpperCase();
  const isIdempotent = ["GET", "HEAD", "OPTIONS"].includes(method);

  const headers = new Headers(fetchOptions.headers || {});
  const authToken = token || getStoredAuthToken();

  // FIX 04: Centralized origin check on Authorization headers
  if (headers.has("Authorization")) {
    if (!isTrustedOrigin(url)) {
      console.warn(`[Security] Stripped explicitly supplied Authorization header destined for untrusted origin: ${url}`);
      headers.delete("Authorization");
    }
  } else if (authToken) {
    if (isTrustedOrigin(url)) {
      headers.set("Authorization", `Bearer ${authToken}`);
    } else {
      console.warn(`[Security] Withheld Bearer token from unverified origin: ${url}`);
    }
  }

  let attempt = 0;
  let lastError: unknown = null;

  while (attempt <= (isIdempotent ? maxRetries : 0)) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: fetchOptions.signal || controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.status === 429) {
        const retryHeader = response.headers.get("Retry-After");
        const retryAfter = retryHeader ? parseInt(retryHeader, 10) : 60;
        let detail = "Too Many Requests (Rate limit reached)";
        try {
          const body = await response.json();
          if (body?.detail) detail = body.detail;
        } catch {
          // ignore json parse error
        }
        throw new ApiClientError(detail, 429, retryAfter, detail);
      }

      if (!response.ok) {
        let detail = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const body = await response.json();
          if (body?.detail) detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
        } catch {
          // ignore
        }

        // Retry on server errors if idempotent
        if (isIdempotent && [502, 503, 504].includes(response.status) && attempt < maxRetries) {
          attempt++;
          const jitter = Math.random() * 300;
          await new Promise((r) => setTimeout(r, 800 * Math.pow(2, attempt) + jitter));
          continue;
        }

        throw new ApiClientError(detail, response.status, undefined, detail);
      }

      return (await response.json()) as T;
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err instanceof ApiClientError) {
        throw err;
      }
      lastError = err;
      if (isIdempotent && attempt < maxRetries) {
        attempt++;
        const jitter = Math.random() * 300;
        await new Promise((r) => setTimeout(r, 800 * Math.pow(2, attempt) + jitter));
      } else {
        break;
      }
    }
  }

  throw lastError || new ApiClientError(`Failed request to ${url}`, 0);
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 15000
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: options.signal || controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error: unknown) {
    clearTimeout(id);
    throw error;
  }
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 2,
  timeoutMs: number = 12000
): Promise<Response> {
  const method = (options.method || "GET").toUpperCase();
  const isIdempotent = ["GET", "HEAD"].includes(method);
  const actualRetries = isIdempotent ? maxRetries : 0;

  let lastError: unknown = null;
  for (let attempt = 0; attempt <= actualRetries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, options, timeoutMs);
      if (res.ok || (res.status < 500 && res.status !== 429)) {
        return res;
      }
      if (res.status === 429) {
        return res;
      }
    } catch (err) {
      lastError = err;
      if (attempt < actualRetries) {
        const jitter = Math.random() * 200;
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt) + jitter));
      }
    }
  }
  throw lastError || new Error(`Failed to fetch ${url} after ${actualRetries} retries`);
}
