/** Validate a browser-selected backend address before saving or contacting it. */
export function normalizeBackendUrl(value: string): string {
  let url: URL;
  try {url = new URL(value.trim());} catch {throw new Error('Enter a complete HTTP or HTTPS backend URL.');}
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Use an HTTP or HTTPS backend URL.');
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('Use a backend URL without credentials, query parameters, or fragments.');
  }
  const path = url.pathname.replace(/\/+$/, '').replace(/\/api$/, '');
  return url.origin + path;
}
