"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { isFollowing, setFollowing } from "@/lib/follows";

/**
 * Follow / Following toggle for another user's profile.
 * Renders nothing if the follows table isn't available yet.
 */
export function FollowButton({
  me,
  targetId,
  onChanged,
}: {
  me: string;
  targetId: string;
  onChanged?: () => void;
}) {
  const [following, setFollowingState] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      const state = await isFollowing(supabase, me, targetId);
      if (!cancelled && state !== null) setFollowingState(state);
    })();
    return () => {
      cancelled = true;
    };
  }, [me, targetId]);

  async function toggle() {
    if (following === null || busy) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setBusy(true);
    const ok = await setFollowing(supabase, me, targetId, !following);
    if (ok) {
      setFollowingState(!following);
      onChanged?.();
    }
    setBusy(false);
  }

  if (following === null) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className={
        following
          ? "cursor-pointer rounded-full px-6 py-2 text-sm font-semibold text-[#211D33] ring-1 ring-neutral-300 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
          : "cursor-pointer rounded-full bg-[#4F46E5] px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#4338CA] disabled:cursor-not-allowed disabled:opacity-50"
      }
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}

/** "120 followers · 80 following" line. Renders nothing if unavailable. */
export function FollowCountsLine({ userId }: { userId: string }) {
  const [counts, setCounts] = useState<{
    followers: number;
    following: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      const { getFollowCounts } = await import("@/lib/follows");
      const c = await getFollowCounts(supabase, userId);
      if (!cancelled && c) setCounts(c);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!counts) return null;
  return (
    <p className="mt-1.5 text-sm text-[#6F6B80]">
      <span className="font-semibold text-[#211D33]">{counts.followers}</span>{" "}
      followers <span className="text-neutral-300">·</span>{" "}
      <span className="font-semibold text-[#211D33]">{counts.following}</span>{" "}
      following
    </p>
  );
}
