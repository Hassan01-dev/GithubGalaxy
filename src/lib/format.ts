export const compact = (n: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);
export const full = (n: number) => n.toLocaleString("en");
export const date = (iso: string) => new Date(iso).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
export function relative(iso: string, now = Date.now()) {
  const m = Math.round((now - Date.parse(iso)) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}
