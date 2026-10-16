/** A public GitHub repository, mapped and validated. Never a raw API payload. */
export interface Repository {
  id: number;
  fullName: string;
  owner: string;
  name: string;
  description: string | null;
  htmlUrl: string;
  homepage: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  language: string | null;
  topics: string[];
  license: string | null;
  archived: boolean;
  defaultBranch: string | null;
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  latestRelease: { tag: string; publishedAt: string } | null;
  fetchedAt: string;
  /** Stars gained between two of our own snapshots, when we have them. */
  starGrowth: { gained: number; since: string } | null;
}

export type DataSource = "live" | "cache" | "seed";

export interface RegionDef {
  slug: string;
  title: string;
  /** Plain-language definition shown to users, including the date range. */
  definition: (now: Date) => string;
  /** GitHub search query for this region. */
  query: (now: Date) => string;
  sort: "stars" | "updated";
  limit: number;
  /** Fixed display order (fullNames, case-insensitive), e.g. a journey's stops. Search order otherwise. */
  order?: string[];
}

export interface GalaxyRegion {
  slug: string;
  title: string;
  definition: string;
  repos: Repository[];
}

export interface GalaxyData {
  slug: string;
  regions: GalaxyRegion[];
  source: DataSource;
  fetchedAt: string;
}

export interface GalaxyTheme {
  /** Accent color for UI and dust. */
  accent: string;
  core: string;
  edge: string;
  shape: "spiral" | "barred" | "elliptical" | "ring" | "irregular" | "constellation";
}

export interface Galaxy {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  theme: GalaxyTheme;
  available: boolean;
  /** What the filter calls a region: "Region", "Category", … */
  regionNoun: string;
  /** How this galaxy's regions were chosen, shown in the legend. */
  note: string;
  regions: RegionDef[];
}

/** A contributor shown as one of a planet's "inhabitants". */
export interface Contributor {
  login: string;
  avatarUrl: string;
  htmlUrl: string;
  contributions: number;
}

/** A published release, drawn as a satellite. */
export interface Release {
  tag: string;
  name: string | null;
  publishedAt: string;
  htmlUrl: string;
}

/**
 * Deeper, per-repo data fetched only when a planet is inspected ("scanned").
 * Every part is nullable: GitHub may be rate-limited or still computing stats.
 */
export interface PlanetScan {
  fullName: string;
  /** Total contributors (from pagination), null if unknown. GitHub caps very large repos. */
  contributorsCount: number | null;
  topContributors: Contributor[];
  /** 52 weekly commit counts, oldest first. Null while GitHub computes them or when unavailable. */
  weeklyCommits: number[] | null;
  /** Bytes per language, largest first. */
  languages: { name: string; bytes: number }[];
  /** Newest first, up to 10. */
  releases: Release[];
  scannedAt: string;
  /** True when some parts could not be fetched; the UI says which are missing. */
  partial: boolean;
}

export type ScanResult =
  | { status: "ok"; scan: PlanetScan; source: DataSource }
  | { status: "not_found" }
  | { status: "unavailable"; reason: "rate_limited" | "offline"; resetAt: string | null };
