import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS, facet, filtersFromParams, filtersToParams, matches } from "@/lib/discovery/filters";
import { repo } from "./fixtures";

const now = Date.parse("2026-10-15T00:00:00Z");

describe("matches", () => {
  it("applies each filter", () => {
    const r = repo();
    expect(matches(r, "rising", EMPTY_FILTERS, now)).toBe(true);
    expect(matches(r, "rising", { ...EMPTY_FILTERS, language: "Go" }, now)).toBe(false);
    expect(matches(r, "rising", { ...EMPTY_FILTERS, topic: "cli" }, now)).toBe(true);
    expect(matches(r, "rising", { ...EMPTY_FILTERS, license: "MIT" }, now)).toBe(true);
    expect(matches(r, "rising", { ...EMPTY_FILTERS, minStars: 5000 }, now)).toBe(false);
    expect(matches(r, "rising", { ...EMPTY_FILTERS, updatedWithin: 7 }, now)).toBe(true);
    expect(matches(repo({ pushedAt: "2026-01-01T00:00:00Z" }), "rising", { ...EMPTY_FILTERS, updatedWithin: 30 }, now)).toBe(false);
    expect(matches(r, "rising", { ...EMPTY_FILTERS, region: "frontier" }, now)).toBe(false);
  });
});

describe("URL state", () => {
  it("round-trips", () => {
    const f = { language: "Rust", topic: "cli", license: "MIT", minStars: 100, updatedWithin: 7, region: "rising" };
    expect(filtersFromParams(filtersToParams(f, new URLSearchParams("repo=a/b")))).toEqual(f);
  });
  it("ignores malformed values", () => {
    expect(filtersFromParams(new URLSearchParams("minStars=-4&updated=abc"))).toEqual(EMPTY_FILTERS);
  });
  it("keeps unrelated params", () => {
    expect(filtersToParams(EMPTY_FILTERS, new URLSearchParams("repo=a/b&lang=Go")).toString()).toBe("repo=a%2Fb");
  });
});

it("facet counts most common first", () => {
  const f = facet([repo(), repo({ topics: ["cli"] }), repo({ topics: [] })], (r) => r.topics);
  expect(f).toEqual([{ value: "cli", count: 2 }, { value: "space", count: 1 }]);
});
