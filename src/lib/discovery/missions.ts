import { hash, rng } from "@/lib/galaxy/layout";
import { isPermissive, type VisitFacts } from "@/lib/discovery/achievements";
import type { GalaxyRegion, Repository } from "@/types";

const DAY = 86_400_000;

export type MissionKind = "language-license" | "gem" | "region" | "new" | "topic";

export interface Mission {
  id: string;
  dateKey: string;
  galaxy: string;
  title: string;
  /** The exact criteria, in plain words. */
  rule: string;
  target: number;
  kind: MissionKind;
  params: Record<string, string>;
}

/** Local calendar day, YYYY-MM-DD. */
export function dateKey(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Visit-time rules shared by "can this be done?" (judged at the end of the mission day) and "was it done?". */
const isGem = (r: { stars: number; pushedAt: string }, at: number) => r.stars < 300 && at - Date.parse(r.pushedAt) <= 7 * DAY;
const isNew = (r: { createdAt: string }, at: number) => at - Date.parse(r.createdAt) <= 30 * DAY;

type Candidate = Omit<Mission, "id" | "dateKey" | "galaxy">;
type RegionLike = Pick<GalaxyRegion, "slug" | "title" | "repos">;

/**
 * Today's mission for a galaxy. Deterministic per (date, galaxy) for the same data, and only ever
 * offers a mission some planet in `repos` can actually satisfy. Null when no template can be satisfied.
 */
export function missionFor(day: string, galaxy: string, repos: Repository[], regions: RegionLike[]): Mission | null {
  if (!repos.length) return null;
  const end = new Date(`${day}T23:59:59`).getTime();
  const sorted = <T>(xs: Iterable<T>) => [...new Set(xs)].sort();
  const byKind: Candidate[][] = [];

  const langs = sorted(repos.filter((r) => r.language && isPermissive(r.license)).map((r) => r.language!));
  byKind.push(langs.map((language) => ({
    kind: "language-license", target: 1, params: { language },
    title: `Visit a ${language} planet with a permissive license`,
    rule: `Open a planet whose primary language is ${language} and whose license is permissive (MIT, Apache-2.0, BSD, ISC, …). Planets with no license detected don't count.`,
  })));

  if (repos.some((r) => isGem(r, end)))
    byKind.push([{
      kind: "gem", target: 1, params: {},
      title: "Find a small planet with fresh activity",
      rule: "Open a planet with fewer than 300 stars that was pushed to in the 7 days before your visit.",
    }]);

  byKind.push(regions.filter((r) => r.repos.length >= 3).map((r) => ({
    kind: "region", target: 3, params: { region: r.slug, regionTitle: r.title },
    title: `Visit 3 planets in ${r.title}`,
    rule: `Open 3 different planets in “${r.title}” today.`,
  })));

  if (repos.some((r) => isNew(r, end)))
    byKind.push([{
      kind: "new", target: 1, params: {},
      title: "Visit a newborn planet",
      rule: "Open a planet created in the 30 days before your visit.",
    }]);

  // Visits keep a repo's first 10 topics, so only those can be asked for.
  const topics = sorted(repos.flatMap((r) => r.topics.slice(0, 10)));
  byKind.push(topics.map((topic) => ({
    kind: "topic", target: 1, params: { topic },
    title: `Discover a planet tagged “${topic}”`,
    rule: `Open a planet that declares the GitHub topic “${topic}”.`,
  })));

  const kinds = byKind.filter((k) => k.length);
  if (!kinds.length) return null;
  const rand = rng(hash(`${day}:${galaxy}`));
  const options = kinds[Math.floor(rand() * kinds.length)];
  const pick = options[Math.floor(rand() * options.length)];
  return { ...pick, id: `${day}:${galaxy}:${pick.kind}:${Object.values(pick.params)[0] ?? ""}`, dateKey: day, galaxy };
}

function matches(m: Mission, v: VisitFacts): boolean {
  const at = Date.parse(v.at);
  switch (m.kind) {
    case "language-license": return v.language === m.params.language && isPermissive(v.license);
    case "gem": return isGem(v, at);
    case "region": return v.region === m.params.region;
    case "new": return isNew(v, at);
    case "topic": return v.topics.includes(m.params.topic);
  }
}

/** Counts visits made on the mission's day, in its galaxy. Pass all visits; the filter is here so callers can't get it wrong. */
export function evaluateMission(m: Mission, visits: VisitFacts[]): { done: boolean; progress: number; target: number } {
  const hits = new Set(visits.filter((v) => v.galaxy === m.galaxy && dateKey(new Date(v.at)) === m.dateKey && matches(m, v)).map((v) => v.fullName)).size;
  return { done: hits >= m.target, progress: Math.min(hits, m.target), target: m.target };
}
