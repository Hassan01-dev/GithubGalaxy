import { GALAXIES } from "@/lib/galaxy/galaxies";

const DAY = 86_400_000;
// ponytail: mirrors the private set in signals.ts; export it from there and import here once that file is free to edit.
export const PERMISSIVE = new Set(["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "0BSD", "Unlicense", "Zlib", "MPL-2.0"]);
/** Unknown license is never treated as permissive. */
export const isPermissive = (license: string | null) => !!license && PERMISSIVE.has(license);

/** The subset of a visit the rules read. Snapshotted at visit time, so rules judge what the user actually saw. */
export interface VisitFacts {
  fullName: string;
  galaxy: string;
  region: string;
  language: string | null;
  license: string | null;
  stars: number;
  pushedAt: string;
  createdAt: string;
  topics: string[];
  at: string;
}

export interface LogFacts {
  visits: VisitFacts[];
  distanceFlown: number;
  journeysCompleted: string[];
  achievements: { id: string; at: string }[];
}

export interface AchievementContext {
  /** Saved favorites right now. */
  favorites?: number;
  /** Region slugs per galaxy, for "Systems tour". Defaults to the registry. */
  regionsByGalaxy?: Record<string, string[]>;
}

export interface Achievement {
  id: string;
  title: string;
  /** States the exact rule, so locked ones can be read as goals. */
  description: string;
  icon: string;
  test: (log: LogFacts, ctx: Required<AchievementContext>) => boolean;
}

const distinct = <T>(xs: T[]) => new Set(xs).size;
const gem = (v: VisitFacts) => v.stars < 300 && Date.parse(v.at) - Date.parse(v.pushedAt) <= 7 * DAY;

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-contact", title: "First contact", icon: "🛰️", description: "Open your first planet.", test: (l) => l.visits.length >= 1 },
  { id: "cartographer", title: "Cartographer", icon: "🗺️", description: "Visit 25 different planets.", test: (l) => l.visits.length >= 25 },
  { id: "polyglot", title: "Polyglot", icon: "🔤", description: "Visit planets in 5 different primary languages.", test: (l) => distinct(l.visits.flatMap((v) => v.language ?? [])) >= 5 },
  { id: "two-galaxies", title: "Two galaxies", icon: "🌌", description: "Visit planets in 2 different galaxies.", test: (l) => distinct(l.visits.map((v) => v.galaxy)) >= 2 },
  { id: "frontier-scout", title: "Frontier scout", icon: "🔭", description: "Visit a planet in the Trending galaxy's “Newly discovered” region.", test: (l) => l.visits.some((v) => v.galaxy === "trending" && v.region === "frontier") },
  { id: "gem-hunter", title: "Gem hunter", icon: "💎", description: "Visit a planet with fewer than 300 stars that was pushed to within 7 days of your visit.", test: (l) => l.visits.some(gem) },
  { id: "licensed", title: "Licensed to reuse", icon: "📜", description: "Visit 5 planets with a permissive license (MIT, Apache-2.0, BSD, ISC, …). No license detected doesn't count.", test: (l) => l.visits.filter((v) => isPermissive(v.license)).length >= 5 },
  {
    id: "systems-tour", title: "Systems tour", icon: "🪐", description: "Visit at least one planet in every region of a galaxy.",
    test: (l, c) => Object.entries(c.regionsByGalaxy).some(([g, regions]) => regions.length > 1 && regions.every((r) => l.visits.some((v) => v.galaxy === g && v.region === r))),
  },
  { id: "pilot", title: "Pilot", icon: "🚀", description: "Fly 1,000 units in flight mode.", test: (l) => l.distanceFlown >= 1000 },
  { id: "long-haul", title: "Long haul", icon: "☄️", description: "Fly 10,000 units in flight mode.", test: (l) => l.distanceFlown >= 10_000 },
  { id: "navigator", title: "Navigator", icon: "🧭", description: "Finish a guided journey.", test: (l) => l.journeysCompleted.length >= 1 },
  { id: "curator", title: "Curator", icon: "⭐", description: "Save 5 planets to My Universe.", test: (_, c) => c.favorites >= 5 },
];

const DEFAULT_REGIONS = Object.fromEntries(GALAXIES.filter((g) => g.available).map((g) => [g.slug, g.regions.map((r) => r.slug)]));

/** Ids whose rule now holds but aren't unlocked yet. Pure. */
export function evaluateAchievements(log: LogFacts, ctx: AchievementContext = {}): string[] {
  const have = new Set(log.achievements.map((a) => a.id));
  const full = { favorites: ctx.favorites ?? 0, regionsByGalaxy: ctx.regionsByGalaxy ?? DEFAULT_REGIONS };
  return ACHIEVEMENTS.filter((a) => !have.has(a.id) && a.test(log, full)).map((a) => a.id);
}
