import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = { title: "About & privacy" };

export default function About() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
      <Link href="/" className="flex items-center gap-2 font-display font-semibold">
        <Icon name="orbit" className="size-5 text-accent" /> Open Source Galaxy
      </Link>
      <h1 className="mt-10 font-display text-3xl font-semibold">About</h1>
      <div className="mt-4 space-y-4 text-muted [&_h2]:mt-10 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-text [&_strong]:text-text">
        <p>Open Source Galaxy is a way to explore open-source software as a universe: each planet is a public GitHub repository, placed in regions that each have a stated, checkable definition.</p>

        <h2>Where the data comes from</h2>
        <p>Everything is public repository metadata from the <a className="underline" href="https://docs.github.com/rest" target="_blank" rel="noopener noreferrer">GitHub REST API</a>. GitHub is the source of truth; we are a discovery layer on top of it and are not affiliated with GitHub.</p>
        <p>We cache GitHub responses and ask GitHub again at most every few hours, so numbers can lag. Every view shows when its data was fetched. If GitHub is unreachable, we show the last saved copy and say so.</p>
        <p><strong>&ldquo;Trending&rdquo;</strong>: GitHub has no public trending API. The Trending Galaxy uses labelled searches (for example, &ldquo;created in the last 30 days, ranked by stars&rdquo;). We record a daily star count for each repository we see; once we have more than one day of history, a planet can show <strong>measured</strong> growth like &ldquo;+120 stars since 2026-10-10&rdquo;. We never estimate or invent growth.</p>
        <p><strong>Connections</strong> between planets mean the repositories declare the same GitHub topics. They are not dependency relationships.</p>
        <p><strong>Signals</strong> such as &ldquo;permissive license&rdquo; or &ldquo;pushed yesterday&rdquo; are facts from metadata. They don&apos;t guarantee quality, security, or future maintenance. Always review a project before you depend on it.</p>

        <h2>Privacy</h2>
        <p>No accounts, no analytics, no cookies. Saved planets (&ldquo;My Universe&rdquo;) and your settings are stored only in your browser&apos;s localStorage and never leave your device. You can export, import, or clear them from the Saved panel, or by clearing this site&apos;s data in your browser.</p>
        <p>Searches you type are sent to our server, which forwards the search text to GitHub&apos;s search API. We don&apos;t log them.</p>

        <h2>Controls</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Drag to orbit, scroll or pinch to zoom.</li>
          <li>Click or tap a planet to inspect it; double-click (or &ldquo;Travel to planet&rdquo;) to fly there.</li>
          <li><kbd>/</kbd> focuses search, <kbd>Esc</kbd> closes panels or leaves a planet, <kbd>L</kbd> toggles the list view.</li>
          <li>Prefer less motion or a lighter scene? Open <strong>What am I seeing?</strong> (the ? button) for Reduce motion and Low effects.</li>
        </ul>
      </div>
      <Link href="/galaxy/trending" className="btn btn-primary mt-10">Enter the Galaxy</Link>
    </main>
  );
}
