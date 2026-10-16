import { describe, expect, it } from "vitest";
import { FLIGHT_XP_CAP, RANKS, scoreOf } from "@/lib/discovery/score";

const v = (fullName: string, galaxy = "trending", language: string | null = "Rust") => ({
  fullName, galaxy, region: "rising", language, license: "MIT", stars: 1, pushedAt: "", createdAt: "", topics: [], at: "2026-10-15T00:00:00Z",
});
const log = (over = {}) => ({ visits: [], distanceFlown: 0, journeysCompleted: [], achievements: [], missionsCompleted: [], ...over });

describe("score", () => {
  it("is zero Cadet for an empty log", () => {
    expect(scoreOf(log())).toMatchObject({ xp: 0, rank: { id: "cadet" }, next: { id: "explorer" }, progress: 0 });
  });

  it("derives XP from distinct facts", () => {
    const s = scoreOf(log({
      visits: [v("a/a"), v("b/b", "ai", "Go"), v("c/c", "ai", null)],
      achievements: [{ id: "x", at: "" }, { id: "y", at: "" }],
      missionsCompleted: [{ dateKey: "d", missionId: "m" }],
      journeysCompleted: ["j"],
      distanceFlown: 1234,
    }));
    // 3 planets, 2 languages, 2 galaxies, 2 achievements, 1 mission, 1 journey, 12 flight
    expect(s.xp).toBe(30 + 50 + 100 + 200 + 75 + 150 + 12);
    expect(s.breakdown.reduce((n, b) => n + b.xp, 0)).toBe(s.xp);
  });

  it("caps flight XP", () => {
    expect(scoreOf(log({ distanceFlown: 1e9 })).xp).toBe(FLIGHT_XP_CAP);
  });

  it("hits thresholds exactly and tops out at Legend", () => {
    const at = (xp: number) => scoreOf(log({ achievements: Array.from({ length: xp / 100 }, (_, i) => ({ id: `a${i}`, at: "" })) }));
    expect(at(400)).toMatchObject({ rank: { id: "explorer" }, progress: 0.75 });
    expect(at(500)).toMatchObject({ rank: { id: "navigator" }, progress: 0 });
    expect(at(30_000)).toMatchObject({ rank: { id: "legend" }, next: null, progress: 1 });
    expect(RANKS.map((r) => r.min)).toEqual([...RANKS.map((r) => r.min)].sort((a, b) => a - b));
  });
});
