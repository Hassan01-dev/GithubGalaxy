import type { Repository } from "@/types";

export interface Filters {
  language: string | null;
  topic: string | null;
  license: string | null;
  minStars: number;
  /** Pushed within this many days. */
  updatedWithin: number | null;
  region: string | null;
}

export const EMPTY_FILTERS: Filters = { language: null, topic: null, license: null, minStars: 0, updatedWithin: null, region: null };

const DAY = 86_400_000;

export function matches(repo: Repository, region: string, f: Filters, now = Date.now()): boolean {
  if (f.language && repo.language !== f.language) return false;
  if (f.topic && !repo.topics.includes(f.topic)) return false;
  if (f.license && repo.license !== f.license) return false;
  if (repo.stars < f.minStars) return false;
  if (f.updatedWithin && now - Date.parse(repo.pushedAt) > f.updatedWithin * DAY) return false;
  if (f.region && region !== f.region) return false;
  return true;
}

const int = (v: string | null) => {
  const n = Number(v);
  return v && Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
};

/** URL ⇄ filters. Unknown or malformed params are ignored, never trusted. */
export function filtersFromParams(p: URLSearchParams): Filters {
  const s = (k: string) => p.get(k)?.slice(0, 80) || null;
  return { language: s("lang"), topic: s("topic"), license: s("license"), minStars: int(p.get("minStars")) ?? 0, updatedWithin: int(p.get("updated")), region: s("region") };
}

export function filtersToParams(f: Filters, p: URLSearchParams) {
  const set = (k: string, v: string | number | null) => (v ? p.set(k, String(v)) : p.delete(k));
  set("lang", f.language);
  set("topic", f.topic);
  set("license", f.license);
  set("minStars", f.minStars || null);
  set("updated", f.updatedWithin);
  set("region", f.region);
  return p;
}

/** Most common values first, so the filter menus show what this galaxy actually contains. */
export function facet(repos: Repository[], pick: (r: Repository) => string | string[] | null, limit = 40): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of repos) for (const v of [pick(r)].flat()) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)).slice(0, limit);
}
