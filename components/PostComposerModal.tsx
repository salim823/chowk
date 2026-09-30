"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getAcceptedFriendIds } from "@/lib/friends";
import { notify } from "@/lib/notify";
import {
  MAX_VIDEO_BYTES,
  isImageFile,
  videoExtensionFor,
} from "@/lib/media";
import { Avatar } from "@/components/Avatar";
import type { ProfileLite } from "@/lib/types";

const MAX_MEDIA = 4;

type PickedMedia = { file: File; preview: string; kind: "image" | "video" };

export type ShareDraft = { text: string; nonce: number };

type PostComposerModalProps = {
  open: boolean;
  onClose: () => void;
  onPosted: () => void;
  /** Prefills the composer when the user shares a post. */
  shareDraft?: ShareDraft | null;
  /** Used to notify friends (and name the author) after posting. */
  authorProfile?: ProfileLite | null;
  /**
   * When set (>0), the photo picker opens automatically with the modal
   * (used by the "Photo/video" action row).
   */
  photoNonce?: number;
  /**
   * Optional: called right after the photoNonce auto-open fires, so the
   * parent can reset its nonce. Not required — the modal also guards with
   * consumedNonceRef so each nonce value auto-opens at most once.
   */
  onPhotoNonceConsumed?: () => void;
  /**
   * When set (>0), the composer opens with "Post anonymously" pre-enabled
   * (used by the composer's Anonymous action). One-shot, like photoNonce.
   */
  anonymousNonce?: number;
};

function PhotoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function FriendsIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function SmileIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" x2="9.01" y1="9" y2="9" />
      <line x1="15" x2="15.01" y1="9" y2="9" />
    </svg>
  );
}

const COMPOSER_EMOJIS = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😎",
  "🤔", "😅", "😭", "😡", "👍", "👎", "🙏", "👏",
  "💪", "🔥", "❤️", "💔", "💯", "✨", "🎉", "🥳",
  "😴", "🤯", "🥺", "😇", "🤗", "🫡", "👌", "✌️",
  "🤝", "💖", "💙", "💚", "🖤", "🤍", "😺", "🙈",
  "🙉", "🙊", "👀", "💤", "🌙", "☀️", "🌈", "⚽",
];

/**
 * Chowk-style "Create post" modal. Reused from the feed pill, the profile
 * page, and share flows. Holds the full posting logic (photo upload,
 * audience, anonymous toggle) that used to live in the inline composer.
 */
export function PostComposerModal({
  open,
  onClose,
  onPosted,
  shareDraft,
  authorProfile,
  photoNonce,
  onPhotoNonceConsumed,
  anonymousNonce,
}: PostComposerModalProps) {
  const [content, setContent] = useState("");
  const [picked, setPicked] = useState<PickedMedia[]>([]);
  const [anonymous, setAnonymous] = useState(false);
  const [audience, setAudience] = useState<"everyone" | "friends">("everyone");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const emojiWrapRef = useRef<HTMLSpanElement>(null);

  /** Insert an emoji at the cursor position in the textarea. */
  function insertEmoji(emoji: string) {
    const el = textRef.current;
    if (!el) {
      setContent((c) => c + emoji);
      return;
    }
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const next = content.slice(0, start) + emoji + content.slice(end);
    setContent(next);
    // Restore focus + cursor after the inserted emoji.
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
    setEmojiOpen(false);
  }

  // Close the emoji popover on outside click.
  useEffect(() => {
    if (!emojiOpen) return;
    function onDown(e: PointerEvent) {
      if (emojiWrapRef.current && !emojiWrapRef.current.contains(e.target as Node)) {
        setEmojiOpen(false);
      }
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [emojiOpen]);
  /**
   * Sticky-nonce guard: parents increment photoNonce and never reset it, so
   * without this the 150ms auto-open would fire the file picker on EVERY
   * composer open after the first "Photo/video" tap. Each nonce value is
   * consumed at most once, no parent changes needed.
   */
  const consumedNonceRef = useRef(0);
  const consumedAnonRef = useRef(0);

  // A share request prefills the composer.
  useEffect(() => {
    if (open && shareDraft) setContent(shareDraft.text);
  }, [open, shareDraft]);

  // Every close resets the anonymous flag so the next open starts fresh
  // (the anonymousNonce effect below then opts back in when requested).
  useEffect(() => {
    if (!open) setAnonymous(false);
  }, [open ]);

  // Focus the textarea and lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => textRef.current?.focus(), 60);
    // "Photo/video" action: open the file picker right away (best effort —
    // the user can still tap the photo button inside the modal).
    let pt: number | undefined;
    if (photoNonce && photoNonce !== consumedNonceRef.current) {
      consumedNonceRef.current = photoNonce;
      pt = window.setTimeout(() => {
        const el = document.getElementById(
          "composer-file-input"
        ) as HTMLInputElement | null;
        (el ?? fileInputRef.current)?.click();
        onPhotoNonceConsumed?.();
      }, 150);
    }
    // "Anonymous" action: pre-enable the anonymous toggle (one-shot).
    if (anonymousNonce && anonymousNonce !== consumedAnonRef.current) {
      consumedAnonRef.current = anonymousNonce;
      setAnonymous(true);
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.clearTimeout(t);
      if (pt) window.clearTimeout(pt);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, photoNonce, onPhotoNonceConsumed]);

  if (!open) return null;

  const displayName =
    authorProfile?.full_name || authorProfile?.username || "You";
  const firstName = displayName.trim().split(/\s+/)[0] || "there";

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const problems: string[] = [];
    setPicked((prev) => {
      const next = [...prev];
      for (const file of Array.from(files)) {
        if (next.length >= MAX_MEDIA) {
          problems.push(`You can add up to ${MAX_MEDIA} photos or videos.`);
          break;
        }
        if (isImageFile(file)) {
          next.push({ file, preview: URL.createObjectURL(file), kind: "image" });
          continue;
        }
        const ext = videoExtensionFor(file);
        if (!ext) {
          problems.push(
            `"${file.name}" is not a supported video. Use MP4, WebM or MOV.`
          );
          continue;
        }
        if (file.size > MAX_VIDEO_BYTES) {
          problems.push(
            `"${file.name}" is too big. Videos must be under 50 MB.`
          );
          continue;
        }
        next.push({ file, preview: URL.createObjectURL(file), kind: "video" });
      }
      return next;
    });
    if (problems.length > 0) setError(problems[0]);
  }

  function removePicked(index: number) {
    setPicked((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  function reset() {
    picked.forEach((p) => URL.revokeObjectURL(p.preview));
    setPicked([]);
    setContent("");
    setAnonymous(false);
    setAudience("everyone");
    setError(null);
  }

  async function handlePost() {
    setError(null);
    const text = content.trim();
    if (!text && picked.length === 0) {
      setError("Write something or add a photo or video before posting.");
      return;
    }
    const supabase = getSupabaseClient();
    if (!supabase) {
      setError("The app is not connected to the database yet.");
      return;
    }

    setBusy(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("You are not logged in. Please log in again.");
        return;
      }

      // Upload media first, then store their public URLs on the post.
      // Videos go under <uid>/videos/ (covered by the <uid>/% storage rule).
      const urls: string[] = [];
      for (const { file, kind } of picked) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const rand = Math.random().toString(36).slice(2);
        const path =
          kind === "video"
            ? `${user.id}/videos/${Date.now()}_${rand}.${
                videoExtensionFor(file) ?? "mp4"
              }`
            : `${user.id}/${Date.now()}_${rand}_${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("post-images")
          .upload(path, file);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage.from("post-images").getPublicUrl(path);
        urls.push(data.publicUrl);
      }

      const { data: inserted, error: insertError } = await supabase
        .from("posts")
        .insert({
          user_id: user.id,
          content: text || null,
          image_urls: urls,
          is_anonymous: anonymous,
          audience,
        })
        .select("id")
        .single();
      if (insertError) throw insertError;

      // Tell accepted friends about the new post (fire-and-forget).
      // Anonymous posts do not reveal who posted.
      const postId = (inserted as { id: string } | null)?.id ?? null;
      if (postId) {
        const friendIds = await getAcceptedFriendIds(supabase, user.id, 100);
        const name =
          authorProfile?.full_name || authorProfile?.username || "Someone";
        const title = anonymous
          ? "Someone posted something new"
          : `${name} posted something new`;
        await Promise.all(
          friendIds.map((fid) =>
            notify({ user_id: fid, type: "friend_post", title, post_id: postId })
          )
        );
      }

      reset();
      onClose();
      onPosted();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not publish your post. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  const canPost = (content.trim().length > 0 || picked.length > 0) && !busy;
  const pickerDisabled = busy || picked.length >= MAX_MEDIA;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Create post"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title bar */}
        <div className="relative border-b border-neutral-200 px-4 py-4">
          <h2 className="text-center text-xl font-bold text-[#211D33]">
            Create post
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-neutral-200 text-[#6F6B80] transition-colors hover:bg-neutral-300"
          >
            <XIcon />
          </button>
        </div>

        <div className="overflow-y-auto px-4 py-3">
          {/* Author + audience */}
          <div className="flex items-center gap-3">
            <Avatar
              name={authorProfile?.full_name || authorProfile?.username || "?"}
              avatarUrl={authorProfile?.avatar_url ?? null}
            />
            <div>
              <p className="text-sm font-bold text-[#211D33]">{displayName}</p>
              <label className="mt-0.5 inline-flex cursor-pointer items-center gap-1 rounded-md bg-neutral-200 px-2 py-1 text-xs font-semibold text-[#211D33] transition-colors hover:bg-neutral-300">
                <span className="sr-only">Who can see this post</span>
                {audience === "everyone" ? <GlobeIcon /> : <FriendsIcon />}
                <select
                  value={audience}
                  onChange={(e) =>
                    setAudience(e.target.value as "everyone" | "friends")
                  }
                  className="cursor-pointer bg-transparent font-semibold focus:outline-none"
                >
                  <option value="everyone">Public</option>
                  <option value="friends">Friends</option>
                </select>
              </label>
            </div>
          </div>

          {/* Big textarea */}
          <textarea
            ref={textRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onPaste={(e) => {
              const files = e.clipboardData?.files;
              if (files && files.length > 0) {
                const media = Array.from(files).filter(
                  (f) => f.type.startsWith("image/") || f.type.startsWith("video/")
                );
                if (media.length > 0) {
                  e.preventDefault();
                  const dt = new DataTransfer();
                  media.forEach((f) => dt.items.add(f));
                  handleFiles(dt.files);
                }
              }
            }}
            maxLength={2000}
            placeholder={`What's on your mind, ${firstName}?`}
            rows={4}
            className="mt-3 min-h-[110px] w-full resize-none text-xl text-[#211D33] placeholder:text-[#6F6B80] focus:outline-none"
          />

          {/* Media previews */}
          {picked.length > 0 && (
            <div className="mt-2 grid grid-cols-4 gap-2">
              {picked.map((p, i) => (
                <div key={p.preview} className="relative aspect-square">
                  {p.kind === "video" ? (
                    <>
                      <video
                        src={p.preview}
                        preload="metadata"
                        muted
                        playsInline
                        className="h-full w-full rounded-lg bg-black object-cover ring-1 ring-neutral-200"
                      />
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0 flex items-center justify-center"
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff">
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </span>
                      </span>
                    </>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={p.preview}
                      alt={`Selected photo ${i + 1}`}
                      className="h-full w-full rounded-lg object-cover ring-1 ring-neutral-200"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => removePicked(i)}
                    aria-label={`Remove ${p.kind} ${i + 1}`}
                    className="absolute -right-1.5 -top-1.5 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white transition-colors hover:bg-neutral-700"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Anonymous toggle */}
          <button
            type="button"
            role="switch"
            aria-checked={anonymous}
            onClick={() => setAnonymous((v) => !v)}
            className="mt-2 flex cursor-pointer items-center gap-2 py-1 text-sm font-semibold text-[#211D33] transition-opacity hover:opacity-80"
          >
            <span
              className={`flex h-5 w-9 items-center rounded-full px-0.5 transition-colors ${
                anonymous
                  ? "justify-end bg-[#4F46E5]"
                  : "justify-start bg-neutral-300"
              }`}
            >
              <span className="h-4 w-4 rounded-full bg-white shadow" />
            </span>
            Post anonymously
          </button>

          {/* Add to your post */}
          <div className="mt-3">
            <input
              ref={fileInputRef}
              id="composer-file-input"
              type="file"
              accept="image/*,video/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <div
              className={`flex w-full items-center justify-between rounded-lg border border-neutral-300 px-4 py-3 text-sm font-semibold text-[#211D33] transition-colors ${
                pickerDisabled ? "pointer-events-none opacity-40" : ""
              }`}
            >
              Add to your post
              <span className="flex items-center gap-2">
                <span ref={emojiWrapRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setEmojiOpen((v) => !v)}
                    title="Emoji"
                    aria-label="Add emoji"
                    className="block cursor-pointer rounded-full p-1 text-[#6F6B80] transition-colors hover:bg-neutral-200"
                  >
                    <SmileIcon />
                  </button>
                  {emojiOpen ? (
                    <div className="absolute bottom-9 right-0 z-30 grid w-64 grid-cols-8 gap-0.5 rounded-xl bg-white p-2 shadow-xl ring-1 ring-neutral-200">
                      {COMPOSER_EMOJIS.map((e) => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => insertEmoji(e)}
                          aria-label={`Insert ${e} emoji`}
                          className="cursor-pointer rounded-lg p-1 text-xl leading-none transition-colors hover:bg-neutral-100"
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </span>
                <label
                  htmlFor="composer-file-input"
                  className="flex cursor-pointer items-center gap-1 text-[#4F46E5]"
                >
                  <span aria-hidden className="flex items-center gap-1">
                    <PhotoIcon />
                    <span className="text-xs font-bold text-[#6F6B80]">
                      Photo/video
                      {picked.length > 0
                        ? ` (${picked.length}/${MAX_MEDIA})`
                        : ""}
                    </span>
                  </span>
                </label>
              </span>
            </div>
          </div>

          {error && (
            <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
              {error}
            </p>
          )}
        </div>

        {/* Post button */}
        <div className="border-t border-neutral-200 px-4 py-3">
          <button
            type="button"
            onClick={handlePost}
            disabled={!canPost}
            className="w-full cursor-pointer rounded-lg bg-[#4F46E5] py-2.5 text-base font-bold text-white transition-colors hover:bg-[#4338CA] disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-[#6F6B80]"
          >
            {busy ? "Posting..." : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
}
