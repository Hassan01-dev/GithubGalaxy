import { describe, expect, it } from "vitest";
import { mapRepo, safeUrl, validRepoPart, type RawRepo } from "@/lib/github/client";

const raw: RawRepo = {
  id: 7, full_name: "acme/rocket", name: "rocket", owner: { login: "acme" }, html_url: "https://github.com/acme/rocket",
  stargazers_count: 5, forks_count: 0, open_issues_count: 0, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-02-01T00:00:00Z",
};

describe("mapRepo", () => {
  it("fills missing optional fields with honest nulls", () => {
    const r = mapRepo(raw, "2026-10-15T00:00:00Z");
    expect(r).toMatchObject({ description: null, homepage: null, language: null, topics: [], license: null, latestRelease: null, starGrowth: null });
    expect(r.pushedAt).toBe(raw.updated_at); // falls back when pushed_at is missing
  });

  it("drops NOASSERTION and 'Other' licenses rather than showing them as names", () => {
    expect(mapRepo({ ...raw, license: { spdx_id: "NOASSERTION", name: "Other" } }, "").license).toBeNull();
    expect(mapRepo({ ...raw, license: { spdx_id: "MIT", name: "MIT License" } }, "").license).toBe("MIT");
  });

  it("trims blank descriptions to null", () => {
    expect(mapRepo({ ...raw, description: "   " }, "").description).toBeNull();
  });
});

describe("safeUrl", () => {
  it("only allows http(s)", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("data:text/html,hi")).toBeNull();
    expect(safeUrl("example.com/docs")).toBe("https://example.com/docs");
    expect(safeUrl("")).toBeNull();
  });
});

it("validRepoPart rejects path tricks", () => {
  expect(validRepoPart("next.js")).toBe(true);
  expect(validRepoPart("..")).toBe(false);
  expect(validRepoPart("a/b")).toBe(false);
  expect(validRepoPart("a?b")).toBe(false);
});
