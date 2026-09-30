"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { Avatar } from "./Avatar";

/** The six Chowk-style reactions (a user feature, not UI chrome). */
const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "😠"];

/** Chowk badge background for each reaction. */
const REACTION_BG: Record<string, string> = {
  "👍": "bg-[#4F46E5]",
  "❤️": "bg-[#E41E3F]",
  "😂": "bg-[#F7B500]",
  "😮": "bg-[#F7B500]",
  "😢": "bg-[#F7B500]",
  "😠": "bg-[#E9710F]",
};

interface Reactor {
  userId: string;
  username: string;
  fullName: string | null;
  avatarUrl: string | null;
  emoji: string;
}

/**
 * Chowk-style "who reacted" popup. Opens when the reaction count under a
 * post is tapped. Tabs filter by reaction type; names link to profiles.
 * Usernames are never displayed — only display names.
 */
export function ReactionsModal({
  postId,
  onClose,
}: {
  postId: string;
  onClose: () => void;
}) {
  const [reactors, setReactors] = useState<Reactor[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setLoading(false);
        return;
      }
      const { data: rows } = await supabase
        .from("reactions")
        .select("emoji, user_id")
        .eq("post_id", postId);
      const list = (rows ?? []) as { emoji: string; user_id: string }[];
      const ids = [...new Set(list.map((r) => r.user_id))];
      const profMap = new Map<
        string,
        {
          username: string;
          full_name: string | null;
          avatar_url: string | null;
        }
      >();
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", ids);
        for (const p of (profs ?? []) as {
          id: string;
          username: string;
          full_name: string | null;
          avatar_url: string | null;
        }[]) {
          profMap.set(p.id, p);
        }
      }
      if (cancelled) return;
      setReactors(
        list.map((r) => ({
          userId: r.user_id,
          username: profMap.get(r.user_id)?.username ?? "",
          fullName: profMap.get(r.user_id)?.full_name ?? null,
          avatarUrl: profMap.get(r.user_id)?.avatar_url ?? null,
          emoji: r.emoji,
        }))
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [postId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of reactors) map.set(r.emoji, (map.get(r.emoji) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [reactors]);

  const visible =
    tab === "all" ? reactors : reactors.filter((r) => r.emoji === tab);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Reactions"
    >
      <div
        className="flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#E6E3F0] px-4 py-3">
          <h2 className="text-lg font-bold text-[#211D33]">Reactions</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="cursor-pointer rounded-full p-2 text-[#6F6B80] transition-colors hover:bg-neutral-100"
          >
            ✕
          </button>
        </div>

        <div className="flex gap-1 overflow-x-auto border-b border-[#E6E3F0] px-3 py-2">
          <button
            type="button"
            onClick={() => setTab("all")}
            className={`cursor-pointer rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
              tab === "all"
                ? "bg-[#4F46E5] text-white"
                : "text-[#6F6B80] hover:bg-neutral-100"
            }`}
          >
            All {reactors.length}
          </button>
          {counts.map(([emoji, c]) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setTab(emoji)}
              className={`cursor-pointer rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                tab === emoji
                  ? "bg-[#4F46E5] text-white"
                  : "text-[#6F6B80] hover:bg-neutral-100"
              }`}
            >
              {emoji} {c}
            </button>
          ))}
        </div>

        <div className="min-h-[120px] flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#4F46E5] border-t-transparent" />
            </div>
          ) : visible.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#6F6B80]">
              No reactions yet.
            </p>
          ) : (
            <ul>
              {visible.map((r) => {
                const name = r.fullName || "Unknown";
                const row = (
                  <>
                    <span className="relative shrink-0">
                      <Avatar name={name} avatarUrl={r.avatarUrl} />
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] ring-2 ring-white ${
                          REACTION_BG[r.emoji] ?? "bg-[#6F6B80]"
                        }`}
                      >
                        {r.emoji}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#211D33]">
                      {name}
                    </span>
                  </>
                );
                return (
                  <li key={`${r.userId}-${r.emoji}`}>
                    {r.username ? (
                      <Link
                        href={`/profile/${encodeURIComponent(r.username)}`}
                        onClick={onClose}
                        className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-neutral-100"
                      >
                        {row}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 rounded-xl px-3 py-2">
                        {row}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
