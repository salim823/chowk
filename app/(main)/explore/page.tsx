"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getMyFriendData, type FriendData } from "@/lib/friends";
import { getHiddenPostIds } from "@/lib/hiddenPosts";
import { PostLightbox } from "@/components/PostLightbox";
import { PeopleYouMayKnow } from "@/components/PeopleYouMayKnow";
import { isVideoUrl } from "@/lib/media";
import type { PostRow } from "@/lib/types";

type PhotoPost = PostRow & { reactionCount: number };

/**
 * Explore — discover what's happening on campus. A search entry, trending
 * photo posts (most-reacted, last 30 days), and the freshest campus photos.
 * Tapping a tile opens the lightbox preview. All data is real; sections
 * with no data show friendly empty states instead of blank space.
 */
export default function ExplorePage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [trending, setTrending] = useState<PhotoPost[]>([]);
  const [fresh, setFresh] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<PostRow | null>(null);

  const load = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }
      const friendData: FriendData = await getMyFriendData(supabase, user.id);
      // Posts the viewer hid via the X button (still within 7 days).
      const hiddenIds = await getHiddenPostIds(supabase, user.id);

      const { data: postRows } = await supabase
        .from("posts")
        .select("*, profiles!posts_user_id_fkey(username, full_name, avatar_url, is_admin)")
        .not("image_urls", "eq", "{}")
        .order("created_at", { ascending: false })
        .limit(60);
      const list = ((postRows ?? []) as (PostRow & {
        profiles: (PostRow["profiles"] & { is_admin?: boolean }) | null;
      })[]).filter((p) => {
        // Posts the viewer hid ("Hide this post for me", 7 days).
        if (hiddenIds.has(p.id)) return false;
        // The hidden admin never appears on Explore.
        if (p.profiles?.is_admin) return false;
        if (friendData.blockedIds.has(p.user_id)) return false;
        if (p.user_id !== user.id) {
          const isFriend = friendData.acceptedIds.has(p.user_id);
          if (p.audience === "friends" && !isFriend) return false;
        }
        return (p.image_urls ?? []).length > 0;
      });

      // Authors' privacy flags: private accounts stay hidden from non-friends.
      const authorIds = [...new Set(list.map((p) => p.user_id))];
      const privacy = new Map<string, boolean>();
      if (authorIds.length > 0) {
        const { data: profRows } = await supabase
          .from("profiles")
          .select("id, is_private")
          .in("id", authorIds);
        for (const r of (profRows ?? []) as { id: string; is_private: boolean }[]) {
          privacy.set(r.id, r.is_private);
        }
      }
      const viewable = list.filter((p) => {
        if (p.user_id === user.id) return true;
        return !(privacy.get(p.user_id) && !friendData.acceptedIds.has(p.user_id));
      });

      // Reaction counts for the trending sort (last 30 days only).
      const monthAgo = Date.now() - 30 * 24 * 3600 * 1000;
      const counts = new Map<string, number>();
      if (viewable.length > 0) {
        const { data: reacts } = await supabase
          .from("reactions")
          .select("post_id")
          .in(
            "post_id",
            viewable.map((p) => p.id)
          );
        for (const r of (reacts ?? []) as { post_id: string }[]) {
          counts.set(r.post_id, (counts.get(r.post_id) ?? 0) + 1);
        }
      }
      const withCounts: PhotoPost[] = viewable.map((p) => ({
        ...p,
        reactionCount: counts.get(p.id) ?? 0,
      }));
      setTrending(
        withCounts
          .filter(
            (p) =>
              new Date(p.created_at).getTime() > monthAgo && p.reactionCount > 0
          )
          .sort((a, b) => b.reactionCount - a.reactionCount)
          .slice(0, 9)
      );
      setFresh(viewable.slice(0, 18));
    } catch {
      /* best-effort; empty states cover failures */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/search?q=${encodeURIComponent(term)}` : "/search");
  }

  function Grid({
    posts,
    label,
  }: {
    posts: PostRow[];
    label: string;
  }) {
    if (posts.length === 0) return null;
    return (
      <section aria-label={label} className="chowk-card chowk-rise p-3 sm:p-4">
        <h2 className="px-1 pb-3 text-[15px] font-bold text-[#211D33]">
          {label}
        </h2>
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {posts.map((p) => {
            const url = (p.image_urls ?? [])[0];
            const video = isVideoUrl(url);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setActive(p)}
                aria-label={video ? "Play video" : "View photo"}
                className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl bg-[#E6E3F0] transition-transform active:scale-95"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                {video && (
                  <span
                    aria-hidden
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#211D33]/60 text-white backdrop-blur-sm">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-3 py-4 sm:px-4">
      {/* Search entry — the mobile nav's search lives here now. */}
      <form onSubmit={submitSearch} className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#6F6B80]"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search students on Chowk..."
          autoComplete="off"
          aria-label="Search students"
          className="w-full rounded-full bg-white py-3 pl-11 pr-4 text-[15px] text-[#211D33] shadow-sm ring-1 ring-[#E6E3F0] placeholder:text-[#6F6B80]/70 focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/40"
        />
      </form>

      {loading ? (
        <div className="chowk-card p-8 text-center" aria-hidden>
          <div className="mx-auto grid max-w-md grid-cols-3 gap-1.5">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="aspect-square animate-pulse rounded-xl bg-[#E6E3F0]"
              />
            ))}
          </div>
        </div>
      ) : (
        <>
          {trending.length > 0 && (
            <Grid posts={trending} label="Trending on Chowk" />
          )}
          {fresh.length > 0 ? (
            <Grid posts={fresh} label="Fresh from campus" />
          ) : (
            <div className="chowk-card chowk-rise p-8 text-center">
              <span
                aria-hidden
                className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF2FF]"
              >
                <svg
                  className="h-6 w-6 text-[#4F46E5]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
                </svg>
              </span>
              <p className="mt-3 text-[15px] font-bold text-[#211D33]">
                No campus photos yet
              </p>
              <p className="mx-auto mt-1 max-w-xs text-sm leading-5 text-[#6F6B80]">
                When students share photos, the best moments will appear here.
                Be the first to add one from the feed.
              </p>
            </div>
          )}
          <PeopleYouMayKnow />
        </>
      )}

      {active && <PostLightbox post={active} onClose={() => setActive(null)} />}
    </div>
  );
}
