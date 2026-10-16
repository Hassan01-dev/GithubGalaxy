-- CreateTable
CREATE TABLE "Repository" (
    "id" INTEGER NOT NULL,
    "fullName" TEXT NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "htmlUrl" TEXT NOT NULL,
    "homepage" TEXT,
    "stars" INTEGER NOT NULL,
    "forks" INTEGER NOT NULL,
    "openIssues" INTEGER NOT NULL,
    "language" TEXT,
    "topics" TEXT[],
    "license" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "defaultBranch" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "pushedAt" TIMESTAMP(3) NOT NULL,
    "latestRelease" TEXT,
    "latestReleaseAt" TIMESTAMP(3),
    "releaseCheckedAt" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Repository_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StarSnapshot" (
    "repoId" INTEGER NOT NULL,
    "day" DATE NOT NULL,
    "stars" INTEGER NOT NULL,

    CONSTRAINT "StarSnapshot_pkey" PRIMARY KEY ("repoId","day")
);

-- CreateTable
CREATE TABLE "RegionFetch" (
    "galaxy" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "repoIds" INTEGER[],
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegionFetch_pkey" PRIMARY KEY ("galaxy","region")
);

-- CreateIndex
CREATE UNIQUE INDEX "Repository_fullName_key" ON "Repository"("fullName");

-- AddForeignKey
ALTER TABLE "StarSnapshot" ADD CONSTRAINT "StarSnapshot_repoId_fkey" FOREIGN KEY ("repoId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
