import { cacheLife } from "next/cache";
import { db } from "@/lib/db";
import { getGalaxy } from "@/lib/galaxy/galaxies";
import { fetchGalaxyFromGitHub } from "./github-galaxy";
import { persistRepos, rowToRepo, withGrowth } from "./store";
import { SEEDS } from "./seeds";
import type { GalaxyData } from "@/types";

/** GitHub is asked again at most this often, no matter how many visitors arrive. */
const REFRESH_MS = 3 * 3_600_000;

async function readFromDb(slug: string): Promise<GalaxyData | null> {
  const fetches = await db.regionFetch.findMany({ where: { galaxy: slug } });
  if (!fetches.length) return null;
  const galaxy = getGalaxy(slug)!;
  const ids = fetches.flatMap((f) => f.repoIds);
  const rows = await withGrowth(ids);
  const byId = new Map(rows.map((r) => [r.id, rowToRepo(r)]));
  const fetchedAt = new Date(Math.min(...fetches.map((f) => f.fetchedAt.getTime())));
  const regions = galaxy.regions.flatMap((def) => {
    const f = fetches.find((x) => x.region === def.slug);
    if (!f) return [];
    // Definitions use the dates the query actually ran with, not today's.
    return [{ slug: def.slug, title: def.title, definition: def.definition(f.fetchedAt), repos: f.repoIds.flatMap((id) => byId.get(id) ?? []) }];
  });
  return { slug, regions, source: "cache", fetchedAt: fetchedAt.toISOString() };
}

async function persist(data: GalaxyData) {
  await persistRepos(data.regions.flatMap((r) => r.repos));
  const galaxy = getGalaxy(data.slug)!;
  const at = new Date(data.fetchedAt);
  await db.$transaction(
    data.regions.map((r) => {
      const row = { query: galaxy.regions.find((d) => d.slug === r.slug)!.query(at), repoIds: r.repos.map((x) => x.id), fetchedAt: at };
      return db.regionFetch.upsert({ where: { galaxy_region: { galaxy: data.slug, region: r.slug } }, create: { galaxy: data.slug, region: r.slug, ...row }, update: row });
    }),
  );
}

/**
 * Database (fresh) → GitHub → database (stale) → committed seed.
 * Never throws; `source` tells the UI how fresh the data is.
 */
export async function loadGalaxy(slug: string): Promise<GalaxyData | null> {
  "use cache";
  const galaxy = getGalaxy(slug);
  if (!galaxy?.available) return null;

  let cached: GalaxyData | null = null;
  let dbUp = true;
  try {
    cached = await readFromDb(slug);
  } catch (e) {
    dbUp = false;
    console.error("[galaxy] database unavailable:", (e as Error).message);
  }
  const now = new Date();
  if (cached && now.getTime() - Date.parse(cached.fetchedAt) < REFRESH_MS) {
    cacheLife("minutes");
    return cached;
  }

  try {
    const live = await fetchGalaxyFromGitHub(galaxy, now);
    if (dbUp) {
      try {
        await persist(live);
        // Re-read so measured star growth from earlier snapshots is attached.
        const fresh = await readFromDb(slug);
        if (fresh) {
          cacheLife("minutes");
          return { ...fresh, source: "live" };
        }
      } catch (e) {
        console.error("[galaxy] persist failed:", (e as Error).message);
      }
    }
    cacheLife("minutes");
    return live;
  } catch (e) {
    console.error("[galaxy] GitHub fetch failed:", (e as Error).message);
    // Degraded: retry soon rather than pinning stale data for hours.
    cacheLife("seconds");
    return cached ?? SEEDS[slug] ?? null;
  }
}
