import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Saved-post helpers. Fail SAFE: if the `saved_posts` table does not exist
 * yet (SQL not run), they return null/false and the UI hides the Save
 * feature instead of crashing.
 */

export async function isSaved(
  supabase: SupabaseClient,
  userId: string,
  postId: string
): Promise<boolean | null> {
  try {
    const { data, error } = await supabase
      .from("saved_posts")
      .select("id")
      .eq("user_id", userId)
      .eq("post_id", postId)
      .maybeSingle();
    if (error) return null;
    return !!data;
  } catch {
    return null;
  }
}

export async function toggleSave(
  supabase: SupabaseClient,
  userId: string,
  postId: string,
  save: boolean
): Promise<boolean> {
  try {
    if (save) {
      const { error } = await supabase
        .from("saved_posts")
        .insert({ user_id: userId, post_id: postId });
      return !error;
    }
    const { error } = await supabase
      .from("saved_posts")
      .delete()
      .eq("user_id", userId)
      .eq("post_id", postId);
    return !error;
  } catch {
    return false;
  }
}

/** Saved post ids, newest-saved first. Null when the table is missing. */
export async function getSavedPostIds(
  supabase: SupabaseClient,
  userId: string
): Promise<string[] | null> {
  try {
    const { data, error } = await supabase
      .from("saved_posts")
      .select("post_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) return null;
    return (data ?? []).map((r) => (r as { post_id: string }).post_id);
  } catch {
    return null;
  }
}
