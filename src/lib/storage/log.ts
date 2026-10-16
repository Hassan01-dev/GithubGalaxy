"use client";
import { useSyncExternalStore } from "react";
import { z } from "zod";
import { toast } from "@/components/explorer/Toasts";
import { ACHIEVEMENTS, evaluateAchievements } from "@/lib/discovery/achievements";
import { evaluateMission, type Mission } from "@/lib/discovery/missions";
import { scoreOf } from "@/lib/discovery/score";
import { favorites } from "@/lib/storage/favorites";
import type { Repository } from "@/types";

/** Explorer's Log: what this browser has visited and unlocked. localStorage only, never sent anywhere. */
const KEY = "osg:log:v1";
const MAX_VISITS = 1000;
/** Activity gap that starts a new session. */
export const SESSION_GAP = 30 * 60_000;

const iso = z.string().max(40);
const slug = z.string().max(80);
const visit = z.object({
  fullName: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/).max(201),
  galaxy: slug,
  region: slug,
  language: z.string().max(80).nullable(),
  license: z.string().max(80).nullable(),
  stars: z.number().int().nonnegative(),
  pushedAt: iso,
  createdAt: iso,
  topics: z.array(z.string().max(80)).max(10),
  at: iso,
});
export type Visit = z.infer<typeof visit>;

const log = z.object({
  /** Newest first, one per repo. */
  visits: z.array(visit).max(MAX_VISITS),
  distanceFlown: z.number().nonnegative().finite(),
  journeysCompleted: z.array(slug).max(500),
  achievements: z.array(z.object({ id: slug, at: iso })).max(100),
  missionsCompleted: z.array(z.object({ dateKey: z.string().max(10), missionId: z.string().max(300) })).max(400),
  // Added later: `.catch` keeps logs stored before these fields existed valid.
  firstVisitAt: iso.nullable().catch(null),
  /** Last activity in this browser. */
  lastVisitAt: iso.nullable().catch(null),
  /** Last activity of the previous session, so "last visit" isn't overwritten by the current one. */
  previousVisitAt: iso.nullable().catch(null),
  sessions: z.number().int().nonnegative().catch(0),
});
export type ExplorerLog = z.infer<typeof log>;

const empty = (): ExplorerLog => ({
  visits: [], distanceFlown: 0, journeysCompleted: [], achievements: [], missionsCompleted: [], firstVisitAt: null, lastVisitAt: null, previousVisitAt: null, sessions: 0,
});

/** Validates untrusted data (storage or a backup file). Null when it isn't a valid log. */
export function parseLog(data: unknown): ExplorerLog | null {
  const r = log.safeParse(data);
  return r.success ? r.data : null;
}

const minIso = (a: string | null, b: string | null) => (!a ? b : !b ? a : a < b ? a : b);
const maxIso = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);
// Logs stored before sessions existed: fall back to the earliest visit.
const firstOf = (l: ExplorerLog) => l.firstVisitAt ?? l.visits.reduce<string | null>((m, v) => minIso(m, v.at), null);

/** Union of two logs (restore from backup). Never loses progress: keyed unions, max distance, earliest first visit. Pure. */
export function mergeLogs(a: ExplorerLog, b: ExplorerLog): ExplorerLog {
  const visits = new Map<string, Visit>();
  for (const v of [...a.visits, ...b.visits]) if (!visits.has(v.fullName) || visits.get(v.fullName)!.at < v.at) visits.set(v.fullName, v);
  const achievements = new Map<string, string>();
  for (const x of [...a.achievements, ...b.achievements]) achievements.set(x.id, minIso(achievements.get(x.id) ?? null, x.at)!);
  const missions = new Map([...a.missionsCompleted, ...b.missionsCompleted].map((m) => [m.missionId, m]));
  return {
    visits: [...visits.values()].sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0)).slice(0, MAX_VISITS),
    distanceFlown: Math.max(a.distanceFlown, b.distanceFlown),
    journeysCompleted: [...new Set([...a.journeysCompleted, ...b.journeysCompleted])].slice(-500),
    achievements: [...achievements].map(([id, at]) => ({ id, at })).slice(0, 100),
    missionsCompleted: [...missions.values()].sort((x, y) => x.dateKey.localeCompare(y.dateKey)).slice(-400),
    firstVisitAt: minIso(firstOf(a), firstOf(b)),
    lastVisitAt: maxIso(a.lastVisitAt, b.lastVisitAt),
    previousVisitAt: maxIso(a.previousVisitAt, b.previousVisitAt),
    // ponytail: sessions from two devices can't be de-duplicated, so take the larger count rather than inflate it.
    sessions: Math.max(a.sessions, b.sessions),
  };
}
const SERVER = empty();

let cache: ExplorerLog | null = null;
let mission: Mission | null = null;
let pendingDistance = 0;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function read(): ExplorerLog {
  if (cache) return cache;
  try {
    cache = parseLog(JSON.parse(localStorage.getItem(KEY) ?? "null")) ?? empty();
  } catch {
    cache = empty();
  }
  return cache;
}

function write(next: ExplorerLog) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked (private mode): keep working in memory.
  }
  listeners.forEach((l) => l());
}

const missionNewlyDone = (l: ExplorerLog) => !!mission && !l.missionsCompleted.some((m) => m.missionId === mission!.id) && evaluateMission(mission, l.visits).done;

/** Commits only if something outside a log mutation (favorites, a new mission) earned a reward. */
function recheck() {
  const c = read();
  if (missionNewlyDone(c) || evaluateAchievements(c, { favorites: favorites.get().repos.length }).length) commit({ ...c });
}

/** Applies newly earned achievements / today's mission, persists once, then announces. */
function commit(next: ExplorerLog) {
  const at = new Date().toISOString();
  const before = scoreOf(read()).rank;
  next = { ...next, firstVisitAt: firstOf(next) ?? at, lastVisitAt: at };
  const unlocked = evaluateAchievements(next, { favorites: favorites.get().repos.length });
  if (unlocked.length) next = { ...next, achievements: [...next.achievements, ...unlocked.map((id) => ({ id, at }))] };
  const missionDone = missionNewlyDone(next);
  if (missionDone) next = { ...next, missionsCompleted: [...next.missionsCompleted, { dateKey: mission!.dateKey, missionId: mission!.id }].slice(-400) };

  write(next);
  for (const id of unlocked) {
    const a = ACHIEVEMENTS.find((x) => x.id === id)!;
    toast.show({ tone: "achievement", title: a.title, body: a.description, icon: a.icon });
  }
  if (missionDone) toast.show({ tone: "mission", title: mission!.title, body: "New mission tomorrow.", icon: "✅" });
  const after = scoreOf(next).rank;
  if (after.min > before.min) toast.show({ tone: "rank", title: `You are now ${/^[AEIOU]/.test(after.name) ? "an" : "a"} ${after.name}`, body: after.description, icon: after.emblem });
}

function flush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = null;
  if (!pendingDistance) return;
  const c = read();
  const d = pendingDistance;
  pendingDistance = 0;
  commit({ ...c, distanceFlown: c.distanceFlown + d });
}

if (typeof window !== "undefined") {
  // Favorites live in another store; re-check so "Curator" unlocks when a planet is saved.
  favorites.subscribe(recheck);
  window.addEventListener("pagehide", flush);
}

export const explorerLog = {
  get: read,
  serverSnapshot: SERVER,
  subscribe(l: () => void) {
    listeners.add(l);
    const onStorage = (e: StorageEvent) => e.key === KEY && ((cache = null), l());
    window.addEventListener("storage", onStorage);
    return () => (listeners.delete(l), window.removeEventListener("storage", onStorage));
  },
  visit(repo: Repository, galaxy: string, region: string) {
    const c = read();
    const v: Visit = {
      fullName: repo.fullName, galaxy: galaxy.slice(0, 80), region: region.slice(0, 80), language: repo.language?.slice(0, 80) ?? null, license: repo.license?.slice(0, 80) ?? null,
      stars: repo.stars, pushedAt: repo.pushedAt, createdAt: repo.createdAt, topics: repo.topics.slice(0, 10), at: new Date().toISOString(),
    };
    // A record that fails the schema would invalidate the whole stored log on next load.
    if (!visit.safeParse(v).success) return;
    commit({ ...c, visits: [v, ...c.visits.filter((x) => x.fullName !== repo.fullName)].slice(0, MAX_VISITS) });
  },
  /** Called often from flight mode: buffered and persisted at most once a second. */
  addDistance(units: number) {
    if (!Number.isFinite(units) || units <= 0) return;
    pendingDistance += units;
    flushTimer ??= setTimeout(flush, 1000);
  },
  completeJourney(slug: string) {
    const c = read();
    if (!c.journeysCompleted.includes(slug)) commit({ ...c, journeysCompleted: [...c.journeysCompleted, slug.slice(0, 80)].slice(-500) });
  },
  /** MissionChip registers today's mission so visits can complete it. Completes immediately if already satisfied. */
  trackMission(m: Mission | null) {
    mission = m;
    recheck();
  },
  isMissionDone: (id: string) => read().missionsCompleted.some((m) => m.missionId === id),
  /** Call once on app start. A new session starts when the last activity was more than SESSION_GAP ago. */
  touchSession(now = Date.now()): { returning: boolean; awayMs: number } {
    const c = read();
    const lastIso = c.lastVisitAt ?? c.visits[0]?.at ?? null;
    const firstIso = firstOf(c);
    const last = lastIso ? Date.parse(lastIso) : NaN;
    const awayMs = Number.isFinite(last) ? Math.max(0, now - last) : 0;
    const fresh = !Number.isFinite(last) || awayMs > SESSION_GAP;
    const at = new Date(now).toISOString();
    // Plain write: opening the app isn't an achievement-worthy mutation.
    write({ ...c, firstVisitAt: firstIso ?? at, lastVisitAt: at, previousVisitAt: fresh ? lastIso ?? c.previousVisitAt : c.previousVisitAt, sessions: c.sessions + (fresh ? 1 : 0) });
    return { returning: fresh && Number.isFinite(last), awayMs };
  },
  /** Merges a validated log (backup restore). Newly satisfied achievements and rank-ups are announced as usual. */
  merge(incoming: ExplorerLog) {
    flush();
    commit(mergeLogs(read(), incoming));
  },
  /** Persists buffered flight distance now (e.g. before a backup). */
  flush,
  reset() {
    pendingDistance = 0;
    if (flushTimer) clearTimeout(flushTimer);
    flushTimer = null;
    // Plain write: clearing shouldn't instantly re-award "Curator" from favorites.
    write(empty());
  },
  /** Test hooks. */
  _reset: () => void ((cache = null), (mission = null)),
  _flush: flush,
};

export const useExplorerLog = () => useSyncExternalStore(explorerLog.subscribe, explorerLog.get, () => SERVER);
