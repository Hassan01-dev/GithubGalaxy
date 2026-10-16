import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="max-w-sm">
        <p className="font-mono text-sm text-accent">404</p>
        <h1 className="mt-2 font-display text-3xl font-semibold">Lost in space</h1>
        <p className="mt-3 text-muted">Nothing orbits at this address. It may have been renamed, or never existed.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Link className="btn btn-primary" href="/galaxy/trending">Explore the galaxy</Link>
          <Link className="btn" href="/">Home</Link>
        </div>
      </div>
    </main>
  );
}
