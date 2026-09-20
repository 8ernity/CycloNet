const rawUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
// Clean trailing slash or duplicate /api
let cleaned = rawUrl.replace(/\/+$/, "").replace(/\/api$/, "");
if (cleaned && !cleaned.startsWith("http://") && !cleaned.startsWith("https://")) {
  cleaned = `https://${cleaned}`;
}
export const API_BASE_URL = cleaned;
