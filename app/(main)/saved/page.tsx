"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getSavedPostIds } from "@/lib/saved";
import { FeedList } from "@/components/FeedList";
import type { PostRow, ProfileLite } from "@/lib/types";

export default function SavedPage() {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentProfile, setCurrentProfile] = useState<ProfileLite | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError("The app is not connected to the database yet.");
      setLoading(false);
      return;
    }
    setLoading(true);
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

      const { data: profile } = await supabase
        .from("profiles")
        .select("username, full_name, avatar_url")
        .eq("id", user.id)
        .single();
      setCurrentProfile((profile as ProfileLite | null) ?? null);

      const ids = await getSavedPostIds(supabase, user.id);
      if (ids === null || ids.length === 0) {
        // Table missing or nothing saved: show the empty state, not an error.
        setPosts([]);
        return;
      }
      const { data: postRows, error: postError } = await supabase
        .from("posts")
        .select("*, profiles!posts_user_id_fkey(username, full_name, avatar_url)")
        .in("id", ids);
      if (postError) throw postError;
      const byId = new Map(
        ((postRows ?? []) as PostRow[]).map((p) => [p.id, p])
      );
      // Newest-saved first; skip posts that no longer exist.
      setPosts(
        ids.map((id) => byId.get(id)).filter((p): p is PostRow => !!p)
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not load your saved posts. Please retry."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-3 bg-[#F5F4FA] px-3 py-3 sm:px-4 lg:bg-transparent">
      <h1 className="px-1 text-xl font-bold text-[#211D33]">Saved</h1>

      {error && (
        <div className="rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-neutral-200">
          <p className="text-sm text-[#6F6B80]">Loading saved posts...</p>
        </div>
      ) : (
        currentUserId &&
        !error && (
          <FeedList
            posts={posts}
            currentUserId={currentUserId}
            currentProfile={currentProfile}
            emptyTitle="No saved posts yet."
            emptySubtitle="Tap the three dots on any post and choose Save post to find it here later."
          />
        )
      )}
    </main>
  );
}
