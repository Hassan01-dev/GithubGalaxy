import { searchRepos } from "@/lib/github/client";
import type { Galaxy, GalaxyData } from "@/types";

/** Runs each region's search. A repo appears only in the first region that claims it. */
export async function fetchGalaxyFromGitHub(galaxy: Galaxy, now: Date): Promise<GalaxyData> {
  const seen = new Set<number>();
  const regions = [];
  // Sequential on purpose: GitHub's secondary limits dislike bursts of search calls.
  for (const r of galaxy.regions) {
    let repos = (await searchRepos(r.query(now), r.sort, r.limit)).filter((repo) => !seen.has(repo.id) && seen.add(repo.id));
    // Search ranks by stars; a fixed order (a journey's route) wins. Repos search didn't return stay out.
    if (r.order) {
      const rank = new Map(r.order.map((n, i) => [n.toLowerCase(), i]));
      repos = repos.filter((x) => rank.has(x.fullName.toLowerCase())).sort((a, b) => rank.get(a.fullName.toLowerCase())! - rank.get(b.fullName.toLowerCase())!);
    }
    regions.push({ slug: r.slug, title: r.title, definition: r.definition(now), repos });
  }
  return { slug: galaxy.slug, regions, source: "live", fetchedAt: now.toISOString() };
}
