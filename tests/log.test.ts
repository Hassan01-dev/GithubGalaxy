import { beforeEach, describe, expect, it } from "vitest";
import { explorerLog } from "@/lib/storage/log";
import { toast } from "@/components/explorer/Toasts";
import { repo } from "./fixtures";

beforeEach(() => {
  localStorage.clear();
  explorerLog._reset();
  toast.get().forEach((t) => toast.dismiss(t.id));
});

describe("explorer log", () => {
  it("persists across a reload and announces achievements once", () => {
    explorerLog.visit(repo(), "trending", "rising");
    explorerLog._reset();
    expect(explorerLog.get().visits.map((v) => v.fullName)).toEqual(["acme/rocket"]);
    expect(explorerLog.get().achievements.map((a) => a.id)).toContain("first-contact");
    expect(toast.get().filter((t) => t.title === "First contact")).toHaveLength(1);
    explorerLog.visit(repo(), "trending", "rising");
    expect(toast.get().filter((t) => t.title === "First contact")).toHaveLength(1);
  });

  it("dedupes per repo (latest first) and caps visits", () => {
    explorerLog.visit(repo(), "trending", "rising");
    explorerLog.visit(repo({ fullName: "b/b" }), "trending", "rising");
    explorerLog.visit(repo({ stars: 9 }), "ai", "rag");
    const { visits } = explorerLog.get();
    expect(visits.map((v) => [v.fullName, v.galaxy])).toEqual([["acme/rocket", "ai"], ["b/b", "trending"]]);
    for (let i = 0; i < 1010; i++) explorerLog.visit(repo({ fullName: `o/r${i}`, topics: Array.from({ length: 20 }, (_, j) => `t${j}`) }), "trending", "rising");
    expect(explorerLog.get().visits).toHaveLength(1000);
    expect(explorerLog.get().visits[0].topics).toHaveLength(10);
    explorerLog._reset();
    expect(explorerLog.get().visits).toHaveLength(1000); // still valid after the round-trip
  });

  it("recovers from corrupt stored data", () => {
    localStorage.setItem("osg:log:v1", "{oops");
    expect(explorerLog.get().visits).toEqual([]);
    explorerLog._reset();
    localStorage.setItem("osg:log:v1", JSON.stringify({ visits: [{ fullName: "<script>" }], distanceFlown: -1 }));
    expect(explorerLog.get().distanceFlown).toBe(0);
  });

  it("buffers distance, ignores junk, and records journeys once", () => {
    explorerLog.addDistance(600);
    explorerLog.addDistance(NaN);
    explorerLog.addDistance(-5);
    explorerLog.addDistance(500);
    explorerLog._flush();
    expect(explorerLog.get().distanceFlown).toBe(1100);
    expect(explorerLog.get().achievements.map((a) => a.id)).toContain("pilot");
    explorerLog.completeJourney("j");
    explorerLog.completeJourney("j");
    expect(explorerLog.get().journeysCompleted).toEqual(["j"]);
    explorerLog.reset();
    expect(explorerLog.get().visits).toEqual([]);
  });

  it("completes the tracked mission once", () => {
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    explorerLog.trackMission({ id: "m1", dateKey: key, galaxy: "trending", title: "Find Rust", rule: "", target: 1, kind: "language-license", params: { language: "Rust" } });
    explorerLog.visit(repo({ license: null }), "trending", "rising");
    expect(explorerLog.isMissionDone("m1")).toBe(false);
    explorerLog.visit(repo({ fullName: "b/b" }), "trending", "rising");
    expect(explorerLog.isMissionDone("m1")).toBe(true);
    explorerLog.visit(repo({ fullName: "c/c" }), "trending", "rising");
    expect(toast.get().filter((t) => t.tone === "mission")).toHaveLength(1);
  });
});

describe("sessions and rank", () => {
  it("loads a log stored before sessions existed", () => {
    localStorage.setItem("osg:log:v1", JSON.stringify({ visits: [], distanceFlown: 42, journeysCompleted: ["j"], achievements: [], missionsCompleted: [] }));
    expect(explorerLog.get()).toMatchObject({ distanceFlown: 42, journeysCompleted: ["j"], sessions: 0, firstVisitAt: null, lastVisitAt: null });
  });

  it("counts a new session only after 30 idle minutes", () => {
    const t0 = Date.parse("2026-10-15T10:00:00Z");
    expect(explorerLog.touchSession(t0)).toEqual({ returning: false, awayMs: 0 });
    expect(explorerLog.touchSession(t0 + 10 * 60_000)).toMatchObject({ returning: false });
    expect(explorerLog.get().sessions).toBe(1);
    expect(explorerLog.touchSession(t0 + 50 * 60_000)).toEqual({ returning: true, awayMs: 40 * 60_000 });
    explorerLog._reset();
    expect(explorerLog.get()).toMatchObject({ sessions: 2, firstVisitAt: new Date(t0).toISOString(), previousVisitAt: new Date(t0 + 10 * 60_000).toISOString() });
  });

  it("announces a rank-up once", () => {
    explorerLog.visit(repo(), "trending", "rising"); // 10 + 25 + 50 + 100 (first contact) = Explorer
    explorerLog.visit(repo({ fullName: "b/b" }), "trending", "rising");
    expect(toast.get().filter((t) => t.title === "You are now an Explorer")).toHaveLength(1);
  });
});
