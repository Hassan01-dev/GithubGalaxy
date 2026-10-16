import { db } from "@/lib/db";
import type { Repository } from "@/types";

const DAY = 86_400_000;
const today = () => new Date(new Date().toISOString().slice(0, 10));

/**
 * Upserts repo metadata (release fields untouched) and records today's star count for each.
 * One bulk statement each: per-row upserts cost a network round trip apiece, which a remote database can't afford.
 */
export async function persistRepos(repos: Repository[]) {
  // ON CONFLICT can't touch the same row twice in one statement.
  const unique = [...new Map(repos.map((r) => [r.id, r])).values()];
  if (!unique.length) return;
  const rows = JSON.stringify(
    unique.map((r) => ({
      id: r.id, fullName: r.fullName, owner: r.owner, name: r.name, description: r.description, htmlUrl: r.htmlUrl,
      homepage: r.homepage, stars: r.stars, forks: r.forks, openIssues: r.openIssues, language: r.language, topics: r.topics,
      license: r.license, archived: r.archived, defaultBranch: r.defaultBranch, createdAt: r.createdAt, updatedAt: r.updatedAt,
      pushedAt: r.pushedAt, fetchedAt: r.fetchedAt,
    })),
  );
  await db.$executeRaw`
    INSERT INTO "Repository" ("id","fullName","owner","name","description","htmlUrl","homepage","stars","forks","openIssues",
      "language","topics","license","archived","defaultBranch","createdAt","updatedAt","pushedAt","fetchedAt")
    SELECT x.id, x."fullName", x.owner, x.name, x.description, x."htmlUrl", x.homepage, x.stars, x.forks, x."openIssues",
      x.language, ARRAY(SELECT jsonb_array_elements_text(x.topics)), x.license, x.archived, x."defaultBranch",
      -- Columns are UTC timestamps without zone; convert explicitly rather than via the session TimeZone.
      x."createdAt" AT TIME ZONE 'UTC', x."updatedAt" AT TIME ZONE 'UTC', x."pushedAt" AT TIME ZONE 'UTC', x."fetchedAt" AT TIME ZONE 'UTC'
    FROM jsonb_to_recordset(${rows}::jsonb) AS x(id int, "fullName" text, owner text, name text, description text, "htmlUrl" text,
      homepage text, stars int, forks int, "openIssues" int, language text, topics jsonb, license text, archived boolean,
      "defaultBranch" text, "createdAt" timestamptz, "updatedAt" timestamptz, "pushedAt" timestamptz, "fetchedAt" timestamptz)
    ON CONFLICT ("id") DO UPDATE SET
      "fullName" = EXCLUDED."fullName", "owner" = EXCLUDED."owner", "name" = EXCLUDED."name", "description" = EXCLUDED."description",
      "htmlUrl" = EXCLUDED."htmlUrl", "homepage" = EXCLUDED."homepage", "stars" = EXCLUDED."stars", "forks" = EXCLUDED."forks",
      "openIssues" = EXCLUDED."openIssues", "language" = EXCLUDED."language", "topics" = EXCLUDED."topics", "license" = EXCLUDED."license",
      "archived" = EXCLUDED."archived", "defaultBranch" = EXCLUDED."defaultBranch", "createdAt" = EXCLUDED."createdAt",
      "updatedAt" = EXCLUDED."updatedAt", "pushedAt" = EXCLUDED."pushedAt", "fetchedAt" = EXCLUDED."fetchedAt"`;
  const day = today();
  await db.starSnapshot.createMany({ data: unique.map((r) => ({ repoId: r.id, day, stars: r.stars })), skipDuplicates: true });
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
