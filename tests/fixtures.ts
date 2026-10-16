import type { Repository } from "@/types";

export const repo = (over: Partial<Repository> = {}): Repository => ({
  id: 1, fullName: "acme/rocket", owner: "acme", name: "rocket", description: "Fast rockets", htmlUrl: "https://github.com/acme/rocket",
  homepage: null, stars: 1200, forks: 30, openIssues: 4, language: "Rust", topics: ["cli", "space"], license: "MIT", archived: false,
  defaultBranch: "main", createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-14T00:00:00Z", pushedAt: "2026-10-14T00:00:00Z",
  latestRelease: null, fetchedAt: "2026-10-15T00:00:00Z", starGrowth: null, ...over,
});
