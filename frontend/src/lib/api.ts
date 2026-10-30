const rawUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
// Clean trailing slash or duplicate /api
let cleaned = rawUrl.replace(/\/+$/, "").replace(/\/api$/, "");
if (cleaned && !cleaned.startsWith("http://") && !cleaned.startsWith("https://")) {
  cleaned = `https://${cleaned}`;
}
export const API_BASE_URL = cleaned;

/**
 * Dynamic API Base URL resolver that respects user-configured CUSTOM data source in Settings (Fix #37).
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

/**
 * Robust fetch wrapper with timeout, exponential backoff retries,
 * and graceful error handling designed for serverless / cold-starting backends (e.g. Render).
 */
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
      signal: controller.signal,
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
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetchWithTimeout(url, options, timeoutMs);
      if (res.ok || res.status < 500) {
        return res;
      }
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        // Exponential backoff
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError || new Error(`Failed to fetch ${url} after ${maxRetries} retries`);
}
