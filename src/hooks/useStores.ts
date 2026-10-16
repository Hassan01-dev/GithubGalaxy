"use client";
import { useSyncExternalStore } from "react";
import { favorites } from "@/lib/storage/favorites";
import { DEFAULT_SETTINGS, settings } from "@/lib/storage/settings";

export const useFavorites = () => useSyncExternalStore(favorites.subscribe, favorites.get, () => favorites.serverSnapshot);
export const useSettings = () => useSyncExternalStore(settings.subscribe, settings.get, () => DEFAULT_SETTINGS);

function useMedia(query: string, fallback: boolean) {
  return useSyncExternalStore(
    (l) => {
      const m = matchMedia(query);
      m.addEventListener("change", l);
      return () => m.removeEventListener("change", l);
    },
    () => matchMedia(query).matches,
    () => fallback,
  );
}

/** Effective motion/effects after combining the user's choice with OS and device signals. */
export function useEnvironment() {
  const s = useSettings();
  const osReduced = useMedia("(prefers-reduced-motion: reduce)", false);
  const coarse = useMedia("(pointer: coarse)", false);
  const small = useMedia("(max-width: 767px)", false);
  return {
    reducedMotion: s.reducedMotion ?? osReduced,
    lowEffects: s.lowEffects ?? (coarse || small),
    connections: s.connections,
    touch: coarse,
    mobile: small,
  };
}
