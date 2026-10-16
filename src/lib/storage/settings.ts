import { z } from "zod";

const KEY = "osg:settings:v1";
const schema = z.object({
  /** null = follow the OS preference. */
  reducedMotion: z.boolean().nullable().catch(null),
  /** null = decide from the device. */
  lowEffects: z.boolean().nullable().catch(null),
  connections: z.boolean().catch(true),
  hintsDismissed: z.boolean().catch(false),
  /** Chosen ship id from the hangar; unknown ids fall back to the default ship at render time. */
  ship: z.string().max(40).catch("scout"),
});
export type Settings = z.infer<typeof schema>;
export const DEFAULT_SETTINGS: Settings = { reducedMotion: null, lowEffects: null, connections: true, hintsDismissed: false, ship: "scout" };

let cache: Settings | null = null;
const listeners = new Set<() => void>();

export const settings = {
  get(): Settings {
    if (cache) return cache;
    try {
      cache = schema.parse({ ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") });
    } catch {
      cache = DEFAULT_SETTINGS;
    }
    return cache;
  },
  set(patch: Partial<Settings>) {
    cache = { ...settings.get(), ...patch };
    try {
      localStorage.setItem(KEY, JSON.stringify(cache));
    } catch {}
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
};
