import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Explorer } from "@/components/explorer/Explorer";
import { loadGalaxy } from "@/lib/data/galaxy";
import { GALAXIES, getGalaxy } from "@/lib/galaxy/galaxies";

export const generateStaticParams = () => GALAXIES.map((g) => ({ slug: g.slug }));

export async function generateMetadata({ params }: PageProps<"/galaxy/[slug]">): Promise<Metadata> {
  const g = getGalaxy((await params).slug);
  return g ? { title: g.title, description: `${g.tagline}. ${g.description}` } : {};
}

export default function GalaxyPage({ params }: PageProps<"/galaxy/[slug]">) {
  return (
    // Params and useSearchParams both sit behind this boundary; the shell prerenders around it.
    <Suspense fallback={<div className="grid min-h-dvh place-items-center text-sm text-muted">Charting the galaxy…</div>}>
      <GalaxyContent params={params} />
    </Suspense>
  );
}

async function GalaxyContent({ params }: { params: PageProps<"/galaxy/[slug]">["params"] }) {
  const { slug } = await params;
  const galaxy = getGalaxy(slug);
  if (!galaxy) notFound();

  if (!galaxy.available)
    return (
      <main className="grid min-h-dvh place-items-center p-6 text-center" style={{ "--accent": galaxy.theme.accent } as React.CSSProperties}>
        <div className="max-w-md">
          <p className="label !text-accent">Charting soon</p>
          <h1 className="mt-2 font-display text-3xl font-semibold">{galaxy.title}</h1>
          <p className="mt-3 text-muted">{galaxy.description} We&apos;re mapping it now. Meanwhile, the Trending Galaxy is open.</p>
          <div className="mt-6 flex justify-center gap-2">
            <Link className="btn btn-primary" href="/galaxy/trending">Enter the Trending Galaxy</Link>
            <Link className="btn" href="/">Universe map</Link>
          </div>
        </div>
      </main>
    );

  const data = await loadGalaxy(slug);
  if (!data) notFound();
  return <Explorer data={data} />;
}
