import { describe, expect, it } from "vitest";
import { clusterCentres, layoutGalaxy, layoutKind, planetRadius, regionAnchors, MAX_RADIUS, MIN_RADIUS } from "@/lib/galaxy/layout";
import type { GalaxyData } from "@/types";
import { repo } from "./fixtures";

const galaxy = (names: string[]): GalaxyData => ({
  slug: "trending", source: "seed", fetchedAt: "",
  regions: [{ slug: "rising", title: "", definition: "", repos: names.map((n) => { const i = Number(n.split("owner")[1].split("/")[0]); return repo({ id: i, fullName: n, stars: 10 ** (i % 7) }); }) }],
});
const names = Array.from({ length: 120 }, (_, i) => `owner${i}/repo${i}`);

describe("planetRadius", () => {
  it("is bounded and monotonic, including extremes", () => {
    expect(planetRadius(0)).toBe(MIN_RADIUS);
    expect(planetRadius(-5)).toBe(MIN_RADIUS);
    expect(planetRadius(1e9)).toBe(MAX_RADIUS);
    expect(planetRadius(1_000_000)).toBeCloseTo(MAX_RADIUS);
    expect(planetRadius(100)).toBeLessThan(planetRadius(10_000));
    // A million-star repo is at most 5x a 1-star one.
    expect(planetRadius(1_000_000) / planetRadius(1)).toBeLessThanOrEqual(5);
  });
});

describe("layoutGalaxy", () => {
  it("is deterministic across runs", () => {
    expect(layoutGalaxy(galaxy(names))).toEqual(layoutGalaxy(galaxy(names)));
  });

  it("does not depend on input order", () => {
    const pos = (g: GalaxyData) => Object.fromEntries(layoutGalaxy(g).map((p) => [p.repo.fullName, p.position.map((v) => v.toFixed(6))]));
    expect(pos(galaxy([...names].reverse()))).toEqual(pos(galaxy(names)));
  });

  it("keeps planets from overlapping", () => {
    const ps = layoutGalaxy(galaxy(names));
    let worst = Infinity;
    for (let i = 0; i < ps.length; i++)
      for (let j = i + 1; j < ps.length; j++) {
        const d = Math.hypot(...ps[i].position.map((v, k) => v - ps[j].position[k]));
        worst = Math.min(worst, d - ps[i].radius - ps[j].radius);
      }
    expect(worst).toBeGreaterThan(0);
  });
});

describe("clustered layout", () => {
  const data: GalaxyData = {
    slug: "ai", source: "seed", fetchedAt: "",
    regions: ["a", "b", "c"].map((slug, ri) => ({ slug, title: slug, definition: "", repos: names.slice(ri * 30, ri * 30 + 30).map((n, i) => repo({ id: ri * 100 + i, fullName: n })) })),
  };

  it("keeps every planet closer to its own system than to any other", () => {
    const centres = Object.fromEntries(clusterCentres(data).map((c, i) => [data.regions[i].slug, c.centre]));
    for (const p of layoutGalaxy(data, "clusters")) {
      const d = (c: number[]) => Math.hypot(...p.position.map((v, k) => v - c[k]));
      const own = d(centres[p.region]);
      for (const [slug, c] of Object.entries(centres)) if (slug !== p.region) expect(own).toBeLessThan(d(c));
    }
  });

  it("anchors a label for every region", () => {
    expect(Object.keys(regionAnchors(data, "clusters"))).toEqual(["a", "b", "c"]);
  });
});

describe("constellation layout", () => {
  const data: GalaxyData = {
    slug: "constellations", source: "seed", fetchedAt: "",
    regions: ["first", "web", "py"].map((slug, ri) => ({ slug, title: slug, definition: "", repos: names.slice(ri * 8, ri * 8 + 8).map((n, i) => repo({ id: ri * 100 + i, fullName: n, stars: 10 ** (i % 7) })) })),
  };

  it("is deterministic", () => {
    expect(layoutGalaxy(data, "constellation")).toEqual(layoutGalaxy(data, "constellation"));
  });

  it("keeps each route in order: every stop is further from the first stop than the one before", () => {
    const ps = layoutGalaxy(data, "constellation");
    for (const region of data.regions) {
      const route = region.repos.map((r) => ps.find((p) => p.repo.fullName === r.fullName)!.position);
      const d = route.map((p) => Math.hypot(...p.map((v, k) => v - route[0][k])));
      for (let k = 1; k < d.length; k++) expect(d[k]).toBeGreaterThan(d[k - 1]);
    }
  });

  it("maps the theme shape and anchors every journey", () => {
    expect(layoutKind("constellation")).toBe("constellation");
    expect(layoutKind("ring")).toBe("clusters");
    expect(Object.keys(regionAnchors(data, "constellation"))).toEqual(["first", "web", "py"]);
    expect(clusterCentres(data, "constellation")).toHaveLength(3);
  });
});
