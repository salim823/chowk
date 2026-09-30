import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Follow helpers. Every function fails SAFE: if the `follows` table does not
 * exist yet (SQL not run), they return null/false and the UI hides the
 * Follow feature instead of crashing.
 */

export type FollowCounts = { followers: number; following: number };

export async function getFollowCounts(
  supabase: SupabaseClient,
  userId: string
): Promise<FollowCounts | null> {
  try {
    const [a, b] = await Promise.all([
      supabase
        .from("follows")
        .select("id", { count: "exact", head: true })
        .eq("following_id", userId),
      supabase
        .from("follows")
        .select("id", { count: "exact", head: true })
        .eq("follower_id", userId),
    ]);
    if (a.error || b.error) return null;
    return { followers: a.count ?? 0, following: b.count ?? 0 };
  } catch {
    return null;
  }
}

export async function isFollowing(
  supabase: SupabaseClient,
  me: string,
  target: string
): Promise<boolean | null> {
  try {
    const { data, error } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", me)
      .eq("following_id", target)
      .maybeSingle();
    if (error) return null;
    return !!data;
  } catch {
    return null;
  }
}

export async function setFollowing(
  supabase: SupabaseClient,
  me: string,
  target: string,
  follow: boolean
): Promise<boolean> {
  try {
    if (follow) {
      const { error } = await supabase
        .from("follows")
        .insert({ follower_id: me, following_id: target });
      return !error;
    }
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", me)
      .eq("following_id", target);
    return !error;
  } catch {
    return false;
  }
}
