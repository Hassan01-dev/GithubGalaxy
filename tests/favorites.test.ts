import { beforeEach, describe, expect, it } from "vitest";
import { favorites, parseCollection } from "@/lib/storage/favorites";
import { repo } from "./fixtures";

beforeEach(() => {
  localStorage.clear();
  favorites._reset();
});

describe("favorites", () => {
  it("survives a reload (re-read from storage)", () => {
    favorites.toggle(repo());
    favorites._reset();
    expect(favorites.has("acme/rocket")).toBe(true);
    favorites.toggle(repo());
    favorites._reset();
    expect(favorites.has("acme/rocket")).toBe(false);
  });

  it("recovers from corrupt stored data", () => {
    localStorage.setItem("osg:favorites:v1", "{not json");
    expect(favorites.get().repos).toEqual([]);
    favorites._reset();
    localStorage.setItem("osg:favorites:v1", JSON.stringify({ title: "x", updatedAt: "", repos: [{ fullName: "<script>" }] }));
    expect(favorites.get().repos).toEqual([]);
  });

  it("imports valid collections and rejects malformed ones", () => {
    favorites.toggle(repo());
    const file = JSON.stringify({ title: "Shared", updatedAt: "", repos: [
      { fullName: "acme/rocket", description: null, language: null, stars: 1, savedAt: "" },
      { fullName: "vercel/next.js", description: "React framework", language: "TypeScript", stars: 1, savedAt: "" },
    ] });
    expect(favorites.import(file)).toBe(1);
    expect(favorites.get().repos.map((r) => r.fullName)).toEqual(["acme/rocket", "vercel/next.js"]);
    expect(favorites.import('{"repos": "nope"}')).toBeNull();
    expect(parseCollection("[]")).toBeNull();
  });
});
