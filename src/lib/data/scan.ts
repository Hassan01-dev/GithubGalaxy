import { cacheLife } from "next/cache";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { fetchScan, GitHubError, validRepoPart } from "@/lib/github/client";
import type { PlanetScan, ScanResult } from "@/types";

const FRESH_MS = 12 * 3_600_000;
// Partial scans (or stats GitHub is still computing) are retried much sooner.
const PARTIAL_FRESH_MS = 15 * 60_000;

const incomplete = (s: PlanetScan) => s.partial || s.weeklyCommits === null;

/** Planet scan: database first, GitHub when stale, stale copy when GitHub fails. Never throws. */
export async function loadScan(owner: string, name: string): Promise<ScanResult> {
  "use cache";
  if (!validRepoPart(owner) || !validRepoPart(name)) {
    cacheLife("days");
    return { status: "not_found" };
  }
  const key = `${owner}/${name}`.toLowerCase();

  let cached: PlanetScan | null = null;
  try {
    const row = await db.repoScan.findUnique({ where: { fullName: key } });
    if (row) {
      cached = {
        fullName: `${owner}/${name}`,
        contributorsCount: row.contributorsCount,
        topContributors: row.topContributors as unknown as PlanetScan["topContributors"],
        weeklyCommits: row.weeklyCommits as PlanetScan["weeklyCommits"],
        languages: row.languages as unknown as PlanetScan["languages"],
        releases: row.releases as unknown as PlanetScan["releases"],
        partial: row.partial,
        scannedAt: row.scannedAt.toISOString(),
      };
      if (Date.now() - row.scannedAt.getTime() < (incomplete(cached) ? PARTIAL_FRESH_MS : FRESH_MS)) {
        if (incomplete(cached)) cacheLife("minutes");
        else cacheLife("hours");
        return { status: "ok", scan: cached, source: "cache" };
      }
    }
  } catch (e) {
    console.error("[scan] database unavailable:", (e as Error).message);
  }

  try {
    const scan = await fetchScan(owner, name);
    try {
      const data = {
        contributorsCount: scan.contributorsCount,
        topContributors: scan.topContributors as unknown as Prisma.InputJsonValue,
        weeklyCommits: scan.weeklyCommits ?? Prisma.DbNull,
        languages: scan.languages as unknown as Prisma.InputJsonValue,
        releases: scan.releases as unknown as Prisma.InputJsonValue,
        partial: scan.partial,
        scannedAt: new Date(scan.scannedAt),
      };
      await db.repoScan.upsert({ where: { fullName: key }, create: { fullName: key, ...data }, update: data });
    } catch (e) {
      console.error("[scan] persist failed:", (e as Error).message);
    }
    if (incomplete(scan)) cacheLife("minutes");
    else cacheLife("hours");
    return { status: "ok", scan, source: "live" };
  } catch (e) {
    if (e instanceof GitHubError && e.kind === "not_found") {
      cacheLife("hours");
      return { status: "not_found" };
    }
    cacheLife("seconds");
    if (cached) return { status: "ok", scan: cached, source: "cache" };
    const limited = e instanceof GitHubError && e.kind === "rate_limited";
    return { status: "unavailable", reason: limited ? "rate_limited" : "offline", resetAt: limited ? e.resetAt : null };
  }
}
