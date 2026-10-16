import type { ExplorerLog } from "@/lib/storage/log";

export interface Rank {
  id: string;
  name: string;
  /** XP needed to reach this rank. */
  min: number;
  emblem: string;
  description: string;
}

export const RANKS: Rank[] = [
  { id: "cadet", name: "Cadet", min: 0, emblem: "◇", description: "Fresh out of the academy. Every planet is new." },
  { id: "explorer", name: "Explorer", min: 100, emblem: "◆", description: "You've made first contact and started charting." },
  { id: "navigator", name: "Navigator", min: 500, emblem: "✧", description: "You find your way between regions and languages." },
  { id: "pathfinder", name: "Pathfinder", min: 1500, emblem: "✦", description: "You open routes others will follow." },
  { id: "voyager", name: "Voyager", min: 4000, emblem: "✶", description: "Long journeys across many galaxies." },
  { id: "cartographer", name: "Star Cartographer", min: 10_000, emblem: "✷", description: "Your log maps a real slice of open source." },
  { id: "legend", name: "Legend", min: 25_000, emblem: "✺", description: "Few have charted this much of the universe." },
];

/** Flight is the easiest XP to farm (just hold a key), so it is capped. */
export const FLIGHT_XP_CAP = 500;

export interface Score {
  xp: number;
  breakdown: { label: string; xp: number }[];
  rank: Rank;
  next: Rank | null;
  /** 0..1 toward `next`; 1 at the top rank. */
  progress: number;
}

type ScoreFacts = Pick<ExplorerLog, "visits" | "distanceFlown" | "journeysCompleted" | "achievements" | "missionsCompleted">;

/** Derived from the log every time, never stored, so it can't drift from what the log actually holds. */
export function scoreOf(log: ScoreFacts): Score {
  const distinct = <T>(xs: T[]) => new Set(xs).size;
  const breakdown = [
    { label: "Planets visited", xp: 10 * distinct(log.visits.map((v) => v.fullName)) },
    { label: "Languages discovered", xp: 25 * distinct(log.visits.flatMap((v) => v.language ?? [])) },
    { label: "Galaxies visited", xp: 50 * distinct(log.visits.map((v) => v.galaxy)) },
    { label: "Achievements", xp: 100 * distinct(log.achievements.map((a) => a.id)) },
    { label: "Missions completed", xp: 75 * distinct(log.missionsCompleted.map((m) => m.missionId)) },
    { label: "Journeys completed", xp: 150 * distinct(log.journeysCompleted) },
    { label: "Distance flown", xp: Math.min(FLIGHT_XP_CAP, Math.floor(log.distanceFlown / 100)) },
  ];
  const xp = breakdown.reduce((s, b) => s + b.xp, 0);
  const i = RANKS.findLastIndex((r) => xp >= r.min);
  const rank = RANKS[i];
  const next = RANKS[i + 1] ?? null;
  return { xp, breakdown, rank, next, progress: next ? (xp - rank.min) / (next.min - rank.min) : 1 };
}
