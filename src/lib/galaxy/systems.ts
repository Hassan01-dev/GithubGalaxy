import type { Release } from "@/types";
import { hash, rng } from "./layout";

const DAY = 86_400_000;

export interface SatelliteOrbit {
  tag: string;
  /** Orbit radius as a multiple of the planet radius. */
  radius: number;
  /** Radians per second. */
  speed: number;
  phase: number;
  /** Orbit-plane tilt (Euler x, z). */
  tiltX: number;
  tiltZ: number;
  newest: boolean;
}

/** Releases from the last 365 days (newest first, max 8) → seeded orbits. Same tag, same orbit. */
export function satelliteOrbits(releases: Release[], now = Date.now()): SatelliteOrbit[] {
  return releases
    .filter((r) => now - Date.parse(r.publishedAt) <= 365 * DAY)
    .slice(0, 8)
    .map((r, i) => {
      const rand = rng(hash(r.tag));
      const radius = 1.9 + i * 0.32 + rand() * 0.25;
      return {
        tag: r.tag,
        radius,
        // Kepler-ish: outer satellites move slower.
        speed: (0.5 + rand() * 0.3) / Math.sqrt(radius),
        phase: rand() * Math.PI * 2,
        tiltX: (rand() - 0.5) * 1.1,
        tiltZ: (rand() - 0.5) * 1.1,
        newest: i === 0,
      };
    });
}

/** City lights for a contributor count: log-scaled, capped. 0 when unknown. */
export const populationLights = (contributors: number | null) =>
  contributors == null || contributors <= 0 ? 0 : Math.min(400, Math.round(40 * Math.log10(contributors + 1)));

/**
 * 0..1: how much of the year's commits landed in the last 4 weeks, relative to an even spread.
 * 0 = quiet lately, 1 = ≥3x the yearly average pace.
 */
export function recentActivity(weekly: number[] | null): number {
  if (!weekly?.length) return 0;
  const total = weekly.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  const recent = weekly.slice(-4).reduce((a, b) => a + b, 0);
  const share = recent / total, even = Math.min(4, weekly.length) / weekly.length;
  return Math.min(1, share / even / 3);
}

/** Pushed within the last 24 hours. */
export const pushedRecently = (pushedAt: string, now = Date.now()) => {
  const t = Date.parse(pushedAt);
  return Number.isFinite(t) && now - t <= DAY && now - t >= -DAY;
};
