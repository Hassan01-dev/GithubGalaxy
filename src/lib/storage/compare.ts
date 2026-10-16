"use client";
import { useSyncExternalStore } from "react";
import { toast } from "@/components/explorer/Toasts";
import type { Repository } from "@/types";

// ponytail: in-memory only (survives client navigation, not reload); persist to sessionStorage if users ask.
export const COMPARE_MAX = 3;
const EMPTY: Repository[] = [];
let items: Repository[] = EMPTY;
const listeners = new Set<() => void>();
const set = (next: Repository[]) => ((items = next), listeners.forEach((l) => l()));

export const compare = {
  get: () => items,
  subscribe(l: () => void) {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
  has: (fullName: string) => items.some((r) => r.fullName === fullName),
  /** Adds or removes. Returns false when the tray is already full and nothing changed. */
  toggle(repo: Repository): boolean {
    if (compare.has(repo.fullName)) return set(items.filter((r) => r.fullName !== repo.fullName)), true;
    if (items.length >= COMPARE_MAX) {
      toast.show({ tone: "info", title: `Compare holds ${COMPARE_MAX} planets`, body: "Remove one from the tray first." });
      return false;
    }
    set([...items, repo]);
    return true;
  },
  remove: (fullName: string) => set(items.filter((r) => r.fullName !== fullName)),
  clear: () => set(EMPTY),
};

export const useCompare = () => useSyncExternalStore(compare.subscribe, compare.get, () => EMPTY);
