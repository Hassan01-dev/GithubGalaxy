import { beforeEach, describe, expect, it } from "vitest";
import { explorerLog, mergeLogs, parseLog } from "@/lib/storage/log";
import { favorites } from "@/lib/storage/favorites";
import { settings } from "@/lib/storage/settings";
import { exportProgress, importProgress, MAX_BACKUP_BYTES } from "@/lib/storage/progress";
import { repo } from "./fixtures";

beforeEach(() => {
  localStorage.clear();
  explorerLog._reset();
  favorites._reset();
});

describe("progress backup", () => {
  it("round-trips into a fresh browser", () => {
    explorerLog.visit(repo(), "trending", "rising");
    explorerLog.completeJourney("j");
    favorites.toggle(repo());
    settings.set({ ship: "comet" });
    const text = exportProgress();
    localStorage.clear();
    explorerLog._reset();
    favorites._reset();
    settings.set({ ship: "scout" });
    const r = importProgress(text);
    expect(r.ok).toBe(true);
    expect(explorerLog.get().visits.map((v) => v.fullName)).toEqual(["acme/rocket"]);
    expect(explorerLog.get().journeysCompleted).toEqual(["j"]);
    expect(favorites.has("acme/rocket")).toBe(true);
    expect(settings.get().ship).toBe("comet");
  });

  it("merges instead of overwriting", () => {
    explorerLog.visit(repo({ fullName: "a/a" }), "trending", "rising");
    explorerLog.addDistance(50);
    explorerLog._flush();
    const backup = JSON.parse(exportProgress());
    backup.log.visits[0].fullName = "b/b";
    backup.log.distanceFlown = 10;
    backup.log.firstVisitAt = "2020-01-01T00:00:00.000Z";
    backup.log.missionsCompleted = [{ dateKey: "2026-01-01", missionId: "m" }];
    const r = importProgress(JSON.stringify(backup));
    expect(r).toMatchObject({ ok: true });
    const l = explorerLog.get();
    expect(l.visits.map((v) => v.fullName).sort()).toEqual(["a/a", "b/b"]);
    expect(l.distanceFlown).toBe(50);
    expect(l.firstVisitAt).toBe("2020-01-01T00:00:00.000Z");
    expect(l.missionsCompleted).toHaveLength(1);
    expect(new Set(l.achievements.map((a) => a.id)).size).toBe(l.achievements.length);
  });

  it("rejects malformed input without touching storage", () => {
    explorerLog.visit(repo(), "trending", "rising");
    const before = JSON.stringify(explorerLog.get());
    for (const bad of ["{oops", "null", "[]", JSON.stringify({ app: "x", version: 1 }), JSON.stringify({ app: "open-source-galaxy", version: 1, exportedAt: "", log: { visits: [{ fullName: "<script>" }] } })]) {
      expect(importProgress(bad).ok).toBe(false);
    }
    const good = JSON.parse(exportProgress());
    expect(importProgress(JSON.stringify({ ...good, favorites: { repos: "nope" } })).ok).toBe(false);
    expect(importProgress(JSON.stringify({ ...good, settings: { ship: 42 } })).ok).toBe(false);
    expect(JSON.stringify(explorerLog.get())).toBe(before);
  });

  it("rejects oversize files", () => {
    expect(importProgress(" ".repeat(MAX_BACKUP_BYTES + 1))).toMatchObject({ ok: false, error: expect.stringMatching(/too large/) });
  });

  it("merge keeps the newest visit per repo and earliest achievement date", () => {
    const base = parseLog({ visits: [], distanceFlown: 0, journeysCompleted: [], achievements: [], missionsCompleted: [] })!;
    const visit = { fullName: "a/a", galaxy: "g", region: "r", language: null, license: null, stars: 1, pushedAt: "", createdAt: "", topics: [] };
    const m = mergeLogs(
      { ...base, visits: [{ ...visit, at: "2026-01-02" }], achievements: [{ id: "x", at: "2026-01-05" }], sessions: 3 },
      { ...base, visits: [{ ...visit, galaxy: "h", at: "2026-01-01" }], achievements: [{ id: "x", at: "2026-01-01" }], sessions: 5 },
    );
    expect(m.visits).toEqual([{ ...visit, at: "2026-01-02" }]);
    expect(m.achievements).toEqual([{ id: "x", at: "2026-01-01" }]);
    expect(m.sessions).toBe(5);
  });
});
