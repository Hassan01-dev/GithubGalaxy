-- CreateTable
CREATE TABLE "RepoScan" (
    "fullName" TEXT NOT NULL,
    "contributorsCount" INTEGER,
    "topContributors" JSONB NOT NULL,
    "weeklyCommits" JSONB,
    "languages" JSONB NOT NULL,
    "releases" JSONB NOT NULL,
    "partial" BOOLEAN NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RepoScan_pkey" PRIMARY KEY ("fullName")
);
