import { describe, expect, it } from "vitest";
import { DEFAULT_SHIP, flightOf, getShip, SHIPS } from "@/lib/ships";

describe("ship catalog", () => {
  it("has six ships with unique ids, including the default", () => {
    expect(SHIPS).toHaveLength(6);
    expect(new Set(SHIPS.map((s) => s.id)).size).toBe(SHIPS.length);
    expect(SHIPS.some((s) => s.id === DEFAULT_SHIP)).toBe(true);
  });

  it("keeps stats in 1–5 and flight within the safe caps", () => {
    for (const s of SHIPS) {
      for (const v of Object.values(s.stats)) expect(v >= 1 && v <= 5 && Number.isInteger(v)).toBe(true);
      const f = flightOf(s.stats);
      expect(f.cruise).toBeGreaterThanOrEqual(22);
      expect(f.cruise).toBeLessThanOrEqual(34);
      expect(f.boost).toBeGreaterThanOrEqual(55);
      expect(f.boost).toBeLessThanOrEqual(80);
      expect(f.turn).toBeGreaterThanOrEqual(1.2);
      expect(f.turn).toBeLessThanOrEqual(1.9);
      expect(s.exhaust.length).toBeGreaterThan(0);
    }
    // Out-of-range input is clamped, never exceeds caps.
    expect(flightOf({ speed: 99, boost: -3, agility: 6 })).toEqual({ cruise: 34, boost: 55, turn: 1.9 });
  });

  it("falls back to the default ship for unknown ids", () => {
    expect(getShip("manta").id).toBe("manta");
    expect(getShip("nope").id).toBe(DEFAULT_SHIP);
    expect(getShip(undefined).id).toBe(DEFAULT_SHIP);
    expect(getShip("toString").id).toBe(DEFAULT_SHIP);
  });
});
