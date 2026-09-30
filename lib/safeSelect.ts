import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Resilient select helper.
 *
 * Some Chowk migrations (cover.sql, pin.sql, comment_audience.sql) may not
 * have been run yet, so selects that name the new columns
 * (cover_url, pinned_post_id, comment_audience) can fail with a
 * "column does not exist" error (Postgres 42703). This helper runs the full
 * select first and, only when the failure is a missing-column error, retries
 * with the fallback columns — so the feed, profiles, and saved page keep
 * working with or without the migrations.
 */

export function isMissingColumnError(error: unknown): boolean {
  const e = error as PostgrestError | null;
  if (!e) return false;
  if (e.code === "42703") return true;
  return /column .* does not exist/i.test(e.message ?? "");
}

type SelectResult<T> = { data: T | null; error: PostgrestError | null };

/**
 * Runs `full()`; if it fails solely because a column is missing, runs
 * `fallback()` instead. Any other error is returned as-is.
 */
export async function selectWithFallback<T>(
  full: () => PromiseLike<SelectResult<T>>,
  fallback: () => PromiseLike<SelectResult<T>>
): Promise<SelectResult<T>> {
  const first = await Promise.resolve(full());
  if (first.error && isMissingColumnError(first.error)) {
    return Promise.resolve(fallback());
  }
  return first;
}

/**
 * Explicit FK hint for the posts -> profiles (author) embed.
 *
 * pin.sql adds profiles.pinned_post_id -> posts(id), which gives PostgREST
 * two relationships between posts and profiles and makes a bare
 * `profiles(...)` embed fail with PGRST201 ("Could not load the feed").
 * This hint keeps the embed working whether or not pin.sql was run.
 */
export const POST_AUTHOR_EMBED = "profiles!posts_user_id_fkey";
