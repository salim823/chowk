"use client";

import { useEffect, useRef, useState } from "react";

const POLL_MS = 60_000;

/**
 * Detects when a new version of the app is deployed while the user has it
 * open. Polls /api/version every 60s; when the version changes, shows a
 * dismissible blue banner with a Refresh button. Never auto-reloads — the
 * user might be typing.
 */
export function VersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const versionRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { v?: string };
        if (!data.v || cancelled) return;
        if (versionRef.current === null) {
          versionRef.current = data.v;
        } else if (versionRef.current !== data.v) {
          versionRef.current = data.v;
          setUpdateAvailable(true);
        }
      } catch {
        // Offline or transient failure — just skip this poll.
      }
    }

    void check();
    const t = window.setInterval(() => void check(), POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, []);

  if (!updateAvailable || dismissed) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[80] flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-[#4F46E5] py-2.5 pl-5 pr-2.5 text-white shadow-xl">
        <span className="text-sm font-semibold">New update available</span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="cursor-pointer rounded-full bg-white px-4 py-1.5 text-sm font-bold text-[#4F46E5] transition-colors hover:bg-neutral-100"
        >
          Refresh
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss update notice"
          className="cursor-pointer rounded-full p-1 text-white/90 transition-colors hover:bg-white/20 hover:text-white"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
