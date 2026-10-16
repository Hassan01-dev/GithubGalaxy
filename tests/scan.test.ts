import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchScan, getContributors, getWeeklyCommits, mapContributors, mapLanguages, mapParticipation, mapReleases, parseLastPage } from "@/lib/github/client";
import { activityPulse, formatPct, languageShares } from "@/components/explorer/PlanetScan";

const link = (last: number) =>
  `<https://api.github.com/repositories/1/contributors?per_page=1&page=2>; rel="next", <https://api.github.com/repositories/1/contributors?per_page=1&page=${last}>; rel="last"`;

describe("parseLastPage", () => {
  it("handles none, single page, multi page and malformed headers", () => {
    expect(parseLastPage(null)).toBeNull();
    expect(parseLastPage('<https://api.github.com/x?page=1>; rel="prev"')).toBeNull(); // no rel="last" = single page
    expect(parseLastPage(link(345))).toBe(345);
    expect(parseLastPage("garbage")).toBeNull();
    expect(parseLastPage('<not a url>; rel="last"')).toBeNull();
    expect(parseLastPage('<https://api.github.com/x?page=abc>; rel="last"')).toBeNull();
  });
});

describe("mappers", () => {
  it("drops invalid contributors and never trusts avatar hosts or link schemes", () => {
    const out = mapContributors([
      { login: "ada", avatar_url: "https://avatars.githubusercontent.com/u/1?v=4", html_url: "https://github.com/ada", contributions: 9 },
      { login: "eve", avatar_url: "https://evil.example/x.png", html_url: "javascript:alert(1)", contributions: 2 },
      { avatar_url: "https://avatars.githubusercontent.com/u/2", contributions: 1 },
    ]);
    expect(out).toEqual([
      { login: "ada", avatarUrl: "https://avatars.githubusercontent.com/u/1?v=4", htmlUrl: "https://github.com/ada", contributions: 9 },
      { login: "eve", avatarUrl: "", htmlUrl: "https://github.com/eve", contributions: 2 },
    ]);
    expect(mapContributors({ message: "nope" })).toEqual([]);
  });

  it("validates participation shape", () => {
    expect(mapParticipation({ all: Array(52).fill(1) })).toHaveLength(52);
    expect(mapParticipation({ all: [1, 2] })).toBeNull();
    expect(mapParticipation({})).toBeNull();
  });

  it("sorts languages by bytes and drops empties", () => {
    expect(mapLanguages({ CSS: 10, Rust: 500, Shell: 0 })).toEqual([{ name: "Rust", bytes: 500 }, { name: "CSS", bytes: 10 }]);
    expect(mapLanguages(null)).toEqual([]);
  });

  it("maps releases newest first, skipping drafts and undated ones", () => {
    const out = mapReleases([
      { tag_name: "v1", published_at: "2026-01-01T00:00:00Z", html_url: "https://github.com/a/b/releases/tag/v1" },
      { tag_name: "v3", draft: true, published_at: null, html_url: "https://github.com/a/b/releases/tag/v3" },
      { tag_name: "v2", name: "  ", published_at: "2026-06-01T00:00:00Z", html_url: "https://github.com/a/b/releases/tag/v2" },
      { tag_name: "bad", published_at: "2026-07-01T00:00:00Z", html_url: "javascript:x" },
    ]);
    expect(out.map((r) => r.tag)).toEqual(["v2", "v1"]);
    expect(out[0].name).toBeNull();
  });
});

describe("fetchers", () => {
  afterEach(() => vi.unstubAllGlobals());
  const stub = (route: (url: string) => Response) => vi.stubGlobal("fetch", vi.fn(async (url: string) => route(url)));
  const json = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), { status: 200, ...init });

  it("202 from stats means 'still computing', not an error", async () => {
    stub(() => new Response(null, { status: 202 }));
    expect(await getWeeklyCommits("a", "b")).toBeNull();
  });

  it("counts contributors from the Link header, or the items when there is one page", async () => {
    const people = Array.from({ length: 12 }, (_, i) => ({ login: `u${i}`, avatar_url: "https://avatars.githubusercontent.com/u/1", contributions: 1 }));
    stub((url) => json(url.includes("per_page=1&") || url.endsWith("per_page=1") ? people.slice(0, 1) : people, { headers: { link: link(731) } }));
    expect(await getContributors("a", "b")).toMatchObject({ count: 731, top: { length: 12 } });
    stub(() => json(people.slice(0, 3)));
    expect((await getContributors("a", "b")).count).toBe(3);
    stub(() => new Response('{"message":"The history or contributor list is too large to list contributors for this repository via the API."}', { status: 403 }));
    expect(await getContributors("a", "b")).toEqual({ count: null, top: [] });
  });

  it("marks failed parts as partial and keeps the rest", async () => {
    stub((url) => (url.includes("/releases") ? new Response("boom", { status: 500 }) : url.includes("/languages") ? json({ Go: 5 }) : url.includes("/stats") ? new Response(null, { status: 202 }) : json([])));
    const scan = await fetchScan("a", "b");
    expect(scan).toMatchObject({ partial: true, releases: [], weeklyCommits: null, languages: [{ name: "Go", bytes: 5 }], contributorsCount: 0 });
  });

  it("throws not_found for a missing repo and rate_limited when everything is limited", async () => {
    stub(() => new Response("{}", { status: 404 }));
    await expect(fetchScan("a", "b")).rejects.toMatchObject({ kind: "not_found" });
    stub(() => new Response("{}", { status: 403, headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1800000000" } }));
    await expect(fetchScan("a", "b")).rejects.toMatchObject({ kind: "rate_limited", resetAt: new Date(1_800_000_000_000).toISOString() });
  });
});

describe("panel math", () => {
  it("compares the last 12 weeks with the 12 before", () => {
    const weekly = [...Array(28).fill(0), ...Array(12).fill(1), ...Array(12).fill(3)];
    expect(activityPulse(weekly)).toEqual({ last12: 36, prior12: 12, total: 48, max: 3 });
    expect(activityPulse(Array(52).fill(0)).max).toBe(1); // no divide-by-zero
  });

  it("folds the long tail into Other and sums to 100%", () => {
    const langs = ["A", "B", "C", "D", "E", "F", "G", "H"].map((name, i) => ({ name, bytes: 100 - i * 10 }));
    const shares = languageShares(langs);
    expect(shares.map((s) => s.name)).toEqual(["A", "B", "C", "D", "E", "F", "Other"]);
    expect(shares.reduce((a, s) => a + s.pct, 0)).toBeCloseTo(100);
    expect(languageShares([])).toEqual([]);
    expect(formatPct(0.04)).toBe("<0.1%");
    expect(formatPct(42.123)).toBe("42.1%");
  });
});
