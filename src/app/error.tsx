"use client";
import Link from "next/link";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="max-w-sm">
        <h1 className="font-display text-3xl font-semibold">Turbulence</h1>
        <p className="mt-3 text-muted">Something went wrong while drawing this view.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button className="btn btn-primary" onClick={reset}>Try again</button>
          <Link className="btn" href="/">Home</Link>
        </div>
      </div>
    </main>
  );
}
