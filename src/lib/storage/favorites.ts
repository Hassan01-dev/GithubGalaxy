import { z } from "zod";
import type { Repository } from "@/types";

/**
 * Favorites ("My Universe") live only in this browser's localStorage.
 * We store a small snapshot so the list renders without any network call.
 */
const KEY = "osg:favorites:v1";
const MAX = 500;

const favorite = z.object({
  fullName: z.string().regex(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/).max(201),
  description: z.string().max(1000).nullable(),
  language: z.string().max(80).nullable(),
  stars: z.number().int().nonnegative(),
  savedAt: z.string().max(40),
});
export type Favorite = z.infer<typeof favorite>;

const collection = z.object({ title: z.string().max(120), updatedAt: z.string().max(40), repos: z.array(favorite).max(MAX) });
export type Collection = z.infer<typeof collection>;

const empty = (): Collection => ({ title: "My Universe", updatedAt: new Date(0).toISOString(), repos: [] });

/** Parses untrusted JSON (storage or an imported file). Returns null when it isn't a valid collection. */
export function parseCollection(text: string | null): Collection | null {
  if (!text) return null;
  try {
    const r = collection.safeParse(JSON.parse(text));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

export function toFavorite(repo: Repository): Favorite {
  return { fullName: repo.fullName, description: repo.description?.slice(0, 1000) ?? null, language: repo.language, stars: repo.stars, savedAt: new Date().toISOString() };
}

let cache: Collection | null = null;
const listeners = new Set<() => void>();

function read(): Collection {
  if (cache) return cache;
  try {
    cache = parseCollection(localStorage.getItem(KEY)) ?? empty();
  } catch {
    cache = empty();
  }
  return cache;
}

function write(next: Collection) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked (private mode): keep working in memory.
  }
  listeners.forEach((l) => l());
}

export const favorites = {
  get: read,
  serverSnapshot: empty(),
  subscribe(l: () => void) {
    listeners.add(l);
    const onStorage = (e: StorageEvent) => e.key === KEY && ((cache = null), l());
    window.addEventListener("storage", onStorage);
    return () => (listeners.delete(l), window.removeEventListener("storage", onStorage));
  },
  has: (fullName: string) => read().repos.some((r) => r.fullName === fullName),
  toggle(repo: Repository) {
    const c = read();
    const repos = c.repos.some((r) => r.fullName === repo.fullName) ? c.repos.filter((r) => r.fullName !== repo.fullName) : [toFavorite(repo), ...c.repos].slice(0, MAX);
    write({ ...c, repos, updatedAt: new Date().toISOString() });
  },
  remove(fullName: string) {
    const c = read();
    write({ ...c, repos: c.repos.filter((r) => r.fullName !== fullName), updatedAt: new Date().toISOString() });
  },
  /** Merges an imported collection. Returns how many new repos were added, or null if the file was invalid. */
  import(text: string): number | null {
    const incoming = parseCollection(text);
    if (!incoming) return null;
    const c = read();
    const known = new Set(c.repos.map((r) => r.fullName));
    const added = incoming.repos.filter((r) => !known.has(r.fullName));
    write({ ...c, repos: [...c.repos, ...added].slice(0, MAX), updatedAt: new Date().toISOString() });
    return added.length;
  },
  clear: () => write({ ...empty(), updatedAt: new Date().toISOString() }),
  /** Test hook. */
  _reset: () => void (cache = null),
};
