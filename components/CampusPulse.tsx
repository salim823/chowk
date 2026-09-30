"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

/**
 * Campus Pulse — a compact strip showing REAL recent activity on Chowk:
 * posts shared in the last 24h and students who joined in the last 7 days.
 * Never invents numbers: with no activity it shows a warm welcome state.
 */
export function CampusPulse() {
  const [stats, setStats] = useState<{ posts: number; joined: number } | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      try {
        const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
        const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
        const [{ count: posts }, { count: joined }] = await Promise.all([
          supabase
            .from("posts")
            .select("id", { count: "exact", head: true })
            .gt("created_at", dayAgo),
          supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .gt("created_at", weekAgo)
            // Counts are students only: never the hidden admin or deleted accounts.
            .eq("is_admin", false)
            .not("is_deleted", "is", true),
        ]);
        if (!cancelled) setStats({ posts: posts ?? 0, joined: joined ?? 0 });
      } catch {
        if (!cancelled) setStats({ posts: 0, joined: 0 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!stats) {
    return (
      <div className="chowk-card chowk-rise animate-pulse p-4" aria-hidden>
        <div className="h-4 w-32 rounded-full bg-[#E6E3F0]" />
        <div className="mt-2 h-3 w-48 rounded-full bg-[#F5F4FA]" />
      </div>
    );
  }

  const quiet = stats.posts === 0 && stats.joined === 0;

  return (
    <section
      aria-label="Campus pulse"
      className="chowk-card chowk-rise overflow-hidden"
    >
      <div className="flex items-center gap-3 p-4">
        <span
          aria-hidden
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#4F46E5] to-[#8B5CF6]"
        >
          <svg
            className="h-5 w-5 text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
          {!quiet && (
            <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#EC4899] opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-[#EC4899] ring-2 ring-white" />
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-bold text-[#211D33]">Campus Pulse</h2>
          {quiet ? (
            <p className="mt-0.5 text-sm leading-5 text-[#6F6B80]">
              Your campus is just getting started — be one of the first to
              share something today.
            </p>
          ) : (
            <p className="mt-0.5 text-sm leading-5 text-[#6F6B80]">
              {stats.posts > 0 && (
                <>
                  <span className="font-bold text-[#4338CA]">
                    {stats.posts}
                  </span>{" "}
                  new {stats.posts === 1 ? "post" : "posts"} today
                </>
              )}
              {stats.posts > 0 && stats.joined > 0 && " · "}
              {stats.joined > 0 && (
                <>
                  <span className="font-bold text-[#4338CA]">
                    {stats.joined}
                  </span>{" "}
                  {stats.joined === 1 ? "student" : "students"} joined this week
                </>
              )}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
