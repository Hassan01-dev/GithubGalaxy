import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PlanetScanPanel } from "@/components/explorer/PlanetScan";
import { RepoDetails } from "@/components/explorer/RepoDetails";
import { Icon } from "@/components/ui/Icon";
import { loadGalaxy } from "@/lib/data/galaxy";
import { loadRepo } from "@/lib/data/repo";
import { DEFAULT_GALAXY, GALAXIES } from "@/lib/galaxy/galaxies";
import { hash, languageColor, planetRadius } from "@/lib/galaxy/layout";
import type { Repository } from "@/types";

export async function generateMetadata({ params }: PageProps<"/repo/[owner]/[name]">): Promise<Metadata> {
  const { owner, name } = await params;
  const r = await loadRepo(owner, name);
  if (r.status !== "ok") return { title: `${owner}/${name}` };
  const d = r.repo.description ?? "An open-source repository";
  return { title: r.repo.fullName, description: d, openGraph: { title: `${r.repo.fullName} · Open Source Galaxy`, description: d } };
}

/** A static planet portrait: the same identity as in 3D, no WebGL needed. */
function PlanetPortrait({ repo }: { repo: Repository }) {
  const c = languageColor(repo.language);
  const h = hash(repo.fullName);
  const size = 7 + planetRadius(repo.stars) * 3; // rem
  const tilt = (h % 40) - 20;
  return (
    <div aria-hidden className="relative grid place-items-center py-6" style={{ height: `${size + 3}rem` }}>
      <div className="absolute rounded-full blur-3xl" style={{ width: `${size * 1.6}rem`, height: `${size * 1.6}rem`, background: `color-mix(in srgb, ${c} 25%, transparent)` }} />
      <div
        className="relative rounded-full"
        style={{
          width: `${size}rem`,
          height: `${size}rem`,
          background: `radial-gradient(circle at ${30 + (h % 20)}% ${28 + ((h >> 5) % 20)}%, color-mix(in srgb, ${c} 50%, white), ${c} 35%, color-mix(in srgb, ${c} 30%, black) 75%, #05060d)`,
          boxShadow: `inset -1.2rem -1rem 2.5rem rgb(0 0 0 / 0.55), 0 0 2.5rem color-mix(in srgb, ${c} 35%, transparent)`,
        }}
      />
      {h % 3 === 0 && (
        <div className="absolute rounded-[50%] border-2" style={{ width: `${size * 1.7}rem`, height: `${size * 0.45}rem`, borderColor: `color-mix(in srgb, ${c} 60%, transparent)`, transform: `rotate(${tilt}deg)` }} />
      )}
    </div>
  );
}

async function RepoView({ params }: { params: PageProps<"/repo/[owner]/[name]">["params"] }) {
  const { owner, name } = await params;
  const result = await loadRepo(owner, name);
  if (result.status === "not_found") notFound();
  if (result.status === "unavailable")
    return (
      <div className="glass rounded-2xl p-6 text-center">
        <h1 className="font-display text-xl font-semibold">{owner}/{name}</h1>
        <p className="mt-2 text-sm text-caution">
          GitHub {result.reason === "rate_limited" ? "rate limit reached" : "is unreachable"} and we have no saved copy of this repository yet.
        </p>
        <a className="btn btn-primary mt-4" href={`https://github.com/${owner}/${name}`} target="_blank" rel="noopener noreferrer">Open on GitHub <Icon name="external" /></a>
      </div>
    );

  const { repo } = result;
  const homes = [];
  for (const g of GALAXIES.filter((g) => g.available)) {
    const data = await loadGalaxy(g.slug);
    if (data?.regions.some((r) => r.repos.some((x) => x.id === repo.id))) homes.push(g);
  }

  return (
    <article className="glass rounded-2xl p-5 sm:p-8">
      <PlanetPortrait repo={repo} />
      <RepoDetails
        repo={repo}
        releaseChecked
        actions={homes.map((g) => (
          <Link key={g.slug} className="btn col-span-2" href={`/galaxy/${g.slug}?repo=${encodeURIComponent(repo.fullName)}`}>
            <Icon name="orbit" /> See it in {g.title}
          </Link>
        ))}
      />
      <div className="mt-6">
        <PlanetScanPanel fullName={repo.fullName} />
      </div>
    </article>
  );
}

export default function RepoPage({ params }: PageProps<"/repo/[owner]/[name]">) {
  return (
    <main className="mx-auto min-h-dvh max-w-xl px-4 py-6">
      <nav className="mb-4 flex items-center justify-between text-sm">
        <Link href="/" className="flex items-center gap-2 font-display font-semibold">
          <Icon name="orbit" className="size-5 text-accent" /> Open Source Galaxy
        </Link>
        <Link href={`/galaxy/${DEFAULT_GALAXY}`} className="text-muted hover:text-text">Explore →</Link>
      </nav>
      <Suspense fallback={<div className="glass h-96 animate-pulse rounded-2xl" role="status" aria-label="Loading repository" />}>
        <RepoView params={params} />
      </Suspense>
    </main>
  );
}
