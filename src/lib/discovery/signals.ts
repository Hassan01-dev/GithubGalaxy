import type { Repository } from "@/types";

export interface Signal {
  tone: "positive" | "neutral" | "caution";
  text: string;
}

const DAY = 86_400_000;
const PERMISSIVE = new Set(["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "0BSD", "Unlicense", "Zlib", "MPL-2.0"]);

export const daysSince = (iso: string, now: number) => Math.max(0, Math.floor((now - Date.parse(iso)) / DAY));
const ago = (d: number) => (d === 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`);

/**
 * "Why this is interesting", built only from fields we actually have.
 * Each line states the fact it rests on; none of them claim quality or safety.
 */
export function signals(repo: Repository, now = Date.now()): Signal[] {
  const out: Signal[] = [];
  const age = daysSince(repo.createdAt, now);
  const pushed = daysSince(repo.pushedAt, now);

  if (repo.starGrowth && repo.starGrowth.gained > 0)
    out.push({ tone: "positive", text: `+${repo.starGrowth.gained.toLocaleString("en")} stars since ${repo.starGrowth.since} (measured by our daily snapshots)` });
  if (age <= 60) out.push({ tone: "positive", text: `Created ${ago(age)} and already has ${repo.stars.toLocaleString("en")} stars` });
  if (pushed <= 7) out.push({ tone: "positive", text: `Code pushed ${ago(pushed)}` });
  else if (pushed > 365) out.push({ tone: "caution", text: `No pushes for over a year (last ${repo.pushedAt.slice(0, 10)})` });
  if (repo.latestRelease) out.push({ tone: "positive", text: `Has a published release: ${repo.latestRelease.tag} (${repo.latestRelease.publishedAt.slice(0, 10)})` });
  if (repo.license && PERMISSIVE.has(repo.license)) out.push({ tone: "positive", text: `Permissive license (${repo.license})` });
  else if (repo.license) out.push({ tone: "neutral", text: `Licensed under ${repo.license}; check its terms before reuse` });
  else out.push({ tone: "caution", text: "No license detected; reuse may not be permitted" });
  if (repo.homepage) out.push({ tone: "neutral", text: "Has its own website" });
  if (repo.archived) out.push({ tone: "caution", text: "Archived by its owner (read-only)" });
  return out;
}
