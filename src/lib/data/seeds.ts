import ai from "@/data/seed/ai.json";
import constellations from "@/data/seed/constellations.json";
import trending from "@/data/seed/trending.json";
import type { GalaxyData, Repository } from "@/types";

/** Real GitHub snapshots committed to the repo: the last-resort fallback. Refresh with `npm run seed:snapshot`. */
export const SEEDS: Record<string, GalaxyData> = { trending: trending as GalaxyData, ai: ai as GalaxyData, constellations: constellations as GalaxyData };

export function seedRepo(fullName: string): Repository | null {
  const key = fullName.toLowerCase();
  for (const g of Object.values(SEEDS)) for (const r of g.regions) for (const repo of r.repos) if (repo.fullName.toLowerCase() === key) return repo;
  return null;
}
