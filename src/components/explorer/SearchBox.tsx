"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useDebounced } from "@/hooks/useDebounced";
import { compact } from "@/lib/format";
import { languageColor } from "@/lib/galaxy/layout";
import type { Repository } from "@/types";
import type { SearchResult } from "@/lib/data/search";


export interface SearchPick {
  repo: Repository;
  inGalaxy: boolean;
}

/** Local matches rank name hits above description/topic hits. */
export function searchLocal(repos: Repository[], q: string, limit = 6): Repository[] {
  const t = q.trim().toLowerCase();
  if (t.length < 2) return [];
  const score = (r: Repository) =>
    r.name.toLowerCase() === t ? 4 : r.fullName.toLowerCase().includes(t) ? 3 : r.topics.some((x) => x.includes(t)) ? 2 : r.description?.toLowerCase().includes(t) ? 1 : 0;
  return repos.map((r) => [r, score(r)] as const).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1] || b[0].stars - a[0].stars).slice(0, limit).map(([r]) => r);
}

export function SearchBox({ repos, onPick, initialQuery = "", autoFocus }: { repos: Repository[]; onPick: (p: SearchPick) => void; initialQuery?: string; autoFocus?: boolean }) {
  const [q, setQ] = useState(initialQuery);
  const [open, setOpen] = useState(!!initialQuery);
  const [active, setActive] = useState(0);
  const [remote, setRemote] = useState<{ q: string; result: SearchResult } | null>(null);
  const debounced = useDebounced(q.trim(), 450);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();

  const local = useMemo(() => searchLocal(repos, q), [repos, q]);
  const ids = useMemo(() => new Set(repos.map((r) => r.id)), [repos]);

  useEffect(() => {
    if (debounced.length < 2 || !navigator.onLine) return;
    const ctrl = new AbortController();
    fetch(`/api/search?q=${encodeURIComponent(debounced)}`, { signal: ctrl.signal })
      .then((r) => r.json() as Promise<SearchResult>)
      .then((result) => setRemote({ q: debounced, result }))
      .catch((e) => e.name !== "AbortError" && setRemote({ q: debounced, result: { status: "error" } }));
    return () => ctrl.abort();
  }, [debounced]);
  // Results only count for the exact text in the box; anything else is still in flight.
  const current = remote && remote.q === q.trim() ? remote.result : null;
  const offline = typeof navigator !== "undefined" && !navigator.onLine;

  // `/` focuses search from anywhere, like GitHub.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(el.tagName)) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const remoteRepos = current?.status === "ok" ? current.repos.filter((r) => !local.some((l) => l.id === r.id)).slice(0, 8) : [];
  const options: SearchPick[] = [...local.map((repo) => ({ repo, inGalaxy: true })), ...remoteRepos.map((repo) => ({ repo, inGalaxy: ids.has(repo.id) }))];
  const show = open && q.trim().length >= 2;

  const pick = (p: SearchPick) => {
    onPick(p);
    setOpen(false);
    input.current?.blur();
  };

  return (
    <div className="relative w-full">
      <label htmlFor={`${listId}-input`} className="sr-only">Search repositories</label>
      <div className="relative">
        <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
        <input
          id={`${listId}-input`}
          ref={input}
          autoFocus={autoFocus}
          className="field !pl-9 !pr-10"
          placeholder="Search name, topic, or need…"
          value={q}
          role="combobox"
          aria-expanded={show}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={show && options[active] ? `${listId}-${active}` : undefined}
          onChange={(e) => (setQ(e.target.value), setOpen(true), setActive(0))}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, options.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && options[active]) {
              e.preventDefault();
              pick(options[active]);
            } else if (e.key === "Escape") {
              // Close the list without also closing the planet panel behind it.
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
              setOpen(false);
            }
          }}
        />
        <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border border-line px-1.5 font-mono text-[0.65rem] text-faint sm:block">/</kbd>
      </div>

      {show && (
        <div className="glass scroll-thin absolute inset-x-0 top-full z-50 mt-2 max-h-[min(70vh,28rem)] overflow-y-auto rounded-xl p-1.5 shadow-2xl">
          <ul id={listId} role="listbox" aria-label="Search results">
            {local.length > 0 && <li role="presentation" className="label px-2.5 pt-1.5 pb-1">In this galaxy</li>}
            {options.map((o, i) => (
              <li key={o.repo.id} role="presentation">
                {i === local.length && <div className="label px-2.5 pt-3 pb-1">On GitHub</div>}
                <div
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(o)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg px-2.5 py-2 ${i === active ? "bg-white/10" : ""}`}
                >
                  <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ background: languageColor(o.repo.language) }} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{o.repo.fullName}</span>
                    {o.repo.description && <span className="line-clamp-1 text-xs text-muted">{o.repo.description}</span>}
                  </span>
                  <span className="shrink-0 text-right text-xs text-muted">
                    <span className="font-mono">★ {compact(o.repo.stars)}</span>
                    <span className="block text-[0.65rem] text-faint">{o.inGalaxy ? "Travel here" : "Open details"}</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <RemoteStatus result={current} offline={offline} empty={options.length === 0} />
        </div>
      )}
    </div>
  );
}

function RemoteStatus({ result: r, offline, empty }: { result: SearchResult | null; offline: boolean; empty: boolean }) {
  const msg = (() => {
    if (offline) return "You're offline. Showing matches from this galaxy only.";
    if (!r) return "Searching GitHub…";
    if (r.status === "rate_limited")
      return `GitHub search is rate-limited${r.resetAt ? ` until ${new Date(r.resetAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}. Matches from this galaxy still work.`;
    if (r.status === "error") return "GitHub search failed. Matches from this galaxy still work.";
    if (empty) return "No repositories found. Try a broader word or a topic like “cli” or “rag”.";
    return null;
  })();
  return msg ? <p role="status" className="px-2.5 py-2 text-xs text-muted">{msg}</p> : null;
}
