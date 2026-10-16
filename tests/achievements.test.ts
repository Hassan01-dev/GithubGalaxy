import { describe, expect, it } from "vitest";
import { evaluateAchievements, type LogFacts, type VisitFacts } from "@/lib/discovery/achievements";

const v = (over: Partial<VisitFacts> = {}): VisitFacts => ({
  fullName: "a/x", galaxy: "trending", region: "rising", language: "Rust", license: null, stars: 5000, pushedAt: "2026-01-01T00:00:00Z",
  createdAt: "2025-01-01T00:00:00Z", topics: [], at: "2026-10-15T12:00:00Z", ...over,
});
const log = (over: Partial<LogFacts> = {}): LogFacts => ({ visits: [], distanceFlown: 0, journeysCompleted: [], achievements: [], ...over });

describe("achievements", () => {
  it("unlocks from honest data only", () => {
    expect(evaluateAchievements(log())).toEqual([]);
    expect(evaluateAchievements(log({ visits: [v()] }))).toEqual(["first-contact"]);
    // No license ≠ permissive.
    const five = (license: string | null) => Array.from({ length: 5 }, (_, i) => v({ fullName: `a/${i}`, license }));
    expect(evaluateAchievements(log({ visits: five(null) }))).not.toContain("licensed");
    expect(evaluateAchievements(log({ visits: five("MIT") }))).toContain("licensed");
  });

  it("gem hunter judges freshness at visit time", () => {
    expect(evaluateAchievements(log({ visits: [v({ stars: 120, pushedAt: "2026-10-10T00:00:00Z" })] }))).toContain("gem-hunter");
    expect(evaluateAchievements(log({ visits: [v({ stars: 120, pushedAt: "2026-09-01T00:00:00Z" })] }))).not.toContain("gem-hunter");
    expect(evaluateAchievements(log({ visits: [v({ stars: 300, pushedAt: "2026-10-14T00:00:00Z" })] }))).not.toContain("gem-hunter");
  });

  it("covers distance, journeys, favorites, galaxies, regions", () => {
    const ids = evaluateAchievements(
      log({ distanceFlown: 12_000, journeysCompleted: ["j"], visits: [v({ region: "a" }), v({ fullName: "a/y", region: "b", galaxy: "ai" }), v({ fullName: "a/z", region: "frontier" })] }),
      { favorites: 5, regionsByGalaxy: { trending: ["a", "frontier"] } },
    );
    expect(ids).toEqual(expect.arrayContaining(["pilot", "long-haul", "navigator", "curator", "two-galaxies", "systems-tour", "frontier-scout"]));
  });

  it("skips already unlocked ones", () => {
    expect(evaluateAchievements(log({ visits: [v()], achievements: [{ id: "first-contact", at: "" }] }))).toEqual([]);
  });
});
