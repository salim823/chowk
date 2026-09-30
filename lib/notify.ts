import { getSupabaseClient } from "./supabaseClient";

export type NotificationInput = {
  user_id: string;
  type: "reaction" | "comment" | "friend_request" | "friend_post";
  title: string;
  post_id?: string | null;
};

/**
 * Best-effort notification insert. Never throws, so a failed notification
 * can never break the action (react, comment, post, friend request) that
 * triggered it.
 */
export async function notify(input: NotificationInput): Promise<void> {
  try {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    await supabase.from("notifications").insert({
      user_id: input.user_id,
      type: input.type,
      title: input.title,
      post_id: input.post_id ?? null,
    });
  } catch {
    // Notifications are fire-and-forget.
  }
}
