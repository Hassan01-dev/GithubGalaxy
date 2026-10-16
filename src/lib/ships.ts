/**
 * Hangar catalog. Pure data: the 3D models live in components/scene/ships and read their
 * colours and nozzle positions from here, so the preview and the galaxy can never disagree.
 *
 * Stats are real: they set flight-mode cruise speed, boost speed and turn rate (see `flightOf`).
 * Every ship totals 8–10 points, so none is strictly best.
 */
export type ShipId = "scout" | "interceptor" | "manta" | "hauler" | "ringrunner" | "lantern";

/** 1–5 each. */
export interface ShipStats {
  speed: number;
  boost: number;
  agility: number;
}

export interface ShipDef {
  id: ShipId;
  name: string;
  tagline: string;
  description: string;
  stats: ShipStats;
  palette: { hull: string; trim: string; glow: string };
  /** Nozzle positions in model space (+Z forward, +Y up). One exhaust trail per nozzle. */
  exhaust: [number, number, number][];
  /** Points per nozzle, sprite size, opacity. */
  trail: { length: number; size: number; opacity: number };
}

export const DEFAULT_SHIP: ShipId = "scout";

export const SHIPS: ShipDef[] = [
  {
    id: "scout",
    name: "Scout",
    tagline: "The trusty little dart",
    description: "Balanced and forgiving. The ship every explorer starts with, and plenty never leave it.",
    stats: { speed: 3, boost: 3, agility: 3 },
    palette: { hull: "#d9dde8", trim: "#7f8aa8", glow: "#f5a65b" },
    exhaust: [[0, 0, -0.95]],
    trail: { length: 14, size: 0.35, opacity: 0.4 },
  },
  {
    id: "interceptor",
    name: "Interceptor",
    tagline: "Swept-wing needle",
    description: "A long, thin hull with knife-edge wings. Fast in a straight line and quick to turn, but light on boost.",
    stats: { speed: 4, boost: 2, agility: 4 },
    palette: { hull: "#e8ecf4", trim: "#d2423f", glow: "#7cc8ff" },
    exhaust: [[0, 0, -1.08]],
    trail: { length: 20, size: 0.22, opacity: 0.5 },
  },
  {
    id: "manta",
    name: "Manta",
    tagline: "Glides on a glowing wing",
    description: "A wide, flat stingray wing that lights from beneath. Unhurried, yet it carves the tightest turns in the fleet.",
    stats: { speed: 2, boost: 3, agility: 5 },
    palette: { hull: "#25304a", trim: "#4f6a9a", glow: "#3ff2d0" },
    exhaust: [[-0.28, 0.02, -0.68], [0.28, 0.02, -0.68]],
    trail: { length: 12, size: 0.3, opacity: 0.35 },
  },
  {
    id: "hauler",
    name: "Hauler",
    tagline: "Freighter with cargo pods",
    description: "Chunky, slow to turn, and built around two enormous engines. Nothing out-boosts it once it gets going.",
    stats: { speed: 2, boost: 5, agility: 1 },
    palette: { hull: "#c9a25e", trim: "#4b4f5c", glow: "#ff7a3d" },
    exhaust: [[-0.3, 0.02, -0.98], [0.3, 0.02, -0.98]],
    trail: { length: 12, size: 0.5, opacity: 0.35 },
  },
  {
    id: "ringrunner",
    name: "Ring Runner",
    tagline: "Saucer with a spinning ring drive",
    description: "A domed saucer wrapped in an outer ring engine that never stops turning. Strong boost, steady handling.",
    stats: { speed: 3, boost: 4, agility: 3 },
    palette: { hull: "#b9c2d6", trim: "#6a5acd", glow: "#c08bff" },
    exhaust: [[0, 0, -0.78]],
    trail: { length: 10, size: 0.55, opacity: 0.3 },
  },
  {
    id: "lantern",
    name: "Solar Lantern",
    tagline: "Rides a gossamer sail",
    description: "A slender core under a shimmering solar sail. The fastest cruiser out there, but it barely has a boost.",
    stats: { speed: 5, boost: 1, agility: 3 },
    palette: { hull: "#f1e6c8", trim: "#b48a3c", glow: "#ffd76a" },
    exhaust: [[0, 0, -0.98]],
    trail: { length: 26, size: 0.2, opacity: 0.55 },
  },
];

const byId = new Map(SHIPS.map((s) => [s.id as string, s]));

/** Unknown or stale ids (e.g. a ship removed from the catalog) fall back to the default. */
export function getShip(id: string | null | undefined): ShipDef {
  return byId.get(id ?? "") ?? byId.get(DEFAULT_SHIP)!;
}

/** Flight caps: cruise 22–34, boost 55–80, turn 1.2–1.9 rad/s. */
export function flightOf(stats: ShipStats) {
  const t = (v: number) => (Math.min(5, Math.max(1, v)) - 1) / 4;
  return { cruise: 22 + t(stats.speed) * 12, boost: 55 + t(stats.boost) * 25, turn: 1.2 + t(stats.agility) * 0.7 };
}
