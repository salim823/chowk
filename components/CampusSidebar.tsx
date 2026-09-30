"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { Avatar } from "@/components/Avatar";
import { FollowButton } from "@/components/FollowButton";
import { timeAgo } from "@/lib/time";
import { getMyFriendData, type FriendData } from "@/lib/friends";
import { getHiddenPostIds } from "@/lib/hiddenPosts";

type Student = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  last_active_at: string | null;
  created_at: string;
};

type TrendingPost = {
  id: string;
  content: string | null;
  user_id: string;
  created_at: string;
  reactionCount: number;
  authorName: string;
};

/**
 * CampusSidebar — the desktop right rail on the feed. Three sections, each
 * rendered ONLY when real data exists:
 *  - Active Students (recently online, not me, not blocked)
 *  - New Students (recent signups)
 *  - Trending on Chowk (most-reacted posts of the last 7 days)
 *
 * Self-sufficient: loads the viewer id + friend graph itself so
 * DesktopColumns can drop it in without prop drilling.
 */
export function CampusSidebar() {
  const [myId, setMyId] = useState<string | null>(null);
  const [friendData, setFriendData] = useState<FriendData | null>(null);
  const [active, setActive] = useState<Student[]>([]);
  const [joined, setJoined] = useState<Student[]>([]);
  const [trending, setTrending] = useState<TrendingPost[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setLoaded(true);
        return;
      }
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const fd = await getMyFriendData(supabase, user.id);
        if (cancelled) return;
        setMyId(user.id);
        setFriendData(fd);
        const myIdVal = user.id;
        const base = () =>
          supabase
            .from("profiles")
            .select("id, username, full_name, avatar_url, last_active_at, created_at, is_private")
            .neq("id", myIdVal)
            .eq("is_private", false)
            // The hidden admin must never appear in people-discovery surfaces.
            .eq("is_admin", false)
            .not("is_deleted", "is", true);

        const [activeRes, joinedRes] = await Promise.all([
          base()
            .not("last_active_at", "is", null)
            .order("last_active_at", { ascending: false })
            .limit(8),
          base().order("created_at", { ascending: false }).limit(6),
        ]);

        const clean = (rows: Student[]) =>
          rows.filter((r) => !fd.blockedIds.has(r.id)).slice(0, 5);

        // Trending: most-reacted posts of the last 7 days (visible ones).
        const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
        const hiddenIds = await getHiddenPostIds(supabase, myIdVal);
        const { data: recentPosts } = await supabase
          .from("posts")
          .select("id, content, user_id, created_at, audience, profiles!posts_user_id_fkey(username, full_name, is_admin)")
          .gt("created_at", weekAgo)
          .order("created_at", { ascending: false })
          .limit(40);
        const trendRows = ((recentPosts ?? []) as unknown as {
          id: string;
          content: string | null;
          user_id: string;
          created_at: string;
          audience: string;
          profiles: { username: string; full_name: string | null; is_admin: boolean } | null;
        }[]).filter((p) => {
          // Posts the viewer hid ("Hide this post for me", 7 days).
          if (hiddenIds.has(p.id)) return false;
          // Never surface the hidden admin's posts in discovery surfaces.
          if (p.profiles?.is_admin) return false;
          if (fd.blockedIds.has(p.user_id)) return false;
          if (p.user_id === myIdVal) return true;
          const isFriend = fd.acceptedIds.has(p.user_id);
          return !(p.audience === "friends" && !isFriend);
        });
        // Private accounts stay hidden from non-friends here too (same as feed).
        const trendAuthorIds = [...new Set(trendRows.map((p) => p.user_id))];
        const trendPrivacy = new Map<string, boolean>();
        if (trendAuthorIds.length > 0) {
          const { data: profRows } = await supabase
            .from("profiles")
            .select("id, is_private")
            .in("id", trendAuthorIds);
          for (const r of (profRows ?? []) as { id: string; is_private: boolean }[]) {
            trendPrivacy.set(r.id, r.is_private);
          }
        }
        const visible = trendRows.filter((p) => {
          if (p.user_id === myIdVal) return true;
          const isFriend = fd.acceptedIds.has(p.user_id);
          if (trendPrivacy.get(p.user_id) && !isFriend) return false;
          return true;
        });
        let trend: TrendingPost[] = [];
        if (visible.length > 0) {
          const ids = visible.map((p) => p.id);
          const { data: reacts } = await supabase
            .from("reactions")
            .select("post_id")
            .in("post_id", ids);
          const counts = new Map<string, number>();
          for (const r of (reacts ?? []) as { post_id: string }[]) {
            counts.set(r.post_id, (counts.get(r.post_id) ?? 0) + 1);
          }
          trend = visible
            .map((p) => ({
              id: p.id,
              content: p.content,
              user_id: p.user_id,
              created_at: p.created_at,
              reactionCount: counts.get(p.id) ?? 0,
              authorName: p.profiles?.full_name || "Student",
            }))
            .filter((p) => p.reactionCount > 0)
            .sort((a, b) => b.reactionCount - a.reactionCount)
            .slice(0, 3);
        }

        if (!cancelled) {
          setActive(clean((activeRes.data ?? []) as Student[]));
          setJoined(clean((joinedRes.data ?? []) as Student[]));
          setTrending(trend);
          setLoaded(true);
        }
      } catch {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!loaded) {
    return (
      <div className="flex flex-col gap-4" aria-hidden>
        {[0, 1].map((i) => (
          <div
            key={i}
            className="chowk-card animate-pulse p-4"
          >
            <div className="h-4 w-28 rounded-full bg-[#E6E3F0]" />
            <div className="mt-3 h-3 w-40 rounded-full bg-[#F5F4FA]" />
          </div>
        ))}
      </div>
    );
  }

  if (active.length === 0 && joined.length === 0 && trending.length === 0) {
    return (
      <div className="chowk-card chowk-rise p-5 text-center">
        <span
          aria-hidden
          className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF2FF]"
        >
          <svg
            className="h-5 w-5 text-[#4F46E5]"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </span>
        <p className="mt-2 text-sm font-bold text-[#211D33]">
          Your campus is growing
        </p>
        <p className="mt-1 text-xs leading-5 text-[#6F6B80]">
          As more students join and post, live campus highlights will appear
          here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {active.length > 0 && (
        <section aria-label="Active students" className="chowk-card p-4">
          <h3 className="text-sm font-bold text-[#211D33]">Active Students</h3>
          <ul className="mt-3 flex flex-col gap-2.5">
            {active.map((s) => (
              <li key={s.id} className="flex items-center gap-2.5">
                <span className="relative shrink-0">
                  <Avatar
                    name={s.full_name || s.username}
                    size="sm"
                    avatarUrl={s.avatar_url}
                  />
                  <span
                    aria-hidden
                    className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-[#22C55E] ring-2 ring-white"
                  />
                </span>
                <Link
                  href={`/profile/${s.username}`}
                  className="min-w-0 flex-1 cursor-pointer"
                >
                  <p className="truncate text-sm font-semibold text-[#211D33] hover:underline">
                    {s.full_name || "Student"}
                  </p>
                  <p className="text-xs text-[#6F6B80]">
                    {s.last_active_at
                      ? `Active ${timeAgo(s.last_active_at)}`
                      : "Recently active"}
                  </p>
                </Link>
                <FollowButton me={myId ?? ""} targetId={s.id} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {trending.length > 0 && (
        <section aria-label="Trending on Chowk" className="chowk-card p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-bold text-[#211D33]">
            <svg
              className="h-4 w-4 text-[#EC4899]"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden
            >
              <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
            </svg>
            Trending on Chowk
          </h3>
          <ul className="mt-3 flex flex-col gap-3">
            {trending.map((p) => (
              <li key={p.id}>
                <p className="text-xs font-medium text-[#6F6B80]">
                  {p.authorName} · {p.reactionCount}{" "}
                  {p.reactionCount === 1 ? "reaction" : "reactions"}
                </p>
                <p className="mt-0.5 line-clamp-2 text-sm leading-5 text-[#211D33]">
                  {p.content || "Shared a photo"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {joined.length > 0 && (
        <section aria-label="New students" className="chowk-card p-4">
          <h3 className="text-sm font-bold text-[#211D33]">
            New Students
          </h3>
          <ul className="mt-3 flex flex-col gap-2.5">
            {joined.map((s) => (
              <li key={s.id} className="flex items-center gap-2.5">
                <Avatar
                  name={s.full_name || s.username}
                  size="sm"
                  avatarUrl={s.avatar_url}
                />
                <Link
                  href={`/profile/${s.username}`}
                  className="min-w-0 flex-1 cursor-pointer"
                >
                  <p className="truncate text-sm font-semibold text-[#211D33] hover:underline">
                    {s.full_name || "Student"}
                  </p>
                  <p className="text-xs text-[#6F6B80]">
                    Joined {timeAgo(s.created_at)}
                  </p>
                </Link>
                <FollowButton me={myId ?? ""} targetId={s.id} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
