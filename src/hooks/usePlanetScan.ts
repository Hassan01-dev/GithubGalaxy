"use client";
import { useEffect, useState } from "react";
import type { PlanetScan, ScanResult } from "@/types";

export type ScanState = "idle" | "scanning" | "done" | "unavailable";

/** One request per repo per session, shared by every consumer (panel, 3D scene). */
const scanCache = new Map<string, Promise<ScanResult | null>>();
function fetchScan(fullName: string) {
  if (!scanCache.has(fullName))
    scanCache.set(
      fullName,
      fetch(`/api/repo/${fullName}/scan`)
        .then((r) => r.json() as Promise<ScanResult>)
        .then((r) => {
          // Failures and incomplete scans may succeed later: let a later inspection ask again.
          if (r.status === "unavailable") scanCache.delete(fullName);
          else if (r.status === "ok" && (r.scan.partial || !r.scan.weeklyCommits)) setTimeout(() => scanCache.delete(fullName), 60_000);
          return r;
        })
        .catch(() => (scanCache.delete(fullName), null)),
    );
  return scanCache.get(fullName)!;
}

export function usePlanetScan(fullName: string | null): { scan: PlanetScan | null; state: ScanState; reason?: string } {
  const [res, setRes] = useState<{ for: string; result: ScanResult | null } | null>(null);
  useEffect(() => {
    if (!fullName) return;
    let live = true;
    fetchScan(fullName).then((result) => live && setRes({ for: fullName, result }));
    return () => void (live = false);
  }, [fullName]);

  if (!fullName) return { scan: null, state: "idle" };
  // Results only count for the repo currently asked about; anything else is still in flight.
  if (res?.for !== fullName) return { scan: null, state: "scanning" };
  const r = res.result;
  if (r?.status === "ok") return { scan: r.scan, state: "done" };
  return { scan: null, state: "unavailable", reason: r ? (r.status === "not_found" ? "not_found" : r.reason) : "offline" };
}
