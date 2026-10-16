"use client";
import { useSyncExternalStore } from "react";
import { date, relative } from "@/lib/format";

const MINUTE = 60_000;
const subscribe = (l: () => void) => {
  const t = setInterval(l, MINUTE);
  return () => clearInterval(t);
};

/**
 * Current time rounded to the minute, or null during SSR and hydration.
 * Server HTML and the first client render must agree, so time-relative text waits for hydration.
 */
export const useNow = () => useSyncExternalStore(subscribe, () => Math.floor(Date.now() / MINUTE) * MINUTE, () => null);

/** "3 h ago" once hydrated; a fixed date before that. */
export function Ago({ iso }: { iso: string }) {
  const now = useNow();
  return <time dateTime={iso}>{now == null ? date(iso) : relative(iso, now)}</time>;
}
