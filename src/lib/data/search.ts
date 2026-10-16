import { cacheLife } from "next/cache";
import { GitHubError, searchRepos } from "@/lib/github/client";
import type { Repository } from "@/types";

export type SearchResult =
  | { status: "ok"; repos: Repository[] }
  | { status: "rate_limited"; resetAt: string | null }
  | { status: "error" };

/** Cached per normalised query so repeated searches don't spend GitHub's 10–30/min search budget. */
export async function searchGitHub(q: string): Promise<SearchResult> {
  "use cache";
  try {
    const repos = await searchRepos(`${q} fork:false`, "best", 20);
    cacheLife("hours");
    return { status: "ok", repos };
  } catch (e) {
    cacheLife("seconds");
    if (e instanceof GitHubError && e.kind === "rate_limited") return { status: "rate_limited", resetAt: e.resetAt };
    console.error("[search]", (e as Error).message);
    return { status: "error" };
  }
}
