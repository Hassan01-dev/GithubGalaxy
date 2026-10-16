import type { GalaxyData, GalaxyTheme, Repository } from "@/types";

/** FNV-1a: stable 32-bit hash of a string. */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

/** mulberry32: tiny deterministic PRNG. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const MIN_RADIUS = 0.4;
export const MAX_RADIUS = 2;
/** Log-scaled: 0 stars → 0.4, 1M+ stars → 2. A huge repo is ~5x a tiny one, never 1,000,000x. */
export function planetRadius(stars: number): number {
  const t = Math.log10(Math.max(0, stars) + 1) / 6;
  return MIN_RADIUS + Math.min(1, t) * (MAX_RADIUS - MIN_RADIUS);
}

export const GALAXY_RADIUS = 108;

/** Where each region lives in the disc (XZ plane, origin = galactic core). */
const BANDS: Record<string, { inner: number; outer: number; arms: boolean }> = {
  breakout: { inner: 10, outer: 42, arms: true },
  rising: { inner: 38, outer: 82, arms: true },
  frontier: { inner: 88, outer: 108, arms: false },
};
const DEFAULT_BAND = { inner: 20, outer: 90, arms: true };
export const ARMS = 2;
/** Radians of twist per unit of radius. Shared with the dust so planets sit on the visible arms. */
export const ARM_TWIST = 0.045;

export interface PlacedPlanet {
  repo: Repository;
  region: string;
  position: [number, number, number];
  radius: number;
  /** 0..1 stable per repo; drives surface style and texture variation. */
  seed: number;
  style: number;
}

/** Number of decorative surface styles; names and looks live in PLANET_STYLES (components/scene/planetShader.ts). */
export const STYLE_COUNT = 13;

/**
 * "spiral": regions are bands of a disc. "clusters": each region is its own star system on a ring.
 * "constellation": each region is an ordered route, its stops strung along the ring like a constellation.
 */
export type LayoutKind = "spiral" | "clusters" | "constellation";
export const layoutKind = (shape: GalaxyTheme["shape"]): LayoutKind => (shape === "spiral" ? "spiral" : shape === "constellation" ? "constellation" : "clusters");

const CLUSTER_RING = 64;
/** Centre of region `i` of `n` in a clustered galaxy. Alternates height so systems don't line up flat. */
function clusterCentre(i: number, n: number): [number, number, number] {
  const th = (i / n) * Math.PI * 2 + 0.35;
  return [Math.cos(th) * CLUSTER_RING, i % 2 ? 9 : -9, Math.sin(th) * CLUSTER_RING];
}
export const clusterRadius = (count: number) => 9 + Math.sqrt(count) * 2.4;

/** Distance between consecutive stops. Above 2·MAX_RADIUS + relax gap, so relaxing never reorders a route. */
const STOP_STEP = 7.5;
const routeHalf = (count: number) => (Math.max(1, count) - 1) * STOP_STEP / 2;

/**
 * Stop `k` of `n` on route `i` of `routes`: walks along the ring (so routes never cross) with a seeded
 * zig-zag sideways and up/down, small enough that distance from the first stop keeps growing.
 */
function routePoint(slug: string, i: number, routes: number, k: number, n: number): [number, number, number] {
  const c = clusterCentre(i, routes);
  const rand = rng(hash(slug));
  const phase = rand() * Math.PI * 2, amp = 1.2 + rand() * 1.2, lift = 1.5 + rand() * 2;
  const s = k * STOP_STEP - routeHalf(n); // arc length from the route's centre
  const th = (i / routes) * Math.PI * 2 + 0.35 + s / CLUSTER_RING;
  const r = CLUSTER_RING + (k % 2 ? amp : -amp);
  return [Math.cos(th) * r, c[1] + Math.sin(phase + k * 1.1) * lift, Math.sin(th) * r];
}

/** Where to float each region's label. */
export function regionAnchors(data: GalaxyData, kind: LayoutKind): Record<string, [number, number, number]> {
  return Object.fromEntries(
    data.regions.map((region, i) => {
      if (kind === "constellation") {
        const c = clusterCentre(i, data.regions.length);
        return [region.slug, [c[0], c[1] + 9, c[2]]];
      }
      if (kind === "clusters") {
        const c = clusterCentre(i, data.regions.length);
        return [region.slug, [c[0], c[1] + clusterRadius(region.repos.length) * 0.6 + 4, c[2]]];
      }
      const b = BANDS[region.slug] ?? DEFAULT_BAND;
      const r = (b.inner + b.outer) / 2;
      const th = b.arms ? ((i % 2) / ARMS) * Math.PI * 2 + r * ARM_TWIST : Math.PI * 0.75;
      return [region.slug, [Math.cos(th) * r, 9, Math.sin(th) * r]];
    }),
  );
}

/** Cluster centres, so the dust can gather around them. A route's "radius" covers its whole length. */
export const clusterCentres = (data: GalaxyData, kind: LayoutKind = "clusters") =>
  data.regions.map((r, i) => ({ centre: clusterCentre(i, data.regions.length), radius: kind === "constellation" ? routeHalf(r.repos.length) + 4 : clusterRadius(r.repos.length) }));

/**
 * Deterministic: a repo's position depends on its name and region only (plus its stop index in a
 * constellation, where order is the point), and a small, order-independent relaxation so planets don't overlap.
 */
export function layoutGalaxy(data: GalaxyData, kind: LayoutKind = "spiral"): PlacedPlanet[] {
  const planets: PlacedPlanet[] = [];
  data.regions.forEach((region, ri) => {
    const band = BANDS[region.slug] ?? DEFAULT_BAND;
    const centre = clusterCentre(ri, data.regions.length);
    const cr = clusterRadius(region.repos.length);
    region.repos.forEach((repo, k) => {
      const rand = rng(hash(repo.fullName));
      let position: [number, number, number];
      if (kind === "constellation") {
        position = routePoint(region.slug, ri, data.regions.length, k, region.repos.length);
      } else if (kind === "clusters") {
        // Uniform direction, radius biased inward: a bright, dense system core.
        const u = rand() * 2 - 1, th = rand() * Math.PI * 2, s = Math.sqrt(1 - u * u);
        const d = cr * Math.pow(rand(), 0.8);
        position = [centre[0] + Math.cos(th) * s * d, centre[1] + u * d * 0.55, centre[2] + Math.sin(th) * s * d];
      } else {
        // sqrt spreads planets evenly over the band's area instead of bunching inward.
        const r = band.inner + Math.sqrt(rand()) * (band.outer - band.inner);
        const arm = Math.floor(rand() * ARMS);
        const theta = band.arms ? (arm / ARMS) * Math.PI * 2 + r * ARM_TWIST + (rand() - 0.5) * 0.55 : rand() * Math.PI * 2;
        // Thicker near the core, thin at the edge, like a real disc.
        const y = (rand() - 0.5) * 2 * (1 - r / (GALAXY_RADIUS * 1.15)) * 7;
        position = [Math.cos(theta) * r, y, Math.sin(theta) * r];
      }
      planets.push({ repo, region: region.slug, position, radius: planetRadius(repo.stars), seed: rand(), style: Math.floor(rand() * STYLE_COUNT) });
    });
  });
  relax(planets);
  return planets;
}

/** Push overlapping planets apart. Sorted by name so the result doesn't depend on input order. */
function relax(planets: PlacedPlanet[], gap = 2.6, iterations = 8) {
  const sorted = [...planets].sort((a, b) => (a.repo.fullName < b.repo.fullName ? -1 : 1));
  for (let it = 0; it < iterations; it++) {
    let moved = false;
    // ponytail: O(n²) per pass, fine for a few hundred planets; spatial grid if a galaxy grows past ~1,500.
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const a = sorted[i].position, b = sorted[j].position;
        const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
        const d = Math.hypot(dx, dy, dz) || 0.001;
        const min = sorted[i].radius + sorted[j].radius + gap;
        if (d >= min) continue;
        const push = (min - d) / 2 / d;
        a[0] -= dx * push; a[1] -= dy * push; a[2] -= dz * push;
        b[0] += dx * push; b[1] += dy * push; b[2] += dz * push;
        moved = true;
      }
    }
    if (!moved) break;
  }
}

/** Official GitHub linguist colours for common languages; others get a stable hashed hue. */
const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6", JavaScript: "#f1e05a", Python: "#3572A5", Rust: "#dea584", Go: "#00ADD8",
  Java: "#b07219", Kotlin: "#A97BFF", Swift: "#F05138", "C++": "#f34b7d", C: "#555555", "C#": "#178600",
  Ruby: "#701516", PHP: "#4F5D95", Shell: "#89e051", Dart: "#00B4AB", Zig: "#ec915c", Lua: "#000080",
  HTML: "#e34c26", CSS: "#663399", Vue: "#41b883", Svelte: "#ff3e00", "Jupyter Notebook": "#DA5B0B",
  Elixir: "#6e4a7e", Haskell: "#5e5086", Scala: "#c22d40", Nix: "#7e7eff", MDX: "#fcb32c", Astro: "#ff5a03",
};
export function languageColor(language: string | null): string {
  if (!language) return "#8b93a7";
  return LANGUAGE_COLORS[language] ?? `hsl(${hash(language) % 360} 55% 60%)`;
}
