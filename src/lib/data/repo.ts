import { cacheLife } from "next/cache";
import { db } from "@/lib/db";
import { getLatestRelease, getRepo, GitHubError, validRepoPart } from "@/lib/github/client";
import { persistRepos, rowToRepo, withGrowth } from "./store";
import { seedRepo } from "./seeds";
import type { DataSource, Repository } from "@/types";

export type RepoResult =
  | { status: "ok"; repo: Repository; source: DataSource }
  | { status: "not_found" }
  | { status: "unavailable"; reason: "rate_limited" | "offline"; resetAt: string | null };

const FRESH_MS = 6 * 3_600_000;

/** Full repository detail including latest release. Database first, GitHub when stale, seed as last resort. */
export async function loadRepo(owner: string, name: string): Promise<RepoResult> {
  "use cache";
  if (!validRepoPart(owner) || !validRepoPart(name)) {
    cacheLife("days");
    return { status: "not_found" };
  }
  const fullName = `${owner}/${name}`;

  let cached: Repository | null = null;
  try {
    const row = await db.repository.findFirst({ where: { fullName: { equals: fullName, mode: "insensitive" } }, select: { id: true, releaseCheckedAt: true } });
    if (row) {
      cached = rowToRepo((await withGrowth([row.id]))[0]);
      if (row.releaseCheckedAt && Date.now() - row.releaseCheckedAt.getTime() < FRESH_MS && Date.now() - Date.parse(cached.fetchedAt) < FRESH_MS) {
        cacheLife("hours");
        return { status: "ok", repo: cached, source: "cache" };
      }
    }
  } catch (e) {
    console.error("[repo] database unavailable:", (e as Error).message);
  }

  try {
    const [repo, latestRelease] = await Promise.all([getRepo(owner, name), getLatestRelease(owner, name)]);
    const full = { ...repo, latestRelease, starGrowth: cached?.starGrowth ?? null };
    try {
      await persistRepos([full]);
      await db.repository.update({
        where: { id: full.id },
        data: { latestRelease: latestRelease?.tag ?? null, latestReleaseAt: latestRelease ? new Date(latestRelease.publishedAt) : null, releaseCheckedAt: new Date() },
      });
    } catch (e) {
      console.error("[repo] persist failed:", (e as Error).message);
    }
    cacheLife("hours");
    return { status: "ok", repo: full, source: "live" };
  } catch (e) {
    if (e instanceof GitHubError && e.kind === "not_found") {
      cacheLife("hours");
      return { status: "not_found" };
    }
    cacheLife("seconds");
    const fallback = cached ?? seedRepo(fullName);
    if (fallback) return { status: "ok", repo: fallback, source: cached ? "cache" : "seed" };
    const limited = e instanceof GitHubError && e.kind === "rate_limited";
    return { status: "unavailable", reason: limited ? "rate_limited" : "offline", resetAt: limited ? e.resetAt : null };
  }
}
