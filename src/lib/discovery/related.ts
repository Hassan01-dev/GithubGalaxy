import type { Repository } from "@/types";

export interface Related {
  repo: Repository;
  /** Topics both repos declare. This is the whole relationship: similarity, not dependency. */
  shared: string[];
}

export function related(target: Repository, pool: Repository[], limit = 5): Related[] {
  const t = new Set(target.topics);
  return pool
    .filter((r) => r.id !== target.id)
    .map((repo) => ({ repo, shared: repo.topics.filter((x) => t.has(x)) }))
    .filter((x) => x.shared.length > 0)
    .sort((a, b) => b.shared.length - a.shared.length || b.repo.stars - a.repo.stars)
    .slice(0, limit);
}

/** The few strongest topic links in a set, for the overview. Sparse on purpose: clutter kills legibility. */
export function strongestLinks(pool: Repository[], minShared = 2, limit = 40): [number, number, number][] {
  const links: [number, number, number][] = [];
  // ponytail: O(n²) over a few hundred repos; index by topic if galaxies grow into the thousands.
  for (let i = 0; i < pool.length; i++) {
    const t = new Set(pool[i].topics);
    for (let j = i + 1; j < pool.length; j++) {
      const n = pool[j].topics.reduce((c, x) => c + (t.has(x) ? 1 : 0), 0);
      if (n >= minShared) links.push([pool[i].id, pool[j].id, n]);
    }
  }
  return links.sort((a, b) => b[2] - a[2]).slice(0, limit);
}
