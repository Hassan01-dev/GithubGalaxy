import { describe, expect, it } from "vitest";
import { layoutGalaxy, STYLE_COUNT } from "@/lib/galaxy/layout";
import { PLANET_STYLES, planetVariant } from "@/components/scene/planetShader";
import type { GalaxyData } from "@/types";
import { repo } from "./fixtures";

describe("planet styles", () => {
  it("has metadata for every style", () => {
    expect(PLANET_STYLES).toHaveLength(STYLE_COUNT);
  });

  it("mixes every style across a galaxy, deterministically", () => {
    const data: GalaxyData = {
      slug: "trending", source: "seed", fetchedAt: "",
      regions: [{ slug: "rising", title: "", definition: "", repos: Array.from({ length: 300 }, (_, i) => repo({ id: i, fullName: `o${i}/r${i}` })) }],
    };
    const styles = layoutGalaxy(data).map((p) => p.style);
    expect(new Set(styles).size).toBe(STYLE_COUNT);
    expect(layoutGalaxy(data).map((p) => p.style)).toEqual(styles);
  });

  it("derives a stable, bounded variant with rings on a minority", () => {
    const seeds = Array.from({ length: 2000 }, (_, i) => ((i * 2654435761) >>> 0) / 2 ** 32);
    const vs = seeds.map((s, i) => planetVariant(s, i % STYLE_COUNT));
    expect(planetVariant(seeds[7], 4)).toEqual(planetVariant(seeds[7], 4));
    for (const v of vs) {
      expect(v.vec[0]).toBeGreaterThanOrEqual(-1);
      for (const x of v.vec.slice(1)) {
        expect(x).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(1);
      }
    }
    const share = vs.filter((v) => v.ring).length / vs.length;
    expect(share).toBeGreaterThan(0.08);
    expect(share).toBeLessThan(0.25);
  });
});
