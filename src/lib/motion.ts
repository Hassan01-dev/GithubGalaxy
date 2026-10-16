"use client";
import { settings } from "@/lib/storage/settings";

/**
 * Single source of truth for "should this animate?". Every anime.js / canvas animation checks it.
 * Respects the in-app toggle first, then the OS preference.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return true;
  const s = settings.get().reducedMotion;
  return s ?? window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
