/**
 * Per-user 7-day post hiding ("Hide this post for me").
 *
 * The X button on someone else's post records a row in `hidden_posts` with
 * hidden_until = now + 7 days. Feed/explore/sidebar queries exclude hidden
 * posts, so the post automatically reappears after 7 days. Nothing is
 * deleted from `posts`; other users are unaffected.
 *
 * Requires supabase/hidden_posts.sql to have been run once.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const HIDE_DAYS = 7;

/** Post ids the user hid that are still within the 7-day window. */
export async function getHiddenPostIds(
  supabase: SupabaseClient,
  userId: string
): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from("hidden_posts")
      .select("post_id")
      .eq("user_id", userId)
      .gt("hidden_until", new Date().toISOString());
    if (error) return new Set();
    return new Set(((data ?? []) as { post_id: string }[]).map((r) => r.post_id));
  } catch {
    return new Set();
  }
}

/** Hide a post for the user for 7 days. Re-hiding refreshes the window. */
export async function hidePostFor7Days(
  supabase: SupabaseClient,
  userId: string,
  postId: string
): Promise<void> {
  const hiddenUntil = new Date(
    Date.now() + HIDE_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const { error } = await supabase.from("hidden_posts").upsert(
    { user_id: userId, post_id: postId, hidden_until: hiddenUntil },
    { onConflict: "user_id,post_id" }
  );
  if (error) throw error;
}
