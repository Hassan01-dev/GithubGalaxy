import { db } from "@/lib/db";
import type { Repository } from "@/types";

const DAY = 86_400_000;
const today = () => new Date(new Date().toISOString().slice(0, 10));

/** Upserts repo metadata (release fields untouched) and records today's star count for each. */
export async function persistRepos(repos: Repository[]) {
  if (!repos.length) return;
  const day = today();
  await db.$transaction([
    ...repos.map((r) => {
      const row = {
        fullName: r.fullName,
        owner: r.owner,
        name: r.name,
        description: r.description,
        htmlUrl: r.htmlUrl,
        homepage: r.homepage,
        stars: r.stars,
        forks: r.forks,
        openIssues: r.openIssues,
        language: r.language,
        topics: r.topics,
        license: r.license,
        archived: r.archived,
        defaultBranch: r.defaultBranch,
        createdAt: new Date(r.createdAt),
        updatedAt: new Date(r.updatedAt),
        pushedAt: new Date(r.pushedAt),
        fetchedAt: new Date(r.fetchedAt),
      };
      return db.repository.upsert({ where: { id: r.id }, create: { id: r.id, ...row }, update: row });
    }),
    db.starSnapshot.createMany({ data: repos.map((r) => ({ repoId: r.id, day, stars: r.stars })), skipDuplicates: true }),
  ]);
}

/** Rows plus their oldest snapshot from the last 7 days, used to measure growth. */
export function withGrowth(ids: number[]) {
  return db.repository.findMany({
    where: { id: { in: ids } },
    include: { snapshots: { where: { day: { gte: new Date(Date.now() - 7 * DAY) } }, orderBy: { day: "asc" }, take: 1 } },
  });
}

type Row = Awaited<ReturnType<typeof withGrowth>>[number];

export function rowToRepo(r: Row): Repository {
  const snap = r.snapshots?.[0];
  // Growth only counts when the earlier snapshot is from a previous day.
  const growth = snap && snap.day < today() ? { gained: r.stars - snap.stars, since: snap.day.toISOString().slice(0, 10) } : null;
  return {
    id: r.id,
    fullName: r.fullName,
    owner: r.owner,
    name: r.name,
    description: r.description,
    htmlUrl: r.htmlUrl,
    homepage: r.homepage,
    stars: r.stars,
    forks: r.forks,
    openIssues: r.openIssues,
    language: r.language,
    topics: r.topics,
    license: r.license,
    archived: r.archived,
    defaultBranch: r.defaultBranch,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    pushedAt: r.pushedAt.toISOString(),
    latestRelease: r.latestRelease && r.latestReleaseAt ? { tag: r.latestRelease, publishedAt: r.latestReleaseAt.toISOString() } : null,
    fetchedAt: r.fetchedAt.toISOString(),
    starGrowth: growth,
  };
}
