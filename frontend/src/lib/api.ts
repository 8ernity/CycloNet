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

const isProd = process.env.NODE_ENV === "production";
const defaultUrl = isProd ? "https://cyclonet-backend.onrender.com" : "http://localhost:8000";
const rawUrl = process.env.NEXT_PUBLIC_API_URL || defaultUrl;
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
      // When browsing locally on localhost or 127.0.0.1, always prioritize the local backend
      // so local development never fails against sleeping or unconfigured cloud services.
      if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
        if (process.env.NEXT_PUBLIC_API_URL && (process.env.NEXT_PUBLIC_API_URL.includes("localhost") || process.env.NEXT_PUBLIC_API_URL.includes("127.0.0.1"))) {
          return process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, "").replace(/\/api$/, "");
        }
        return "http://localhost:8000";
      }
    } catch {
      // Fallback on restricted browser environments or SSR
    }
  }
  return API_BASE_URL;
}

let memoryToken: string | null = null;
let tokenProvider: (() => Promise<string | null>) | null = null;
export function setAuthTokenProvider(provider: (() => Promise<string | null>) | null) { tokenProvider = provider; }
export function getStoredAuthToken(): string | null { return memoryToken; }
export function setStoredAuthToken(token: string): void {
  memoryToken = token;
  if (typeof window !== "undefined") {
    localStorage.removeItem("cyclonet_auth_token");
    sessionStorage.removeItem("cyclonet_auth_token");
  }
}
export function clearStoredAuthToken(): void {
  memoryToken = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem("cyclonet_auth_token");
    sessionStorage.removeItem("cyclonet_auth_token");
  }
}

export function isTrustedOrigin(url: string): boolean {
  try {
    const parsed = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
    const currentOrigin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    if (isProd && parsed.protocol !== "https:") return false;
    if (parsed.origin === currentOrigin) return true;

    // Compare against configured first-party backend base URL
    const backendOrigin = new URL(API_BASE_URL).origin;
    if (parsed.origin === backendOrigin) return true;

    // Allow localhost / loopback for local development
    if (!isProd && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function retryDelay(milliseconds: number, signal?: AbortSignal | null): Promise<void> {
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, milliseconds);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

async function resolveAuthToken(timeoutMs: number, callerSignal?: AbortSignal | null): Promise<string | null> {
  if (!tokenProvider) return getStoredAuthToken();
  callerSignal?.throwIfAborted();
  const controller = new AbortController();
  const signal = callerSignal ? AbortSignal.any([callerSignal, controller.signal]) : controller.signal;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let onAbort: () => void = () => {};
  try {
    // The identity SDK has no cancellation API. Stop waiting and ignore its late
    // result while keeping a rejection handler attached to its pending promise.
    return await new Promise<string | null>((resolve, reject) => {
      onAbort = () => reject(signal.reason);
      signal.addEventListener("abort", onAbort, { once: true });
      Promise.resolve().then(() => tokenProvider?.()).then(
        value => resolve(value || getStoredAuthToken()), reject
      );
    });
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
}

/**
 * Robust fetch wrapper with timeout, exponential backoff retries with jitter,
 * authentication header attachment, and Retry-After handling (UI-01, SEC-05, SEC-06, FIX-04).
 */
export async function apiFetch<T = unknown>(
  endpoint: string,
  options: RequestInit & { token?: string; timeoutMs?: number; maxRetries?: number } = {}
): Promise<T> {
  const {
    token,
    timeoutMs = 12000,
    maxRetries = 2,
    ...fetchOptions
  } = options;

  fetchOptions.signal?.throwIfAborted();

  const baseUrl = getApiBaseUrl();
  const url = endpoint.startsWith("http") ? endpoint : `${baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
  const method = (fetchOptions.method || "GET").toUpperCase();
  const isIdempotent = ["GET", "HEAD", "OPTIONS"].includes(method);

  const headers = new Headers(fetchOptions.headers || {});
  const authToken = isTrustedOrigin(url) ? (token || await resolveAuthToken(timeoutMs, fetchOptions.signal)) : null;
  fetchOptions.signal?.throwIfAborted();

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

  if (!isTrustedOrigin(url)) {
    headers.delete("X-Admin-Key");
    fetchOptions.credentials = "omit";
  }
  let attempt = 0;
  let lastError: unknown = null;

  while (attempt <= (isIdempotent ? maxRetries : 0)) {
    fetchOptions.signal?.throwIfAborted();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal: fetchOptions.signal ? AbortSignal.any([fetchOptions.signal, controller.signal]) : controller.signal,
        redirect: "error",
      });

      if (response.status === 429) {
        const retryHeader = response.headers.get("Retry-After");
        const retryAfter = retryHeader ? parseInt(retryHeader, 10) : 60;
        let detail = "Too Many Requests (Rate limit reached)";
        try {
          const body = await response.json();
          if (typeof body?.detail === "string") detail = body.detail;
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
          lastError = new ApiClientError(detail, response.status);
        } else {
          throw new ApiClientError(detail, response.status, undefined, detail);
        }
      } else {
        return (await response.json()) as T;
      }
    } catch (err: unknown) {
      fetchOptions.signal?.throwIfAborted();
      if (err instanceof ApiClientError) {
        throw err;
      }
      lastError = err;
    } finally {
      clearTimeout(timeoutId);
    }
    if (isIdempotent && attempt < maxRetries) {
      attempt++;
      await retryDelay(800 * Math.pow(2, attempt) + Math.random() * 300, fetchOptions.signal);
    } else {
      break;
    }
  }

  throw lastError || new ApiClientError(`Failed request to ${url}`, 0);
}

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 15000
): Promise<Response> {
  options.signal?.throwIfAborted();
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal,
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
    options.signal?.throwIfAborted();
    try {
      const res = await fetchWithTimeout(url, options, timeoutMs);
      if (res.ok || (res.status < 500 && res.status !== 429)) {
        return res;
      }
      if (res.status === 429) {
        return res;
      }
    } catch (err) {
      options.signal?.throwIfAborted();
      lastError = err;
      if (attempt < actualRetries) {
        const jitter = Math.random() * 200;
        await retryDelay(1000 * Math.pow(2, attempt) + jitter, options.signal);
      }
    }
  }
  throw lastError || new Error(`Failed to fetch ${url} after ${actualRetries} retries`);
}
