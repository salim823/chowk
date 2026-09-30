/**
 * Shared media helpers for post attachments.
 *
 * Post media is stored as public URLs in `posts.image_urls` (text[]).
 * Videos are uploaded under `<uid>/videos/<uuid>.<ext>` in the same
 * `post-images` storage bucket (the `<uid>/%` folder rule in
 * security_lock.sql already covers that path), so no DB migration is
 * needed — the media type is derived from the URL.
 */

/** Max allowed size per video upload (50 MB). */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

/** Video MIME types accepted by the composer. */
export const VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

/** Video file extensions accepted by the composer. */
export const VIDEO_EXTENSIONS = ["mp4", "webm", "mov"] as const;

/** True when a stored post-media URL points to a video. */
export function isVideoUrl(url: string): boolean {
  return (
    /\/videos\//i.test(url) || /\.(mp4|webm|mov)(\?|#|$)/i.test(url)
  );
}

/**
 * Returns the canonical extension for an uploadable video file, or null
 * when the file is not an accepted video (mp4 / webm / mov).
 */
export function videoExtensionFor(file: File): string | null {
  const t = (file.type || "").toLowerCase();
  if (t === "video/mp4") return "mp4";
  if (t === "video/webm") return "webm";
  if (t === "video/quicktime") return "mov";
  // Some mobile browsers report an empty/generic type — fall back to the
  // file extension so gallery picks still work.
  const m = file.name.toLowerCase().match(/\.([a-z0-9]+)$/);
  if (m && (VIDEO_EXTENSIONS as readonly string[]).includes(m[1])) return m[1];
  return null;
}

/** True when the file is an image the composer accepts. */
export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}
