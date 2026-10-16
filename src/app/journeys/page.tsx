import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { JOURNEYS } from "@/lib/discovery/journeys";

export const metadata: Metadata = {
  title: "Journeys",
  description: "Editorial routes through real open-source repositories, each stop with a short note on why it belongs.",
};

export default function Journeys() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
      <Link href="/" className="flex items-center gap-2 font-display font-semibold">
        <Icon name="orbit" className="size-5 text-accent" /> Open Source Galaxy
      </Link>
      <p className="label mt-10">Community Constellations</p>
      <h1 className="mt-1 font-display text-3xl font-semibold">Journeys</h1>
      <p className="mt-3 text-muted">
        Routes hand-picked by the Open Source Galaxy editors. This is <strong className="text-text">editorial curation, not an algorithm</strong>: every stop is a real repository with a short note on why it&apos;s there.
      </p>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {JOURNEYS.map((j) => (
          <li key={j.slug} className="glass flex flex-col rounded-2xl p-4" style={j.accent ? ({ "--accent": j.accent } as React.CSSProperties) : undefined}>
            <p className="label !text-accent">Editorial · {j.stops.length} stops</p>
            <h2 className="mt-1 font-display text-lg font-semibold">{j.title}</h2>
            <p className="mt-2 flex-1 text-sm text-muted">{j.description}</p>
            <Link href={`/journeys/${j.slug}`} className="btn btn-primary mt-4 self-start">
              Start journey
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/galaxy/constellations" className="btn mt-10">See them all as constellations</Link>
    </main>
  );
}
