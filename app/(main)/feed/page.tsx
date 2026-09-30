"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getMyFriendData, type FriendData } from "@/lib/friends";
import { getHiddenPostIds } from "@/lib/hiddenPosts";
import { PostComposerModal, type ShareDraft } from "@/components/PostComposerModal";
import { PeopleYouMayKnow } from "@/components/PeopleYouMayKnow";
import { FeedList } from "@/components/FeedList";
import { Avatar } from "@/components/Avatar";
import { NewPostsPill } from "@/components/NewPostsPill";
import { ComposerCard } from "@/components/ProfileView";
import { WelcomeBanner } from "@/components/WelcomeBanner";
import { CampusPulse } from "@/components/CampusPulse";
import { CampusMoments } from "@/components/CampusMoments";
import type { PostRow, ProfileLite } from "@/lib/types";

const PAGE_SIZE = 50;
const POLL_INTERVAL_MS = 30_000;
const PULL_THRESHOLD = 80;

type NewPostStub = {
  id: string;
  created_at: string;
  user_id: string;
  audience: string;
};

/** Same visibility rules as the main feed query, for poll results. */
function filterVisibleStubs(
  rows: NewPostStub[],
  uid: string,
  friendData: FriendData,
  privacy: Map<string, boolean>
): NewPostStub[] {
  return rows.filter((r) => {
    if (friendData.blockedIds.has(r.user_id)) return false;
    if (r.user_id !== uid) {
      const isFriend = friendData.acceptedIds.has(r.user_id);
      if (privacy.get(r.user_id) && !isFriend) return false;
      if (r.audience === "friends" && !isFriend) return false;
    }
    return true;
  });
}

export default function FeedPage() {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentProfile, setCurrentProfile] = useState<ProfileLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareDraft, setShareDraft] = useState<ShareDraft | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [photoNonce, setPhotoNonce] = useState(0);
  const [anonymousNonce, setAnonymousNonce] = useState(0);

  // "New posts" pill state.
  const [pendingNewIds, setPendingNewIds] = useState<string[]>([]);
  // Pull-to-refresh state (touch devices).
  const [pulling, setPulling] = useState(false);
  const [pullDist, setPullDist] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const mainRef = useRef<HTMLElement | null>(null);
  const friendDataRef = useRef<FriendData | null>(null);
  const privacyRef = useRef<Map<string, boolean>>(new Map());
  const newestAtRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const pendingIdsRef = useRef<string[]>([]);
  const pullDistRef = useRef(0);

  // A share started on another page (e.g. a user profile) lands here and
  // opens the composer with the draft prefilled.
  useEffect(() => {
    try {
      const draft = sessionStorage.getItem("chowk-share-draft");
      if (draft) {
        sessionStorage.removeItem("chowk-share-draft");
        setShareDraft({ text: draft, nonce: Date.now() });
        setComposerOpen(true);
      }
    } catch {
      // Session storage is optional.
    }
  }, []);

  const load = useCallback(async (quiet = false) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError("The app is not connected to the database yet.");
      setLoading(false);
      return;
    }
    if (!quiet) setLoading(true);
    setError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("You are not logged in. Please log in again.");
        return;
      }
      setCurrentUserId(user.id);
      userIdRef.current = user.id;

      const { data: profile } = await supabase
        .from("profiles")
        .select("username, full_name, avatar_url")
        .eq("id", user.id)
        .single();
      setCurrentProfile((profile as ProfileLite | null) ?? null);

      const friendData = await getMyFriendData(supabase, user.id);
      friendDataRef.current = friendData;

      // Posts this user hid via the X button (still within the 7-day window).
      const hiddenIds = await getHiddenPostIds(supabase, user.id);

      const { data: postRows, error: postError } = await supabase
        .from("posts")
        .select("*, profiles!posts_user_id_fkey(username, full_name, avatar_url)")
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      if (postError) throw postError;

      const list = (postRows ?? []) as PostRow[];

      // Authors' privacy flags, to hide private users from non-friends.
      const authorIds = [...new Set(list.map((p) => p.user_id))];
      const privacy = new Map<string, boolean>();
      if (authorIds.length > 0) {
        const { data: profRows } = await supabase
          .from("profiles")
          .select("id, is_private")
          .in("id", authorIds);
        for (const r of (profRows ?? []) as {
          id: string;
          is_private: boolean;
        }[]) {
          privacy.set(r.id, r.is_private);
        }
      }
      privacyRef.current = privacy;

      const visible = list.filter((p) => {
        // Posts the viewer hid ("Hide this post for me", 7 days).
        if (hiddenIds.has(p.id)) return false;
        // Blocked users (either direction) disappear from the feed.
        if (friendData.blockedIds.has(p.user_id)) return false;
        if (p.user_id !== user.id) {
          const isFriend = friendData.acceptedIds.has(p.user_id);
          if (privacy.get(p.user_id) && !isFriend) return false;
          if (p.audience === "friends" && !isFriend) return false;
        }
        return true;
      });
      setPosts(visible);

      // Reset the "new posts" tracker to the newest post we just loaded.
      newestAtRef.current =
        list.length > 0 ? list[0].created_at : new Date().toISOString();
      pendingIdsRef.current = [];
      setPendingNewIds([]);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not load the feed. Please retry."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Cheap poll: only id/created_at/user_id/audience, filtered client-side. */
  const checkForNewPosts = useCallback(async () => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible")
      return;
    const supabase = getSupabaseClient();
    const since = newestAtRef.current;
    const uid = userIdRef.current;
    const friendData = friendDataRef.current;
    if (!supabase || !since || !uid || !friendData) return;
    try {
      const { data, error } = await supabase
        .from("posts")
        .select("id, created_at, user_id, audience")
        .gt("created_at", since)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error || !data || data.length === 0) return;
      const rows = data as NewPostStub[];

      // Privacy flags for authors we haven't seen in this session.
      const privacy = privacyRef.current;
      const unknown = [
        ...new Set(
          rows.map((r) => r.user_id).filter((id) => id !== uid && !privacy.has(id))
        ),
      ];
      if (unknown.length > 0) {
        const { data: profRows } = await supabase
          .from("profiles")
          .select("id, is_private")
          .in("id", unknown);
        for (const r of (profRows ?? []) as {
          id: string;
          is_private: boolean;
        }[]) {
          privacy.set(r.id, r.is_private);
        }
      }

      const visible = filterVisibleStubs(rows, uid, friendData, privacy);
      const known = new Set(pendingIdsRef.current);
      const fresh = visible.filter((r) => !known.has(r.id));
      if (fresh.length > 0) {
        const ids = [...pendingIdsRef.current, ...fresh.map((r) => r.id)];
        pendingIdsRef.current = ids;
        setPendingNewIds(ids);
      }
    } catch {
      // Polling is best-effort; the next tick retries.
    }
  }, []);

  // Poll every 30s while the tab is visible; check immediately on return.
  useEffect(() => {
    const timer = window.setInterval(() => {
      void checkForNewPosts();
    }, POLL_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void checkForNewPosts();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [checkForNewPosts]);

  /** User tapped the pill: fetch full rows, prepend without duplicates. */
  const showNewPosts = useCallback(async () => {
    const supabase = getSupabaseClient();
    const ids = pendingIdsRef.current;
    if (!supabase || ids.length === 0) return;
    pendingIdsRef.current = [];
    setPendingNewIds([]);
    try {
      const { data, error } = await supabase
        .from("posts")
        .select("*, profiles!posts_user_id_fkey(username, full_name, avatar_url)")
        .in("id", ids)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as PostRow[];
      const uid = userIdRef.current;
      const friendData = friendDataRef.current;
      const privacy = privacyRef.current;
      const visible =
        uid && friendData
          ? rows.filter((p) => {
              if (friendData.blockedIds.has(p.user_id)) return false;
              if (p.user_id !== uid) {
                const isFriend = friendData.acceptedIds.has(p.user_id);
                if (privacy.get(p.user_id) && !isFriend) return false;
                if (p.audience === "friends" && !isFriend) return false;
              }
              return true;
            })
          : rows;
      setPosts((prev) => {
        const have = new Set(prev.map((p) => p.id));
        const fresh = visible.filter((p) => !have.has(p.id));
        return [...fresh, ...prev];
      });
      if (rows.length > 0) newestAtRef.current = rows[0].created_at;
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      // Best-effort; the next poll will surface them again.
    }
  }, []);

  /** Quiet refresh used by pull-to-refresh and the refresh button. */
  const doRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(true);
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  // Pull-to-refresh on touch devices. Only takes over when the page is
  // scrolled all the way to the top; otherwise the browser scrolls normally.
  useEffect(() => {
    const el = mainRef.current;
    if (!el || !("ontouchstart" in window)) return;
    let startY = 0;
    let active = false;

    const onStart = (e: TouchEvent) => {
      const atTop = (window.scrollY || document.documentElement.scrollTop) <= 0;
      if (atTop && e.touches.length === 1) {
        startY = e.touches[0].clientY;
        active = true;
      }
    };
    const onMove = (e: TouchEvent) => {
      if (!active) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 0) {
        // Pulling down at the very top: show our indicator, not the
        // browser's native pull-to-refresh.
        e.preventDefault();
        const dist = Math.min(dy, 140);
        pullDistRef.current = dist;
        setPulling(true);
        setPullDist(dist);
      } else {
        active = false;
        pullDistRef.current = 0;
        setPulling(false);
        setPullDist(0);
      }
    };
    const onEnd = () => {
      if (!active) return;
      active = false;
      const dist = pullDistRef.current;
      pullDistRef.current = 0;
      setPulling(false);
      setPullDist(0);
      if (dist >= PULL_THRESHOLD) void doRefresh();
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [doRefresh]);

  function handleShare(post: PostRow) {
    // Never expose the author of an anonymous post, even in share drafts.
    // Usernames stay private — use the display name instead.
    const handle =
      !post.is_anonymous && post.profiles?.full_name
        ? post.profiles.full_name
        : "someone";
    setShareDraft({
      text: `Reposted from ${handle}:\n${post.content ?? ""}`,
      nonce: Date.now(),
    });
    setComposerOpen(true);
  }

  function handlePosted() {
    setShareDraft(null);
    setComposerOpen(false);
    void load();
  }

  const firstName =
    (currentProfile?.full_name || currentProfile?.username || "")
      .trim()
      .split(/\s+/)[0] || "there";

  const refreshIcon = (
    <svg
      className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 10a7 7 0 1 1-2.05-4.95M17 3v4h-4" />
    </svg>
  );

  return (
    <main
      ref={mainRef}
      className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-3 overscroll-y-contain bg-[#F5F4FA] px-3 py-3 sm:px-4 lg:bg-transparent"
    >
      {/* Pull-to-refresh indicator (touch devices). */}
      {(pulling || refreshing) && (
        <div
          className="flex items-center justify-center overflow-hidden"
          style={{ height: refreshing ? 44 : pullDist }}
          aria-live="polite"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-[#6F6B80]">
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-[#4F46E5] border-t-transparent" />
            {refreshing
              ? "Refreshing..."
              : pullDist >= PULL_THRESHOLD
                ? "Release to refresh"
                : "Pull to refresh"}
          </div>
        </div>
      )}

      {/* Mobile-only branding: desktop already has the top header. */}
      <header className="flex items-center gap-2.5 px-1 lg:hidden">
        <Image
          src="/logo.webp"
          alt="Chowk"
          width={36}
          height={36}
          className="h-9 w-9 rounded-lg object-cover"
        />
        <h1 className="text-xl font-bold text-[#211D33]">Chowk</h1>
        <button
          type="button"
          onClick={() => void doRefresh()}
          disabled={refreshing}
          aria-label="Refresh feed"
          title="Refresh feed"
          className="ml-auto flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-[#6F6B80] transition-colors hover:bg-neutral-200 hover:text-[#211D33] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {refreshIcon}
        </button>
      </header>

      {currentUserId && (
        <>
          {/* Warm campus greeting + safe-space reassurance. */}
          <WelcomeBanner />
          {/* Live campus activity, from real data only. */}
          <CampusPulse />
          {/* Chowk composer card: opens the Create post modal. */}
          <ComposerCard
            avatar={
              <Link
                href="/profile"
                aria-label="Your profile"
                className="shrink-0 cursor-pointer rounded-full transition-opacity hover:opacity-90"
              >
                <Avatar
                  name={currentProfile?.full_name || currentProfile?.username || "?"}
                />
              </Link>
            }
            firstName={firstName}
            onOpen={() => setComposerOpen(true)}
            onOpenWithPhotos={() => {
              setPhotoNonce((n) => n + 1);
              setComposerOpen(true);
            }}
            onOpenAnonymous={() => {
              setAnonymousNonce((n) => n + 1);
              setComposerOpen(true);
            }}
          />
          {/* Recent photo/video posts, Chowk-style horizontal strip.
              Derives from the feed's already-filtered posts, so visibility
              rules are identical to the feed. */}
          <CampusMoments
            posts={posts}
            onAddMoment={() => {
              setPhotoNonce((n) => n + 1);
              setComposerOpen(true);
            }}
          />
          <PostComposerModal
            open={composerOpen}
            onClose={() => setComposerOpen(false)}
            onPosted={handlePosted}
            authorProfile={currentProfile}
            shareDraft={shareDraft}
            photoNonce={photoNonce}
            anonymousNonce={anonymousNonce}
          />
        </>
      )}

      {/* Friend suggestions appear after the 3rd post, not at the top. */}
      {error && (
        <div className="rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-neutral-200">
          <p className="text-sm text-[#6F6B80]">Loading your feed...</p>
        </div>
      ) : (
        currentUserId &&
        !error && (
          <FeedList
            posts={posts}
            currentUserId={currentUserId}
            currentProfile={currentProfile}
            onShare={handleShare}
            emptyTitle="Your campus is just getting started"
            emptySubtitle="Be one of the first to share something — or invite a classmate to join Chowk."
            injectedAfterIndex={2}
            injectedSlot={<PeopleYouMayKnow />}
          />
        )
      )}

      {pendingNewIds.length > 0 && (
        <NewPostsPill count={pendingNewIds.length} onTap={() => void showNewPosts()} />
      )}
    </main>
  );
}
