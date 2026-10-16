import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CopyLinkButton } from "@/components/explorer/RepoDetails";
import { Icon } from "@/components/ui/Icon";
import { JOURNEYS, getJourney } from "@/lib/discovery/journeys";

// Typed by hand: PageProps route types only exist after `next typegen`/build.
type Props = { params: Promise<{ slug: string }> };

export const generateStaticParams = () => JOURNEYS.map((j) => ({ slug: j.slug }));

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const j = getJourney((await params).slug);
  if (!j) return {};
  const description = `An editorial journey through ${j.stops.length} open-source repositories. ${j.description}`;
  return { title: j.title, description, openGraph: { title: `${j.title} · Open Source Galaxy`, description } };
}

export default function JourneyPage({ params }: Props) {
  return (
    // Params sit behind this boundary, like the galaxy page; known slugs still prerender.
    <Suspense fallback={<div className="grid min-h-dvh place-items-center text-sm text-muted">Plotting the route…</div>}>
      <JourneyContent params={params} />
    </Suspense>
  );
}

async function JourneyContent({ params }: { params: Props["params"] }) {
  const j = getJourney((await params).slug);
  if (!j) notFound();
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:py-16" style={j.accent ? ({ "--accent": j.accent } as React.CSSProperties) : undefined}>
      <Link href="/journeys" className="flex items-center gap-2 font-display font-semibold">
        <Icon name="orbit" className="size-5 text-accent" /> All journeys
      </Link>
      <p className="label mt-10 !text-accent">Editorial journey · {j.stops.length} stops</p>
      <h1 className="mt-1 font-display text-3xl font-semibold">{j.title}</h1>
      <p className="mt-3 text-muted">{j.description}</p>
      <p className="mt-2 text-xs text-faint">Hand-picked by the Open Source Galaxy editors. Editorial curation, not an algorithmic recommendation.</p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link href={`/galaxy/constellations?journey=${j.slug}`} className="btn btn-primary">
          <Icon name="nav" /> Fly this journey
        </Link>
        <CopyLinkButton path={`/journeys/${j.slug}`} label="Share route" />
      </div>
      <ol className="mt-10 space-y-3">
        {j.stops.map((s, i) => (
          <li key={s.fullName} className="glass flex gap-4 rounded-2xl p-4">
            <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full border border-accent/60 font-mono text-sm text-accent">{i + 1}</span>
            <div className="min-w-0">
              <Link href={`/repo/${s.fullName}`} className="font-mono text-sm font-semibold underline-offset-4 hover:underline">
                <span className="sr-only">Stop {i + 1}: </span>{s.fullName}
              </Link>
              <p className="mt-1 text-sm text-muted">{s.note}</p>
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}
