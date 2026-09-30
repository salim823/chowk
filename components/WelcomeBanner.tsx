"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getSupabaseClient } from "@/lib/supabaseClient";

const DISMISS_KEY = "chowk-welcome-dismissed-v2";

/**
 * "Welcome to Chowk" card at the top of the feed: a warm campus greeting
 * with one REAL stat (students who joined this week) plus the safe-space
 * reassurance, redesigned as a celebration — not a warning.
 * Dismissible; the choice persists in localStorage.
 */
export function WelcomeBanner() {
  const [visible, setVisible] = useState(false);
  const [joined, setJoined] = useState<number | null>(null);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(DISMISS_KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      try {
        const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
        const { count } = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .gt("created_at", weekAgo);
        if (!cancelled) setJoined(count ?? 0);
      } catch {
        if (!cancelled) setJoined(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!visible) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private mode; ignore */
    }
    setVisible(false);
  }

  return (
    <div className="chowk-card chowk-rise relative overflow-hidden">
      {/* Soft brand wash across the top — celebratory, not loud. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-[#4F46E5]/10 via-[#8B5CF6]/10 to-[#EC4899]/10"
      />
      <div className="relative flex items-start gap-3 p-4">
        <span
          aria-hidden
          className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#E6E3F0]"
        >
          <Image
            src="/logo.webp"
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 object-cover"
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-bold text-[#211D33]">
            Welcome to Chowk
          </p>
          <p className="mt-0.5 text-sm leading-5 text-[#6F6B80]">
            Your college community is growing. Connect, share and discover
            what&apos;s happening around campus.
            {joined !== null && joined > 0 && (
              <>
                {" "}
                <span className="font-bold text-[#4338CA]">
                  {joined} {joined === 1 ? "student has" : "students have"}
                </span>{" "}
                joined recently.
              </>
            )}
          </p>
          <p className="mt-2 flex items-start gap-1.5 text-[13px] leading-5 text-[#6F6B80]">
            <svg
              className="mt-0.5 h-4 w-4 shrink-0 text-[#4F46E5]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M12 22s8-3.6 8-10V5l-8-3-8 3v7c0 6.4 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <span>
              A safe space for college girls — boy accounts are removed. Post
              freely, or choose{" "}
              <span className="font-semibold text-[#211D33]">Anonymous</span>{" "}
              in the composer to hide your name.
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#6F6B80] transition-colors hover:bg-[#F5F4FA] hover:text-[#211D33]"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>
      </div>
    </div>
  );
}
