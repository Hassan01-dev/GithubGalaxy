import { describe, expect, it } from "vitest";
import { dateKey, evaluateMission, missionFor, type Mission } from "@/lib/discovery/missions";
import type { VisitFacts } from "@/lib/discovery/achievements";
import { repo } from "./fixtures";

const repos = [
  repo(),
  repo({ id: 2, fullName: "a/py", language: "Python", license: null, topics: ["ml"], stars: 5000, createdAt: "2020-01-01T00:00:00Z" }),
  repo({ id: 3, fullName: "a/go", language: "Go", license: "GPL-3.0", topics: [] }),
];
const regions = [{ slug: "rising", title: "Rising stars", repos }];
const v = (over: Partial<VisitFacts> = {}): VisitFacts => ({
  fullName: "a/x", galaxy: "trending", region: "rising", language: "Rust", license: "MIT", stars: 100, pushedAt: "2026-10-14T00:00:00Z",
  createdAt: "2026-10-01T00:00:00Z", topics: [], at: "2026-10-15T12:00:00", ...over,
});

describe("missions", () => {
  it("is deterministic per (date, galaxy)", () => {
    const a = missionFor("2026-10-15", "trending", repos, regions);
    expect(missionFor("2026-10-15", "trending", [...repos].reverse(), regions)).toEqual(a);
    const days = new Set(Array.from({ length: 20 }, (_, i) => missionFor(`2026-10-${String(i + 1).padStart(2, "0")}`, "trending", repos, regions)!.id.split(":").slice(2).join(":")));
    expect(days.size).toBeGreaterThan(1);
  });

  it("only offers missions some repo can satisfy", () => {
    for (let d = 1; d <= 28; d++) {
      const m = missionFor(`2026-11-${String(d).padStart(2, "0")}`, "ai", repos, regions)!;
      if (m.kind === "language-license") expect(m.params.language).toBe("Rust"); // Python has no license, GPL isn't permissive
      if (m.kind === "topic") expect(["cli", "space", "ml"]).toContain(m.params.topic);
      // A visit to some real repo in the set, on that day, must be able to count.
      const visits = repos.map((r) => v({ ...r, galaxy: "ai", region: "rising", at: `2026-11-${String(d).padStart(2, "0")}T12:00:00`, pushedAt: `2026-11-${String(d).padStart(2, "0")}T00:00:00Z` }));
      if (m.kind !== "new") expect(evaluateMission(m, visits).progress).toBeGreaterThan(0);
    }
    expect(missionFor("2026-10-15", "trending", [], regions)).toBeNull();
    // Regions with fewer than 3 planets can't host a "visit 3" mission.
    const tiny = [repo({ license: null, topics: [], stars: 9000, createdAt: "2000-01-01T00:00:00Z" })];
    for (let d = 1; d <= 9; d++) expect(missionFor(`2026-10-0${d}`, "x", tiny, [{ slug: "r", title: "R", repos: tiny }])).toBeNull();
  });

  it("never counts missing data as success", () => {
    const m: Mission = { id: "m", dateKey: "2026-10-15", galaxy: "trending", title: "", rule: "", target: 1, kind: "language-license", params: { language: "Rust" } };
    expect(evaluateMission(m, [v({ license: null })]).done).toBe(false);
    expect(evaluateMission(m, [v({ license: "MIT" })]).done).toBe(true);
    // Wrong day or galaxy doesn't count.
    expect(evaluateMission(m, [v({ at: "2026-10-14T12:00:00" })]).done).toBe(false);
    expect(evaluateMission(m, [v({ galaxy: "ai" })]).done).toBe(false);
  });

  it("counts distinct planets toward the target", () => {
    const m: Mission = { id: "m", dateKey: "2026-10-15", galaxy: "trending", title: "", rule: "", target: 3, kind: "region", params: { region: "rising" } };
    expect(evaluateMission(m, [v(), v(), v({ fullName: "a/y" })])).toEqual({ done: false, progress: 2, target: 3 });
    expect(evaluateMission(m, [v(), v({ fullName: "a/y" }), v({ fullName: "a/z" }), v({ fullName: "a/w" })])).toEqual({ done: true, progress: 3, target: 3 });
  });

  it("formats local date keys", () => expect(dateKey(new Date(2026, 0, 5))).toBe("2026-01-05"));
});
