"use client";
import { z } from "zod";
import { scoreOf } from "@/lib/discovery/score";
import { favorites, parseCollection } from "@/lib/storage/favorites";
import { explorerLog, parseLog } from "@/lib/storage/log";
import { settings } from "@/lib/storage/settings";

/** One file holding everything this browser knows about the visitor, for backup and moving devices. */
export const PROGRESS_VERSION = 1;
/** A full log (1,000 visits) plus 500 favorites is well under 1 MB; anything far bigger isn't ours. */
export const MAX_BACKUP_BYTES = 3_000_000;

const bundle = z.object({
  app: z.literal("open-source-galaxy"),
  version: z.literal(PROGRESS_VERSION),
  exportedAt: z.string().max(40),
  log: z.unknown(),
  favorites: z.unknown().optional(),
  settings: z.unknown().optional(),
});

// lowEffects is left out on purpose: it describes the device, not the person.
const portableSettings = z.object({
  reducedMotion: z.boolean().nullable(),
  connections: z.boolean(),
  hintsDismissed: z.boolean(),
  ship: z.string().max(40),
}).partial();

export function exportProgress(): string {
  explorerLog.flush();
  return JSON.stringify({ app: "open-source-galaxy", version: PROGRESS_VERSION, exportedAt: new Date().toISOString(), log: explorerLog.get(), favorites: favorites.get(), settings: settings.get() }, null, 2);
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** Validates every part before touching anything, then merges (never overwrites). Data only: nothing in the file is executed. */
export function importProgress(text: string): { ok: true; summary: string } | { ok: false; error: string } {
  if (text.length > MAX_BACKUP_BYTES) return { ok: false, error: "That file is too large to be a progress backup." };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "That file isn't valid JSON." };
  }
  const b = bundle.safeParse(raw);
  if (!b.success) return { ok: false, error: "That file isn't an Open Source Galaxy progress backup." };
  const log = parseLog(b.data.log);
  if (!log) return { ok: false, error: "The explorer log in that backup is damaged." };
  const favText = b.data.favorites === undefined ? null : JSON.stringify(b.data.favorites);
  if (favText && !parseCollection(favText)) return { ok: false, error: "The saved planets in that backup are damaged." };
  const prefs = b.data.settings === undefined ? null : portableSettings.safeParse(b.data.settings);
  if (prefs && !prefs.success) return { ok: false, error: "The settings in that backup are damaged." };

  const before = explorerLog.get();
  const xpBefore = scoreOf(before).xp;
  explorerLog.merge(log);
  const after = explorerLog.get();
  const addedFavs = favText ? favorites.import(favText) ?? 0 : 0;
  if (prefs?.success) settings.set(prefs.data);

  const parts = [
    plural(after.visits.length - before.visits.length, "new planet"),
    plural(after.achievements.length - before.achievements.length, "achievement"),
    plural(addedFavs, "saved planet"),
  ];
  return { ok: true, summary: `Restored ${parts.join(", ")} · +${(scoreOf(after).xp - xpBefore).toLocaleString("en")} XP.` };
}
