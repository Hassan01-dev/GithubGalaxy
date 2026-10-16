import { expect, it } from "vitest";
import { signals } from "@/lib/discovery/signals";
import { repo } from "./fixtures";

const now = Date.parse("2026-10-15T00:00:00Z");
const texts = (r = repo()) => signals(r, now).map((s) => s.text);

it("only states facts present in the data", () => {
  expect(texts()).toContain("Permissive license (MIT)");
  expect(texts()).toContain("Code pushed yesterday");
  expect(texts().some((t) => t.includes("release"))).toBe(false);
  expect(texts().some((t) => t.includes("stars since"))).toBe(false);
});

it("flags missing license and archive as cautions", () => {
  const s = signals(repo({ license: null, archived: true }), now);
  expect(s.filter((x) => x.tone === "caution").map((x) => x.text)).toEqual([
    "No license detected; reuse may not be permitted",
    "Archived by its owner (read-only)",
  ]);
});

it("reports measured growth only when positive", () => {
  expect(texts(repo({ starGrowth: { gained: 250, since: "2026-10-10" } }))[0]).toMatch(/^\+250 stars since 2026-10-10/);
  expect(texts(repo({ starGrowth: { gained: 0, since: "2026-10-10" } })).some((t) => t.includes("stars since"))).toBe(false);
});
