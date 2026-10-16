import { describe, expect, it } from "vitest";
import seed from "@/data/seed/constellations.json";
import { JOURNEYS, getJourney } from "@/lib/discovery/journeys";
import { getGalaxy } from "@/lib/galaxy/galaxies";

describe("journeys", () => {
  it("have unique slugs, 5–8 stops, and a note on every stop", () => {
    expect(new Set(JOURNEYS.map((j) => j.slug)).size).toBe(JOURNEYS.length);
    for (const j of JOURNEYS) {
      expect(j.stops.length).toBeGreaterThanOrEqual(5);
      expect(j.stops.length).toBeLessThanOrEqual(8);
      for (const s of j.stops) expect(s.note.trim().length).toBeGreaterThan(20);
    }
    expect(getJourney(JOURNEYS[0].slug)).toBe(JOURNEYS[0]);
    expect(getJourney("nope")).toBeUndefined();
  });

  it("never share a repo: the galaxy keeps a repo only in its first region", () => {
    const all = JOURNEYS.flatMap((j) => j.stops.map((s) => s.fullName.toLowerCase()));
    expect(new Set(all).size).toBe(all.length);
  });

  it("are the constellations galaxy's regions, in route order", () => {
    const g = getGalaxy("constellations")!;
    expect(g.available).toBe(true);
    expect(g.regions.map((r) => r.slug)).toEqual(JOURNEYS.map((j) => j.slug));
    expect(g.regions[0].query(new Date())).toContain(`repo:${JOURNEYS[0].stops[0].fullName}`);
  });

  // Fails when a repo is renamed or removed: fix the fullName (GitHub search 422s on stale names).
  it("are fully present, in order, in the committed seed", () => {
    for (const j of JOURNEYS) {
      const region = seed.regions.find((r) => r.slug === j.slug)!;
      expect(region.repos.map((r) => r.fullName)).toEqual(j.stops.map((s) => s.fullName));
    }
  });
});
