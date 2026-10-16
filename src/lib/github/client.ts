import { z } from "zod";
import type { Contributor, PlanetScan, Release, Repository } from "@/types";
import { safeUrl } from "@/lib/url";

export { safeUrl };

const API = "https://api.github.com";
const TIMEOUT_MS = 10_000;

export class GitHubError extends Error {
  constructor(
    message: string,
    readonly kind: "rate_limited" | "not_found" | "network" | "invalid" | "http",
    readonly resetAt: string | null = null,
  ) {
    super(message);
  }
}

const rawRepo = z.object({
  id: z.number(),
  full_name: z.string(),
  name: z.string(),
  owner: z.object({ login: z.string() }),
  description: z.string().nullable().optional(),
  html_url: z.string(),
  homepage: z.string().nullable().optional(),
  stargazers_count: z.number(),
  forks_count: z.number(),
  open_issues_count: z.number(),
  language: z.string().nullable().optional(),
  topics: z.array(z.string()).optional(),
  license: z.object({ spdx_id: z.string().nullable().optional(), name: z.string().nullable().optional() }).nullable().optional(),
  archived: z.boolean().optional(),
  default_branch: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  pushed_at: z.string().nullable().optional(),
});
export type RawRepo = z.infer<typeof rawRepo>;

const rawRelease = z.object({ tag_name: z.string(), published_at: z.string().nullable() });

export function mapRepo(raw: RawRepo, fetchedAt: string): Repository {
  const spdx = raw.license?.spdx_id;
  return {
    id: raw.id,
    fullName: raw.full_name,
    owner: raw.owner.login,
    name: raw.name,
    description: raw.description?.trim() || null,
    htmlUrl: safeUrl(raw.html_url) ?? `https://github.com/${raw.full_name}`,
    homepage: safeUrl(raw.homepage),
    stars: raw.stargazers_count,
    forks: raw.forks_count,
    openIssues: raw.open_issues_count,
    language: raw.language ?? null,
    topics: raw.topics ?? [],
    // GitHub reports unrecognised licenses as NOASSERTION; that's not a license name.
    license: spdx && spdx !== "NOASSERTION" ? spdx : raw.license?.name && raw.license.name !== "Other" ? raw.license.name : null,
    archived: raw.archived ?? false,
    defaultBranch: raw.default_branch ?? null,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    pushedAt: raw.pushed_at ?? raw.updated_at,
    latestRelease: null,
    fetchedAt,
    starGrowth: null,
  };
}

/** Throws on network, 404 and rate limits; other statuses are left to the caller. */
async function ghRaw(path: string): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "open-source-galaxy",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { headers, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch (e) {
    throw new GitHubError(`GitHub unreachable: ${(e as Error).message}`, "network");
  }
  if (res.status === 404) throw new GitHubError("Not found", "not_found");
  if (res.status === 429 || (res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0")) {
    const reset = Number(res.headers.get("x-ratelimit-reset"));
    throw new GitHubError("GitHub rate limit reached", "rate_limited", reset ? new Date(reset * 1000).toISOString() : null);
  }
  return res;
}

async function gh(path: string): Promise<unknown> {
  const res = await ghRaw(path);
  if (!res.ok) throw new GitHubError(`GitHub responded ${res.status}`, "http");
  return res.json();
}

const searchResponse = z.object({ items: z.array(z.unknown()) });

/** Bounded search. Items that fail validation are dropped, not fatal. */
export async function searchRepos(q: string, sort: "stars" | "updated" | "best", limit: number): Promise<Repository[]> {
  const params = new URLSearchParams({ q, per_page: String(Math.min(limit, 100)) });
  if (sort !== "best") {
    params.set("sort", sort);
    params.set("order", "desc");
  }
  const parsed = searchResponse.safeParse(await gh(`/search/repositories?${params}`));
  if (!parsed.success) throw new GitHubError("Unexpected search response", "invalid");
  const now = new Date().toISOString();
  return parsed.data.items.flatMap((item) => {
    const r = rawRepo.safeParse(item);
    return r.success ? [mapRepo(r.data, now)] : [];
  });
}

export async function getRepo(owner: string, name: string): Promise<Repository> {
  const r = rawRepo.safeParse(await gh(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`));
  if (!r.success) throw new GitHubError("Unexpected repository response", "invalid");
  return mapRepo(r.data, new Date().toISOString());
}

/** Latest published release, or null when the repo has none. */
export async function getLatestRelease(owner: string, name: string): Promise<Repository["latestRelease"]> {
  try {
    const r = rawRelease.safeParse(await gh(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/releases/latest`));
    return r.success && r.data.published_at ? { tag: r.data.tag_name, publishedAt: r.data.published_at } : null;
  } catch (e) {
    if (e instanceof GitHubError && e.kind === "not_found") return null;
    throw e;
  }
}

/** GitHub owner/repo names: letters, digits, '-', '_', '.'. Rejects anything else before it reaches a URL. */
export const validRepoPart = (s: string) => /^[A-Za-z0-9_.-]{1,100}$/.test(s) && s !== "." && s !== "..";

// ── Planet scan: deeper per-repo data, fetched only when a planet is inspected ──

const repoPath = (owner: string, name: string) => `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`;

/** Page number of the `rel="last"` link, i.e. the item count when per_page=1. */
export function parseLastPage(linkHeader: string | null): number | null {
  const last = linkHeader?.split(",").find((part) => /rel="last"/.test(part));
  const url = last?.match(/<([^>]+)>/)?.[1];
  if (!url) return null;
  try {
    const page = Number(new URL(url).searchParams.get("page"));
    return Number.isInteger(page) && page > 0 ? page : null;
  } catch {
    return null;
  }
}

const rawContributor = z.object({ login: z.string(), avatar_url: z.string(), html_url: z.string().optional(), contributions: z.number() });

export function mapContributors(raw: unknown): Contributor[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const c = rawContributor.safeParse(item);
    if (!c.success) return [];
    const avatar = safeUrl(c.data.avatar_url);
    return [{
      login: c.data.login,
      // Rendered as <img>: only GitHub's avatar host, anything else falls back to an initial.
      avatarUrl: avatar && new URL(avatar).hostname === "avatars.githubusercontent.com" ? avatar : "",
      htmlUrl: safeUrl(c.data.html_url) ?? `https://github.com/${encodeURIComponent(c.data.login)}`,
      contributions: c.data.contributions,
    }];
  });
}

export function mapParticipation(raw: unknown): number[] | null {
  const r = z.object({ all: z.array(z.number().int().nonnegative()).length(52) }).safeParse(raw);
  return r.success ? r.data.all : null;
}

export function mapLanguages(raw: unknown): PlanetScan["languages"] {
  const r = z.record(z.string(), z.number()).safeParse(raw);
  if (!r.success) return [];
  return Object.entries(r.data).filter(([, bytes]) => bytes > 0).map(([name, bytes]) => ({ name, bytes })).sort((a, b) => b.bytes - a.bytes);
}

const rawScanRelease = z.object({ tag_name: z.string(), name: z.string().nullable().optional(), draft: z.boolean().optional(), published_at: z.string().nullable().optional(), html_url: z.string() });

/** Published releases, newest first. Drafts and undated entries are skipped. */
export function mapReleases(raw: unknown, limit = 10): Release[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .flatMap((item) => {
      const r = rawScanRelease.safeParse(item);
      const htmlUrl = r.success ? safeUrl(r.data.html_url) : null;
      if (!r.success || r.data.draft || !r.data.published_at || !htmlUrl) return [];
      return [{ tag: r.data.tag_name, name: r.data.name?.trim() || null, publishedAt: r.data.published_at, htmlUrl }];
    })
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, limit);
}

/** Top 12 contributors and the total count. Count is null when GitHub refuses to list (huge histories). */
export async function getContributors(owner: string, name: string): Promise<{ count: number | null; top: Contributor[] }> {
  const base = `${repoPath(owner, name)}/contributors?anon=false&per_page=`;
  const res = await ghRaw(`${base}12`);
  if (res.status === 204) return { count: 0, top: [] }; // empty repository
  if (res.status === 403 && /too large/i.test(await res.text())) return { count: null, top: [] };
  if (!res.ok) throw new GitHubError(`GitHub responded ${res.status}`, "http");
  const top = mapContributors(await res.json());
  // No Link header means everything fit on one page; otherwise per_page=1 makes the last page number the total.
  if (!res.headers.get("link")) return { count: top.length, top };
  const one = await ghRaw(`${base}1`);
  return { count: one.ok ? parseLastPage(one.headers.get("link")) : null, top };
}

/** 52 weekly commit counts, oldest first. Null while GitHub computes them (202). */
export async function getWeeklyCommits(owner: string, name: string): Promise<number[] | null> {
  const res = await ghRaw(`${repoPath(owner, name)}/stats/participation`);
  if (res.status === 202 || res.status === 204) return null;
  if (!res.ok) throw new GitHubError(`GitHub responded ${res.status}`, "http");
  return mapParticipation(await res.json());
}

export async function getLanguages(owner: string, name: string): Promise<PlanetScan["languages"]> {
  return mapLanguages(await gh(`${repoPath(owner, name)}/languages`));
}

export async function getReleases(owner: string, name: string): Promise<Release[]> {
  return mapReleases(await gh(`${repoPath(owner, name)}/releases?per_page=10`));
}

/**
 * All four scan parts in parallel. Failed parts become empty/null with `partial: true`.
 * Throws not_found for a missing repo, and the (rate-limit-preferring) error when every part failed.
 */
export async function fetchScan(owner: string, name: string): Promise<PlanetScan> {
  const [c, w, l, r] = await Promise.allSettled([getContributors(owner, name), getWeeklyCommits(owner, name), getLanguages(owner, name), getReleases(owner, name)]);
  const errors = [c, w, l, r].flatMap((s) => (s.status === "rejected" ? [s.reason as unknown] : []));
  const kind = (k: GitHubError["kind"]) => errors.find((e) => e instanceof GitHubError && e.kind === k);
  if (kind("not_found")) throw kind("not_found");
  if (errors.length === 4) throw kind("rate_limited") ?? errors[0];
  return {
    fullName: `${owner}/${name}`,
    contributorsCount: c.status === "fulfilled" ? c.value.count : null,
    topContributors: c.status === "fulfilled" ? c.value.top : [],
    weeklyCommits: w.status === "fulfilled" ? w.value : null,
    languages: l.status === "fulfilled" ? l.value : [],
    releases: r.status === "fulfilled" ? r.value : [],
    scannedAt: new Date().toISOString(),
    partial: errors.length > 0,
  };
}
