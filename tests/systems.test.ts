import { describe, expect, it } from "vitest";
import { populationLights, pushedRecently, recentActivity, satelliteOrbits } from "@/lib/galaxy/systems";

const now = Date.parse("2026-10-15T12:00:00Z");
const rel = (tag: string, daysAgo: number) => ({ tag, name: null, htmlUrl: "", publishedAt: new Date(now - daysAgo * 86_400_000).toISOString() });

describe("satelliteOrbits", () => {
  it("keeps the last year only, caps at 8, marks the newest, is deterministic", () => {
    const releases = [rel("v10", 1), ...Array.from({ length: 9 }, (_, i) => rel(`v${9 - i}`, 10 + i)), rel("old", 400)];
    const a = satelliteOrbits(releases, now);
    expect(a).toHaveLength(8);
    expect(a.map((o) => o.newest)).toEqual([true, false, false, false, false, false, false, false]);
    expect(a.some((o) => o.tag === "old")).toBe(false);
    expect(satelliteOrbits(releases, now)).toEqual(a);
    expect(satelliteOrbits([rel("old", 400)], now)).toEqual([]);
  });
});

describe("populationLights", () => {
  it("is log-scaled, capped, and empty when unknown", () => {
    expect(populationLights(null)).toBe(0);
    expect(populationLights(0)).toBe(0);
    expect(populationLights(9)).toBe(40);
    expect(populationLights(999)).toBe(120);
    expect(populationLights(1e12)).toBe(400);
  });
});

describe("recentActivity", () => {
  it("compares the last 4 weeks with an even pace", () => {
    expect(recentActivity(null)).toBe(0);
    expect(recentActivity(Array(52).fill(0))).toBe(0);
    expect(recentActivity(Array(52).fill(5))).toBeCloseTo(1 / 3);
    expect(recentActivity([...Array(48).fill(0), 1, 1, 1, 1])).toBe(1);
    expect(recentActivity([...Array(48).fill(3), 0, 0, 0, 0])).toBe(0);
  });
});

describe("pushedRecently", () => {
  it("is true within 24 hours only", () => {
    expect(pushedRecently(new Date(now - 3_600_000).toISOString(), now)).toBe(true);
    expect(pushedRecently(new Date(now - 25 * 3_600_000).toISOString(), now)).toBe(false);
    expect(pushedRecently("garbage", now)).toBe(false);
  });
});
