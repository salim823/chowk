import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared avatar helpers. Avatars live in the existing `post-images`
 * storage bucket under `avatars/<userId>/...`.
 */

/** Uploads an image file as the user's avatar; returns the public URL. */
export async function uploadAvatarFile(
  client: SupabaseClient,
  profileId: string,
  file: File
): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `avatars/${profileId}/${Date.now()}_${safeName}`;
  const { error: uploadError } = await client.storage
    .from("post-images")
    .upload(path, file);
  if (uploadError) throw uploadError;
  const { data } = client.storage.from("post-images").getPublicUrl(path);
  const { error: updateError } = await client
    .from("profiles")
    .update({ avatar_url: data.publicUrl })
    .eq("id", profileId);
  if (updateError) throw updateError;
  return data.publicUrl;
}

/** Removes the user's avatar (falls back to the initial letter). */
export async function removeAvatar(
  client: SupabaseClient,
  profileId: string
): Promise<void> {
  const { error } = await client
    .from("profiles")
    .update({ avatar_url: null })
    .eq("id", profileId);
  if (error) throw error;
}
