"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Avatar as SharedAvatar } from "@/components/Avatar";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { isFollowing, setFollowing } from "@/lib/follows";
import { notify } from "@/lib/notify";
import { isSaved, toggleSave } from "@/lib/saved";
import { isMuted, setMuted } from "@/lib/muted";
import { isVideoUrl } from "@/lib/media";
import { timeAgo } from "@/lib/time";
import { ReportDialog } from "./ReportDialog";
import { ReactionsModal } from "./ReactionsModal";
import { VideoPlayer } from "./VideoPlayer";
import { ChowkModal, ChowkModalButton } from "./ChowkModal";
import type {
  CommentLikeRow,
  CommentRow,
  PostRow,
  ProfileLite,
  ReactionRow,
} from "@/lib/types";

/** The six Chowk-style reactions (a user feature, not UI chrome). */
const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "😠"];

/** Label shown on the Like button when a reaction is active. */
const REACTION_LABELS: Record<string, string> = {
  "👍": "Like",
  "❤️": "Love",
  "😂": "Laugh",
  "😮": "Wow",
  "😢": "Sad",
  "😠": "Angry",
};

/** Chowk badge background for each reaction (summary row + active Like button). */
const REACTION_BG: Record<string, string> = {
  "👍": "bg-[#4F46E5]",
  "❤️": "bg-[#E41E3F]",
  "😂": "bg-[#F7B500]",
  "😮": "bg-[#F7B500]",
  "😢": "bg-[#F7B500]",
  "😠": "bg-[#E9710F]",
};

/** Chowk label color for the Like button when a reaction is active. */
const REACTION_TEXT: Record<string, string> = {
  "👍": "text-[#4F46E5]",
  "❤️": "text-[#E41E3F]",
  "😂": "text-[#B8860B]",
  "😮": "text-[#B8860B]",
  "😢": "text-[#B8860B]",
  "😠": "text-[#E9710F]",
};

/** Emoji grid for the comment-box picker (functional, not decorative). */
const COMMENT_EMOJIS = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😎",
  "🤔", "😅", "😭", "😡", "👍", "👎", "🙏", "👏",
  "💪", "🔥", "❤️", "💔", "💯", "✨", "🎉", "🥳",
  "😴", "🤯", "🥺", "😇", "🤗", "🫡", "👌", "✌️",
  "🤝", "💖", "💙", "💚", "🖤", "🤍", "😺", "🙈",
  "🙉", "🙊", "👀", "💤", "🌙", "☀️", "🌈", "⚽",
];

/** Comment photo with tap-to-enlarge (same lightbox pattern as MediaGrid). */
function CommentImage({ url }: { url: string }) {
  const [lightbox, setLightbox] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setLightbox(true)}
        className="mt-2 block cursor-pointer overflow-hidden rounded-xl transition-opacity hover:opacity-95"
        aria-label="View comment photo full screen"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="Comment photo"
          loading="lazy"
          className="max-h-48 rounded-xl object-cover ring-1 ring-neutral-200"
        />
      </button>
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/85 p-4 transition-colors hover:bg-black/80"
          onClick={() => setLightbox(false)}
          role="dialog"
          aria-label="Photo viewer"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="Comment photo full screen"
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </>
  );
}

function ThumbIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 10v12" />
      <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
    </svg>
  );
}

function CommentBubbleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ShareArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function Avatar({
  name,
  anonymous,
  avatarUrl,
  lazy = false,
}: {
  name: string;
  anonymous: boolean;
  avatarUrl?: string | null;
  lazy?: boolean;
}) {
  const initial = anonymous
    ? "?"
    : name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div
      className={`relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-base font-bold text-white ${
        anonymous ? "bg-neutral-400" : "bg-[#4F46E5]"
      }`}
    >
      {initial}
      {!anonymous && avatarUrl && (
        <img
          src={avatarUrl}
          alt={name}
          loading={lazy ? "lazy" : undefined}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </div>
  );
}

/** Three horizontal dots, like Chowk's post menu button. */
function DotsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

function MinusCircleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8" />
    </svg>
  );
}

function BookmarkIcon({ filled = false }: { filled?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" x2="4" y1="22" y2="15" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16h14v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function BellOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8.7 3A6 6 0 0 1 18 8c0 7 3 9 3 9h-9.4" />
      <path d="M6.3 6.3C6.1 6.7 6 7.3 6 8c0 7-3 9-3 9h14" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

function SpeechIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  );
}

function SmileIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" x2="9.01" y1="9" y2="9" />
      <line x1="15" x2="15.01" y1="9" y2="9" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function GlobeSmallIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function FriendsSmallIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

/** One row of the ··· dropdown, Chowk style: icon in a gray circle + label. */
function MenuItem({
  icon,
  label,
  onClick,
  danger = false,
  disabled = false,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full cursor-pointer items-center gap-3 px-4 py-2 text-left text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        danger
          ? "text-red-600 hover:bg-red-50"
          : "text-[#211D33] hover:bg-[#F5F4FA]"
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          danger ? "bg-red-100 text-red-600" : "bg-[#E6E3F0] text-[#211D33]"
        }`}
      >
        {icon}
      </span>
      {label}
    </button>
  );
}

/** Mixed photo/video grid. Photos open full-screen on tap; videos play
 * inline with the Chowk-style VideoPlayer (autoplay muted on scroll).
 * FB style: media bleeds edge-to-edge of the card. */
function MediaGrid({ urls }: { urls: string[] }) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  const shown = urls.slice(0, 4);
  const gridClass =
    shown.length === 1 ? "grid-cols-1" : "grid-cols-2";
  const tileClass =
    shown.length === 1 ? "aspect-video" : "aspect-square";

  return (
    <>
      <div className={`-mx-4 mt-3 grid gap-0.5 ${gridClass}`}>
        {shown.map((url, i) =>
          isVideoUrl(url) ? (
            <div key={url} className={`overflow-hidden ${tileClass}`}>
              <VideoPlayer url={url} />
            </div>
          ) : (
            <button
              key={url}
              type="button"
              onClick={() => setLightbox(url)}
              className={`cursor-pointer overflow-hidden transition-opacity hover:opacity-95 ${tileClass}`}
              aria-label={`View photo ${i + 1} full screen`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Post photo ${i + 1}`}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </button>
          )
        )}
      </div>
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/85 p-4 transition-colors hover:bg-black/80"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-label="Photo viewer"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox}
            alt="Post photo full screen"
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        </div>
      )}
    </>
  );
}

/** Chowk-style "· Follow" / "· Following" text-button in post headers. */
function PostHeaderFollow({
  me,
  targetId,
}: {
  me: string;
  targetId: string;
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

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (following === null || busy) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setBusy(true);
    const ok = await setFollowing(supabase, me, targetId, !following);
    if (ok) setFollowingState(!following);
    setBusy(false);
  }

  // Follows table unavailable (SQL not run): render nothing, never a dead button.
  if (following === null) return null;

  return (
    <>
      <span aria-hidden className="font-normal text-neutral-400">
        {" "}
        ·{" "}
      </span>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={
          following
            ? "cursor-pointer text-sm font-semibold text-[#6F6B80] transition-colors hover:underline disabled:cursor-not-allowed disabled:opacity-50"
            : "cursor-pointer text-sm font-semibold text-[#4F46E5] transition-colors hover:underline disabled:cursor-not-allowed disabled:opacity-50"
        }
      >
        {following ? "Following" : "Follow"}
      </button>
    </>
  );
}

type PostCardProps = {
  post: PostRow;
  currentUserId: string;
  currentProfile: ProfileLite | null;
  initialReactions: ReactionRow[];
  initialComments: CommentRow[];
  /** Comment likes loaded in bulk (empty until comment_engagement.sql runs). */
  initialCommentLikes: CommentLikeRow[];
  /** False when the comment_likes table is missing; hides comment likes. */
  commentLikesSupported: boolean;
  /** False when comments.parent_id is missing; hides replies. */
  repliesSupported: boolean;
  onDeleted: (postId: string) => void;
  onShare?: (post: PostRow) => void;
  /** Hide this post from the list (used for "Not interested"). */
  onHidden?: (postId: string) => void;
  /** Accepted friend ids, used for "Who can comment = Friends". */
  friendIds?: Set<string>;
  /** Post id pinned on the author's profile (shows the "Pinned post" label). */
  pinnedPostId?: string | null;
  /** Called after pin/unpin so parents can reorder. */
  onPinChanged?: (postId: string, pinned: boolean) => void;
};

export function PostCard({
  post,
  currentUserId,
  currentProfile,
  initialReactions,
  initialComments,
  initialCommentLikes,
  commentLikesSupported,
  repliesSupported,
  onDeleted,
  onShare,
  onHidden,
  friendIds,
  pinnedPostId,
  onPinChanged,
}: PostCardProps) {
  const [reactions, setReactions] = useState<ReactionRow[]>(initialReactions);
  const [showReactors, setShowReactors] = useState(false);
  const [comments, setComments] = useState<CommentRow[]>(initialComments);
  const [commentLikes, setCommentLikes] =
    useState<CommentLikeRow[]>(initialCommentLikes);
  /**
   * P0 FIX: FeedList fetches reactions/comments AFTER first render, so
   * useState(initialX) alone would ignore the fetched rows forever and
   * likes/comments would "disappear on refresh" (they were in the DB all
   * along). Sync when the bulk-loaded props arrive, preserving any
   * just-made local rows that a stale fetch snapshot may not include yet.
   */
  useEffect(() => {
    setReactions((prev) => {
      const mine = prev.find((r) => r.user_id === currentUserId);
      if (mine && !initialReactions.some((r) => r.user_id === currentUserId)) {
        return [...initialReactions, mine];
      }
      return initialReactions;
    });
  }, [initialReactions, currentUserId]);
  useEffect(() => {
    setComments((prev) => {
      const serverIds = new Set(initialComments.map((c) => c.id));
      const localOnly = prev.filter((c) => !serverIds.has(c.id));
      return localOnly.length > 0
        ? [...initialComments, ...localOnly]
        : initialComments;
    });
  }, [initialComments]);
  useEffect(() => {
    setCommentLikes((prev) => {
      const serverIds = new Set(initialCommentLikes.map((l) => l.id));
      const localOnly = prev.filter((l) => !serverIds.has(l.id));
      return localOnly.length > 0
        ? [...initialCommentLikes, ...localOnly]
        : initialCommentLikes;
    });
  }, [initialCommentLikes]);
  /** Surfaces save failures instead of failing silently. */
  const [actionError, setActionError] = useState<string | null>(null);
  function showActionError(message: string) {
    setActionError(message);
    window.setTimeout(() => {
      setActionError((cur) => (cur === message ? null : cur));
    }, 4000);
  }
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  /** Comment-box emoji picker + photo attach. */
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [commentPhoto, setCommentPhoto] = useState<{
    file: File;
    preview: string;
  } | null>(null);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const commentFileRef = useRef<HTMLInputElement>(null);
  const emojiWrapRef = useRef<HTMLSpanElement>(null);

  // Close the emoji popover on outside tap/click.
  useEffect(() => {
    if (!emojiOpen) return;
    const onDown = (e: PointerEvent) => {
      if (
        emojiWrapRef.current &&
        !emojiWrapRef.current.contains(e.target as Node)
      ) {
        setEmojiOpen(false);
      }
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [emojiOpen]);

  /** Insert an emoji at the cursor position of the comment input. */
  function insertEmoji(emoji: string) {
    const input = commentInputRef.current;
    const start = input?.selectionStart ?? commentText.length;
    const end = input?.selectionEnd ?? commentText.length;
    setCommentText(
      commentText.slice(0, start) + emoji + commentText.slice(end)
    );
    setEmojiOpen(false);
    requestAnimationFrame(() => {
      input?.focus();
      const pos = start + emoji.length;
      try {
        input?.setSelectionRange(pos, pos);
      } catch {
        /* input may be unmounted; ignore */
      }
    });
  }

  /** Single-photo attach for comments (images only). */
  function handleCommentFile(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showActionError("Please choose an image file.");
      return;
    }
    setCommentPhoto((prev) => {
      if (prev) URL.revokeObjectURL(prev.preview);
      return { file, preview: URL.createObjectURL(file) };
    });
  }

  function removeCommentPhoto() {
    setCommentPhoto((prev) => {
      if (prev) URL.revokeObjectURL(prev.preview);
      return null;
    });
    if (commentFileRef.current) commentFileRef.current.value = "";
  }
  const [pickerOpen, setPickerOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  /** null = unknown (table may not exist yet); the Save item stays hidden then. */
  const [savedState, setSavedState] = useState<boolean | null>(null);
  /** Post settings the owner can change from the ··· menu. */
  const [audience, setAudience] = useState<"everyone" | "friends">(post.audience);
  const [commentAud, setCommentAud] = useState<"everyone" | "friends">(
    post.comment_audience === "friends" ? "friends" : "everyone"
  );
  const [muted, setMutedState] = useState(() => isMuted(post.id));
  /** null = unknown (column may not exist yet); Pin item hidden then. */
  const [isPinned, setIsPinned] = useState<boolean | null>(null);
  /** Which own-post submenu is expanded: comment audience or audience. */
  const [subMenu, setSubMenu] = useState<"comment" | "audience" | null>(null);
  /** "See more" expander for long post text. */
  const [expanded, setExpanded] = useState(false);
  /** Edit-post modal state. */
  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  const isOwn = post.user_id === currentUserId;
  const isPinnedPost = pinnedPostId === post.id;
  const displayName = post.is_anonymous
    ? "Anonymous"
    : post.profiles?.full_name || post.profiles?.username || "Unknown";
  // Author profile link (never for anonymous posts — protects anonymity).
  const authorHref =
    !post.is_anonymous && post.profiles?.username
      ? `/profile/${post.profiles.username}`
      : null;
  const images = post.image_urls ?? [];
  const firstName =
    (currentProfile?.full_name || currentProfile?.username || "")
      .trim()
      .split(/\s+/)[0] || "there";

  /** Who may comment: the author always; friends-only posts need friendship. */
  const canComment =
    isOwn ||
    commentAud === "everyone" ||
    (friendIds?.has(post.user_id) ?? false);

  const myReaction = reactions.find((r) => r.user_id === currentUserId);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of reactions) map.set(r.emoji, (map.get(r.emoji) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [reactions]);

  async function setReaction(emoji: string | null) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const wasNew = !myReaction;
    try {
      if (emoji === null) {
        await supabase
          .from("reactions")
          .delete()
          .eq("post_id", post.id)
          .eq("user_id", currentUserId);
        setReactions((prev) =>
          prev.filter((r) => r.user_id !== currentUserId)
        );
      } else {
        const { error } = await supabase.from("reactions").upsert(
          { post_id: post.id, user_id: currentUserId, emoji },
          { onConflict: "post_id,user_id" }
        );
        if (error) throw error;
        setReactions((prev) => [
          ...prev.filter((r) => r.user_id !== currentUserId),
          {
            id: `local-${post.id}-${currentUserId}`,
            post_id: post.id,
            user_id: currentUserId,
            emoji,
            created_at: new Date().toISOString(),
          },
        ]);
        // Notify the author about a brand-new reaction (not our own post,
        // and never when the post's notifications are muted).
        if (wasNew && post.user_id !== currentUserId && !isMuted(post.id)) {
          const name =
            currentProfile?.full_name ||
            currentProfile?.username ||
            "Someone";
          void notify({
            user_id: post.user_id,
            type: "reaction",
            title: `${name} reacted to your post`,
            post_id: post.id,
          });
        }
      }
    } catch (err) {
      // Surface the failure: the feed reload can no longer "reconcile"
      // something that was never saved.
      console.error("[chowk] reaction failed", err);
      showActionError("Couldn't save your reaction. Please try again.");
    }
  }

  // Reaction picker behavior (Chowk-style):
  // - Desktop (hover-capable): hovering the Like button pops the 6-reaction
  //   palette after a short delay; moving away closes it after a delay.
  // - Click/tap on Like (no pick): instant Like toggle.
  // - Touch long-press (500ms): opens the palette.
  const pressTimer = useRef<number | null>(null);
  const hoverTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);
  const longPressed = useRef(false);
  const hoverCapable = useRef(false);
  const [pickerMode, setPickerMode] = useState<"hover" | "touch" | null>(null);

  useEffect(() => {
    hoverCapable.current =
      typeof window !== "undefined" &&
      window.matchMedia("(hover: hover)").matches;
    return () => {
      if (pressTimer.current !== null) window.clearTimeout(pressTimer.current);
      if (hoverTimer.current !== null) window.clearTimeout(hoverTimer.current);
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    };
  }, []);

  function closePicker() {
    setPickerOpen(false);
    setPickerMode(null);
  }

  function clearPressTimer() {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }

  function cancelCloseTimer() {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function schedulePickerClose() {
    cancelCloseTimer();
    closeTimer.current = window.setTimeout(() => {
      closePicker();
      closeTimer.current = null;
    }, 350);
  }

  function handleLikeAreaEnter() {
    if (!hoverCapable.current || pickerOpen) return;
    cancelCloseTimer();
    if (hoverTimer.current !== null) return;
    hoverTimer.current = window.setTimeout(() => {
      hoverTimer.current = null;
      setPickerMode("hover");
      setPickerOpen(true);
    }, 350);
  }

  function handleLikeAreaLeave() {
    if (hoverTimer.current !== null) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
    if (pickerOpen && pickerMode === "hover") schedulePickerClose();
  }

  function handleLikePointerDown(e: React.PointerEvent) {
    // Touch only: mouse users get the hover palette instead.
    if (e.pointerType !== "touch") return;
    longPressed.current = false;
    clearPressTimer();
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      setPickerMode("touch");
      setPickerOpen(true);
    }, 500);
  }

  function handleLikeClick() {
    clearPressTimer();
    if (longPressed.current) {
      // The long-press already opened the palette; ignore the tap.
      longPressed.current = false;
      return;
    }
    // Direct click/tap = instant Like toggle (no picker needed).
    void setReaction(myReaction ? null : "👍");
  }

  async function handleAddComment() {
    const text = commentText.trim();
    if ((!text && !commentPhoto) || commentBusy) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setCommentBusy(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        showActionError("You are not logged in. Please log in again.");
        return;
      }
      // Upload the attached photo first (bucket rule "<uid>/%" already
      // covers "<uid>/comments/...", no storage policy change needed).
      let imageUrl: string | null = null;
      if (commentPhoto) {
        const safeName = commentPhoto.file.name.replace(
          /[^a-zA-Z0-9._-]/g,
          "_"
        );
        const rand = Math.random().toString(36).slice(2);
        const path = `${user.id}/comments/${Date.now()}_${rand}_${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("post-images")
          .upload(path, commentPhoto.file);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage
          .from("post-images")
          .getPublicUrl(path);
        imageUrl = data.publicUrl;
      }
      // Only send image_url when there is a photo: text-only comments keep
      // working even before comment_images.sql has been run.
      const payload: Record<string, unknown> = {
        post_id: post.id,
        user_id: currentUserId,
        content: text,
      };
      if (imageUrl) payload.image_url = imageUrl;
      const { data, error } = await supabase
        .from("comments")
        .insert(payload)
        .select("*, profiles(username, full_name, avatar_url)")
        .single();
      if (error) throw error;
      const row = data as CommentRow;
      setComments((prev) => [
        ...prev,
        {
          ...row,
          profiles:
            row.profiles ??
            (currentProfile
              ? {
                  username: currentProfile.username,
                  full_name: currentProfile.full_name,
                  avatar_url: currentProfile.avatar_url,
                }
              : null),
        },
      ]);
      setCommentText("");
      removeCommentPhoto();
      // Notify the author about the new comment (not our own post, and
      // never when the post's notifications are muted).
      if (post.user_id !== currentUserId && !isMuted(post.id)) {
        const name =
          currentProfile?.full_name || currentProfile?.username || "Someone";
        const preview = text
          ? text.length > 80
            ? `${text.slice(0, 80)}...`
            : text
          : "shared a photo";
        void notify({
          user_id: post.user_id,
          type: "comment",
          title: `${name} commented: ${preview}`,
          post_id: post.id,
        });
      }
    } catch (err) {
      console.error("[chowk] comment failed", err);
      const message =
        err && typeof err === "object" && "code" in err && err.code === "42703"
          ? "Photo comments need the latest database update. Ask the admin to run comment_images.sql."
          : "Couldn't post your comment. Please try again.";
      showActionError(message);
    } finally {
      setCommentBusy(false);
    }
  }

  /** Reply composer state: which comment is being replied to. */
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);

  /** Top-level comments; replies grouped by parent id (one level, Chowk-style). */
  const topLevelComments = useMemo(
    () => comments.filter((c) => !c.parent_id),
    [comments]
  );
  const repliesByParent = useMemo(() => {
    const map = new Map<string, CommentRow[]>();
    for (const c of comments) {
      if (!c.parent_id) continue;
      const list = map.get(c.parent_id) ?? [];
      list.push(c);
      map.set(c.parent_id, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    }
    return map;
  }, [comments]);

  function commentLikeCount(commentId: string) {
    return commentLikes.filter((l) => l.comment_id === commentId).length;
  }

  function myCommentLike(commentId: string) {
    return commentLikes.some(
      (l) => l.comment_id === commentId && l.user_id === currentUserId
    );
  }

  async function toggleCommentLike(comment: CommentRow) {
    if (!commentLikesSupported) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const liked = myCommentLike(comment.id);
    try {
      if (liked) {
        const { error } = await supabase
          .from("comment_likes")
          .delete()
          .eq("comment_id", comment.id)
          .eq("user_id", currentUserId);
        if (error) throw error;
        setCommentLikes((prev) =>
          prev.filter(
            (l) =>
              !(l.comment_id === comment.id && l.user_id === currentUserId)
          )
        );
      } else {
        const { error } = await supabase
          .from("comment_likes")
          .insert({ comment_id: comment.id, user_id: currentUserId });
        if (error) throw error;
        const { data } = await supabase
          .from("comment_likes")
          .select("*")
          .eq("comment_id", comment.id)
          .eq("user_id", currentUserId)
          .maybeSingle();
        const row = (data as CommentLikeRow | null) ?? {
          id: `local-${comment.id}-${currentUserId}`,
          comment_id: comment.id,
          user_id: currentUserId,
          created_at: new Date().toISOString(),
        };
        setCommentLikes((prev) => [
          ...prev.filter(
            (l) =>
              !(l.comment_id === comment.id && l.user_id === currentUserId)
          ),
          row,
        ]);
        if (comment.user_id !== currentUserId && !isMuted(post.id)) {
          const name =
            currentProfile?.full_name ||
            currentProfile?.username ||
            "Someone";
          void notify({
            user_id: comment.user_id,
            type: "reaction",
            title: `${name} liked your comment`,
            post_id: post.id,
          });
        }
      }
    } catch (err) {
      console.error("[chowk] comment like failed", err);
      showActionError("Couldn't save your like. Please try again.");
    }
  }

  async function handleAddReply(parent: CommentRow) {
    const text = replyText.trim();
    if (!text || replyBusy || !repliesSupported) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setReplyBusy(true);
    try {
      const { data, error } = await supabase
        .from("comments")
        .insert({
          post_id: post.id,
          user_id: currentUserId,
          content: text,
          parent_id: parent.id,
        })
        .select("*, profiles(username, full_name, avatar_url)")
        .single();
      if (error) throw error;
      const row = data as CommentRow;
      setComments((prev) => [
        ...prev,
        {
          ...row,
          profiles:
            row.profiles ??
            (currentProfile
              ? {
                  username: currentProfile.username,
                  full_name: currentProfile.full_name,
                  avatar_url: currentProfile.avatar_url,
                }
              : null),
        },
      ]);
      setReplyText("");
      setReplyingTo(null);
      if (parent.user_id !== currentUserId && !isMuted(post.id)) {
        const name =
          currentProfile?.full_name ||
          currentProfile?.username ||
          "Someone";
        void notify({
          user_id: parent.user_id,
          type: "comment",
          title: `${name} replied to your comment`,
          post_id: post.id,
        });
      }
    } catch (err) {
      console.error("[chowk] reply failed", err);
      const message =
        err && typeof err === "object" && "code" in err && err.code === "42703"
          ? "Replies aren't enabled yet. Ask the admin to run the latest database update."
          : "Couldn't post your reply. Please try again.";
      showActionError(message);
    } finally {
      setReplyBusy(false);
    }
  }

  /** Delete-post confirmation dialog state (replaces window.confirm). */
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function handleDelete() {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", post.id);
      if (error) throw error;
      setDeleteOpen(false);
      onDeleted(post.id);
    } catch {
      setDeleting(false);
    }
  }

  async function handleReportSubmit(reason: string) {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error("Not connected");
    const { error } = await supabase.from("reports").insert({
      reporter_id: currentUserId,
      post_id: post.id,
      reason,
    });
    if (error) throw error;
  }

  /** Lazily checked when the ··· menu opens; stays null if the table is missing. */
  async function checkSaved() {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const result = await isSaved(supabase, currentUserId, post.id);
    setSavedState(result);
  }

  async function handleToggleSave() {
    const supabase = getSupabaseClient();
    if (!supabase || savedState === null) return;
    const ok = await toggleSave(
      supabase,
      currentUserId,
      post.id,
      !savedState
    );
    if (ok) {
      setSavedState(!savedState);
      setMenuOpen(false);
    }
  }

  /** Lazily checked when an own-post menu opens; null if the column is missing. */
  async function checkPinned() {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("pinned_post_id")
        .eq("id", currentUserId)
        .single();
      if (error) throw error;
      setIsPinned(
        (data as { pinned_post_id?: string | null } | null)?.pinned_post_id ===
          post.id
      );
    } catch {
      setIsPinned(null);
    }
  }

  async function handlePinToggle() {
    const supabase = getSupabaseClient();
    if (!supabase || isPinned === null) return;
    const next = !isPinned;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ pinned_post_id: next ? post.id : null })
        .eq("id", currentUserId);
      if (error) throw error;
      setIsPinned(next);
      setMenuOpen(false);
      onPinChanged?.(post.id, next);
    } catch {
      // Column missing or RLS: pin stays as it was.
    }
  }

  async function handleCommentAudience(
    value: "everyone" | "friends"
  ) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from("posts")
        .update({ comment_audience: value })
        .eq("id", post.id);
      if (error) throw error;
      setCommentAud(value);
    } catch {
      // Column missing (comment_audience.sql not run yet): keep old value.
    } finally {
      setSubMenu(null);
    }
  }

  async function handleAudienceChange(value: "everyone" | "friends") {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from("posts")
        .update({ audience: value })
        .eq("id", post.id);
      if (error) throw error;
      setAudience(value);
    } catch {
      // Best-effort.
    } finally {
      setSubMenu(null);
    }
  }

  function handleMuteToggle() {
    const next = !muted;
    setMuted(post.id, next);
    setMutedState(next);
    setMenuOpen(false);
  }

  async function handleEditSave() {
    const text = editText.trim();
    if (!text || editBusy) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setEditBusy(true);
    try {
      const { error } = await supabase
        .from("posts")
        .update({ content: text })
        .eq("id", post.id);
      if (error) throw error;
      post.content = text;
      setEditOpen(false);
    } catch {
      // Best-effort; the modal stays open on failure.
    } finally {
      setEditBusy(false);
    }
  }

  /**
   * One comment row with Chowk-style Like / Reply actions and one level of
   * nested replies. A plain function (not a component) so hooks stay put.
   */
  function renderComment(c: CommentRow, isReply: boolean): ReactNode {
    const name = c.profiles?.full_name || c.profiles?.username || "Unknown";
    const liked = myCommentLike(c.id);
    const likeCount = commentLikeCount(c.id);
    const replies = isReply ? [] : repliesByParent.get(c.id) ?? [];
    return (
      <div key={c.id} className={isReply ? "ml-10" : undefined}>
        <div className="flex items-start gap-2">
          <SharedAvatar
            name={name}
            size="sm"
            tone="neutral"
            avatarUrl={c.profiles?.avatar_url ?? null}
            lazy
          />
          <div className="min-w-0 flex-1">
            <div className="rounded-2xl bg-[#F5F4FA] px-3 py-2">
              <p className="text-[13px] font-bold text-[#211D33]">{name}</p>
              {c.content ? (
                <p className="whitespace-pre-wrap break-words text-[15px] text-[#211D33]">
                  {c.content}
                </p>
              ) : null}
              {c.image_url ? <CommentImage url={c.image_url} /> : null}
            </div>
            <div className="mt-0.5 flex items-center gap-3 px-3 text-xs">
              {commentLikesSupported && (
                <button
                  type="button"
                  onClick={() => void toggleCommentLike(c)}
                  className={`cursor-pointer font-bold transition-colors hover:underline ${
                    liked ? "text-[#4F46E5]" : "text-[#6F6B80]"
                  }`}
                >
                  Like{likeCount > 0 ? ` (${likeCount})` : ""}
                </button>
              )}
              {repliesSupported && canComment && !isReply && (
                <button
                  type="button"
                  onClick={() => {
                    setReplyingTo(replyingTo === c.id ? null : c.id);
                    setReplyText("");
                  }}
                  className="cursor-pointer font-bold text-[#6F6B80] transition-colors hover:underline"
                >
                  Reply
                </button>
              )}
              <span className="text-[#6F6B80]">{timeAgo(c.created_at)}</span>
            </div>
            {replyingTo === c.id && (
              <div className="mt-2 flex items-center gap-2">
                <SharedAvatar
                  name={firstName}
                  size="xs"
                  avatarUrl={currentProfile?.avatar_url ?? null}
                />
                <div className="flex flex-1 items-center gap-1 rounded-full bg-[#F5F4FA] py-1 pl-4 pr-1.5">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleAddReply(c);
                    }}
                    maxLength={500}
                    placeholder={`Reply to ${name.split(" ")[0]}`}
                    aria-label="Write a reply"
                    autoFocus
                    className="min-w-0 flex-1 bg-transparent text-sm text-[#211D33] placeholder:text-[#6F6B80] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void handleAddReply(c)}
                    disabled={replyBusy || replyText.trim().length === 0}
                    aria-label="Send reply"
                    className="cursor-pointer rounded-full p-1.5 text-[#4F46E5] transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <SendIcon />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        {replies.length > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            {replies.map((r) => renderComment(r, true))}
          </div>
        )}
      </div>
    );
  }

  return (
    <article className="chowk-card chowk-rise p-4 sm:p-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        {authorHref ? (
          <Link
            href={authorHref}
            className="shrink-0 cursor-pointer"
            aria-label={`${displayName}'s profile`}
          >
            <Avatar name={displayName} anonymous={post.is_anonymous} avatarUrl={post.profiles?.avatar_url ?? null} />
          </Link>
        ) : (
          <Avatar name={displayName} anonymous={post.is_anonymous} avatarUrl={post.profiles?.avatar_url ?? null} />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[#211D33]">
            {authorHref ? (
              <Link href={authorHref} className="cursor-pointer hover:underline">
                {displayName}
              </Link>
            ) : (
              displayName
            )}
            {post.is_anonymous && isOwn && (
              <span className="ml-1.5 font-normal text-neutral-500">(you)</span>
            )}
            {/* Chowk-style follow: not own posts, never anonymous, not already friends. */}
            {!isOwn && !post.is_anonymous && !friendIds?.has(post.user_id) && (
              <PostHeaderFollow me={currentUserId} targetId={post.user_id} />
            )}
          </p>
          <p className="flex items-center gap-1 text-[13px] text-[#6F6B80]">
            <span>{timeAgo(post.created_at)}</span>
            <span aria-hidden>·</span>
            {audience === "friends" ? (
              <FriendsSmallIcon />
            ) : (
              <GlobeSmallIcon />
            )}
          </p>
          {isPinnedPost && (
            <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-[#6F6B80]">
              <PinIcon />
              Pinned post
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center">
          <div className="relative">
          <button
            type="button"
            onClick={() => {
              const opening = !menuOpen;
              setMenuOpen(opening);
              setSubMenu(null);
              if (opening && savedState === null) {
                void checkSaved();
              }
              if (opening && isOwn && isPinned === null) {
                void checkPinned();
              }
            }}
            aria-label="Post options"
            aria-expanded={menuOpen}
            className="cursor-pointer rounded-full p-2 text-[#6F6B80] transition-colors hover:bg-[#F5F4FA] hover:text-[#211D33]"
          >
            <DotsIcon />
          </button>
          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-40 cursor-pointer"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 z-50 w-80 rounded-xl bg-white py-2 shadow-xl ring-1 ring-neutral-200">
                {isOwn ? (
                  <>
                    {isPinned !== null && (
                      <MenuItem
                        icon={<PinIcon />}
                        label={isPinned ? "Unpin post" : "Pin post"}
                        onClick={() => void handlePinToggle()}
                      />
                    )}
                    {savedState !== null && (
                      <MenuItem
                        icon={<BookmarkIcon filled={savedState} />}
                        label={savedState ? "Unsave post" : "Save Post"}
                        onClick={() => void handleToggleSave()}
                      />
                    )}
                    <div className="my-1 border-t border-neutral-100" />
                    <MenuItem
                      icon={<SpeechIcon />}
                      label="Who can comment on your post?"
                      onClick={() =>
                        setSubMenu(subMenu === "comment" ? null : "comment")
                      }
                    />
                    {subMenu === "comment" && (
                      <div className="bg-neutral-50 py-1">
                        {(
                          [
                            { v: "everyone", label: "Everyone" },
                            { v: "friends", label: "Friends" },
                          ] as const
                        ).map(({ v, label }) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => void handleCommentAudience(v)}
                            className="flex w-full cursor-pointer items-center gap-3 px-4 py-2 pl-16 text-left text-sm transition-colors hover:bg-neutral-100"
                          >
                            <span
                              className={`flex h-4 w-4 items-center justify-center rounded-full ring-2 ${
                                commentAud === v
                                  ? "ring-[#4F46E5]"
                                  : "ring-neutral-300"
                              }`}
                            >
                              {commentAud === v && (
                                <span className="h-2 w-2 rounded-full bg-[#4F46E5]" />
                              )}
                            </span>
                            <span className="font-medium text-[#211D33]">
                              {label}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    <MenuItem
                      icon={<PencilIcon />}
                      label="Edit post"
                      onClick={() => {
                        setEditText(post.content ?? "");
                        setEditOpen(true);
                        setMenuOpen(false);
                      }}
                    />
                    <MenuItem
                      icon={<GearIcon />}
                      label="Edit audience"
                      onClick={() =>
                        setSubMenu(
                          subMenu === "audience" ? null : "audience"
                        )
                      }
                    />
                    {subMenu === "audience" && (
                      <div className="bg-neutral-50 py-1">
                        {(
                          [
                            { v: "everyone", label: "Everyone" },
                            { v: "friends", label: "Friends only" },
                          ] as const
                        ).map(({ v, label }) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => void handleAudienceChange(v)}
                            className="flex w-full cursor-pointer items-center gap-3 px-4 py-2 pl-16 text-left text-sm transition-colors hover:bg-neutral-100"
                          >
                            <span
                              className={`flex h-4 w-4 items-center justify-center rounded-full ring-2 ${
                                audience === v
                                  ? "ring-[#4F46E5]"
                                  : "ring-neutral-300"
                              }`}
                            >
                              {audience === v && (
                                <span className="h-2 w-2 rounded-full bg-[#4F46E5]" />
                              )}
                            </span>
                            <span className="font-medium text-[#211D33]">
                              {label}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    <MenuItem
                      icon={<BellOffIcon />}
                      label={
                        muted
                          ? "Turn on notifications for this post"
                          : "Turn off notifications for this post"
                      }
                      onClick={handleMuteToggle}
                    />
                    <div className="my-1 border-t border-neutral-100" />
                    <MenuItem
                      icon={<TrashIcon />}
                      label={deleting ? "Deleting..." : "Delete post"}
                      danger
                      disabled={deleting}
                      onClick={() => {
                        setMenuOpen(false);
                        setDeleteOpen(true);
                      }}
                    />
                  </>
                ) : (
                  <>
                    <MenuItem
                      icon={<MinusCircleIcon />}
                      label="Not interested"
                      onClick={() => {
                        setMenuOpen(false);
                        onHidden?.(post.id);
                      }}
                    />
                    {savedState !== null && (
                      <MenuItem
                        icon={<BookmarkIcon filled={savedState} />}
                        label={savedState ? "Unsave post" : "Save post"}
                        onClick={() => void handleToggleSave()}
                      />
                    )}
                    <div className="my-1 border-t border-neutral-100" />
                    <MenuItem
                      icon={<FlagIcon />}
                      label="Report post"
                      onClick={() => {
                        setMenuOpen(false);
                        setReportOpen(true);
                      }}
                    />
                  </>
                )}
              </div>
            </>
          )}
          </div>
          {onHidden && (
            <button
              type="button"
              onClick={() => onHidden(post.id)}
              aria-label="Hide post"
              title="Hide post"
              className="cursor-pointer rounded-full p-2 text-[#6F6B80] transition-colors hover:bg-[#F5F4FA] hover:text-[#211D33]"
            >
              <CloseIcon />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {post.content && (
        <div className="mt-4">
          <p className="whitespace-pre-wrap break-words text-base leading-7 text-[#211D33]">
            {(() => {
              const text = post.content ?? "";
              const LIMIT = 280;
              if (text.length <= LIMIT || expanded) return text;
              const cut = text.slice(0, LIMIT);
              const lastSpace = cut.lastIndexOf(" ");
              return `${cut.slice(0, lastSpace > 200 ? lastSpace : LIMIT)}... `;
            })()}
            {post.content.length > 280 && !expanded && (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                className="cursor-pointer font-semibold text-[#6F6B80] transition-colors hover:text-[#211D33] hover:underline"
              >
                See more
              </button>
            )}
          </p>
          {post.content.length > 280 && expanded && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="cursor-pointer text-sm font-semibold text-[#6F6B80] transition-colors hover:text-[#211D33] hover:underline"
            >
              See less
            </button>
          )}
        </div>
      )}
      {images.length > 0 && <MediaGrid urls={images} />}

      {/* Summary row, Chowk style: top reactions + total left, comments right. */}
      {(counts.length > 0 || comments.length > 0) && (
        <div className="mt-4 flex items-center justify-between px-1 text-[15px]">
          <div>
            {counts.length > 0 && (
              <button
                type="button"
                onClick={() => setShowReactors(true)}
                className="flex cursor-pointer items-center gap-1.5 transition-opacity hover:opacity-80"
                aria-label="See who reacted"
              >
                <span className="flex -space-x-1">
                  {counts.slice(0, 3).map(([emoji]) => (
                    <span
                      key={emoji}
                      className={`flex h-[18px] w-[18px] items-center justify-center rounded-full text-[11px] ring-2 ring-white ${
                        REACTION_BG[emoji] ?? "bg-[#6F6B80]"
                      }`}
                    >
                      {emoji}
                    </span>
                  ))}
                </span>
                <span className="text-[#6F6B80]">
                  {counts.reduce((s, [, c]) => s + c, 0)}
                </span>
              </button>
            )}
          </div>
          {comments.length > 0 && (
            <button
              type="button"
              onClick={() => setShowComments((v) => !v)}
              className="cursor-pointer text-[#6F6B80] transition-colors hover:text-[#211D33] hover:underline"
            >
              {comments.length} Comment{comments.length === 1 ? "" : "s"}
            </button>
          )}
        </div>
      )}

      {/* Action row: Like / Comment / Share, Chowk style */}
      <div className="relative mt-4 border-t border-[#E6E3F0] pt-2">
        <div className="flex items-center gap-1">
          <div
            className="flex flex-1"
            onMouseEnter={handleLikeAreaEnter}
            onMouseLeave={handleLikeAreaLeave}
          >
          <button
            type="button"
            onPointerDown={handleLikePointerDown}
            onPointerUp={clearPressTimer}
            onPointerCancel={clearPressTimer}
            onClick={handleLikeClick}
            onContextMenu={(e) => e.preventDefault()}
            style={{ touchAction: "manipulation" }}
            className={`flex flex-1 cursor-pointer select-none items-center justify-center gap-2 rounded-full py-2.5 text-[15px] font-semibold transition-all active:scale-95 ${
              myReaction
                ? `${REACTION_TEXT[myReaction.emoji] ?? "text-[#4F46E5]"} bg-[#EEF2FF] hover:bg-[#E0E7FF]`
                : "text-[#6F6B80] hover:bg-[#F5F4FA] hover:text-[#4338CA]"
            }`}
          >
            {myReaction ? (
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[13px] ${
                  REACTION_BG[myReaction.emoji] ?? "bg-[#6F6B80]"
                }`}
              >
                {myReaction.emoji}
              </span>
            ) : (
              <ThumbIcon />
            )}
            {myReaction ? REACTION_LABELS[myReaction.emoji] ?? "Like" : "Like"}
          </button>
          </div>

          <button
            type="button"
            onClick={() => setShowComments((v) => !v)}
            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full py-2.5 text-[15px] font-semibold text-[#6F6B80] transition-all hover:bg-[#F5F4FA] hover:text-[#4338CA] active:scale-95"
          >
            <CommentBubbleIcon />
            Comment
          </button>

          {onShare && (
            <button
              type="button"
              onClick={() => onShare(post)}
              className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-full py-2.5 text-[15px] font-semibold text-[#6F6B80] transition-all hover:bg-[#F5F4FA] hover:text-[#4338CA] active:scale-95"
            >
              <ShareArrowIcon />
              Share
            </button>
          )}
        </div>

        {/* Reaction picker popover */}
        {pickerOpen && (
          <>
            {/* Tap-outside-to-close only for touch; on desktop the hover
                timers own the open state (a backdrop would eat hover). */}
            {pickerMode === "touch" && (
              <div
                className="fixed inset-0 z-40 cursor-pointer"
                onClick={closePicker}
              />
            )}
            <div
              className="absolute bottom-12 left-0 z-50 flex gap-1 rounded-full bg-white p-2 shadow-lg ring-1 ring-neutral-200"
              onMouseEnter={cancelCloseTimer}
              onMouseLeave={schedulePickerClose}
            >
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    void setReaction(emoji);
                    closePicker();
                  }}
                  aria-label={`React with ${emoji}`}
                  className={`cursor-pointer rounded-full p-2 text-2xl transition-transform hover:scale-125 ${
                    myReaction?.emoji === emoji ? "bg-[#EEF2FF] ring-1 ring-[#4F46E5]/40" : ""
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </>
        )}
        {actionError && (
          <p className="px-2 pb-1 text-xs font-medium text-red-600">
            {actionError}
          </p>
        )}
      </div>

      {/* Comments */}
      {showComments && (
        <div className="mt-2 border-t border-neutral-100 pt-3">
          <div className="flex flex-col gap-2">
            {topLevelComments.map((c) => renderComment(c, false))}
            {topLevelComments.length === 0 && canComment && (
              <p className="text-sm text-[#6F6B80]">
                No comments yet. Be the first to reply.
              </p>
            )}
          </div>
          {canComment ? (
            <>
              {commentPhoto ? (
                <div className="relative mb-2 ml-10 inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={commentPhoto.preview}
                    alt="Comment photo attachment"
                    className="h-20 w-20 rounded-xl object-cover ring-1 ring-neutral-200"
                  />
                  <button
                    type="button"
                    onClick={removeCommentPhoto}
                    aria-label="Remove photo"
                    className="absolute -right-1.5 -top-1.5 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-neutral-900 text-xs font-bold text-white transition-colors hover:bg-neutral-700"
                  >
                    ×
                  </button>
                </div>
              ) : null}
              <div className="mt-3 flex items-center gap-2">
                <SharedAvatar
                  name={firstName}
                  size="sm"
                  avatarUrl={currentProfile?.avatar_url ?? null}
                />
                <div className="flex flex-1 items-center gap-1 rounded-full bg-[#F5F4FA] py-1 pl-4 pr-2">
                  <input
                    ref={commentInputRef}
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleAddComment();
                    }}
                    onPaste={(e) => {
                      const files = e.clipboardData?.files;
                      if (files && files.length > 0) {
                        const img = Array.from(files).find((f) =>
                          f.type.startsWith("image/")
                        );
                        if (img) {
                          e.preventDefault();
                          const dt = new DataTransfer();
                          dt.items.add(img);
                          handleCommentFile(dt.files);
                        }
                      }
                    }}
                    maxLength={500}
                    placeholder={`Comment as ${firstName}`}
                    aria-label="Write a comment"
                    className="min-w-0 flex-1 bg-transparent text-[15px] text-[#211D33] placeholder:text-[#6F6B80] focus:outline-none"
                  />
                  <span className="flex shrink-0 items-center text-[#6F6B80]">
                    <span ref={emojiWrapRef} className="relative">
                      <button
                        type="button"
                        onClick={() => setEmojiOpen((v) => !v)}
                        title="Emoji"
                        aria-label="Add emoji"
                        className="block cursor-pointer rounded-full p-1.5 transition-colors hover:bg-neutral-200"
                      >
                        <SmileIcon />
                      </button>
                      {emojiOpen ? (
                        <div className="absolute bottom-9 right-0 z-30 grid w-64 grid-cols-8 gap-0.5 rounded-xl bg-white p-2 shadow-xl ring-1 ring-neutral-200">
                          {COMMENT_EMOJIS.map((e) => (
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
                    <input
                      ref={commentFileRef}
                      id={`comment-photo-${post.id}`}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => {
                        handleCommentFile(e.target.files);
                        e.target.value = "";
                      }}
                    />
                    <label
                      htmlFor={`comment-photo-${post.id}`}
                      title="Photo"
                      aria-label="Attach a photo"
                      className="block cursor-pointer rounded-full p-1.5 transition-colors hover:bg-neutral-200"
                    >
                      <CameraIcon />
                    </label>
                    {/* GIF search needs a Tenor API key — hidden until then. */}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <p className="mt-3 rounded-xl bg-[#F5F4FA] px-4 py-2.5 text-center text-sm font-medium text-[#6F6B80]">
              Only friends can comment on this post.
            </p>
          )}
        </div>
      )}
      {editOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setEditOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Edit post"
        >
          <div
            className="w-full max-w-lg rounded-xl bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-center text-xl font-bold text-[#211D33]">
              Edit post
            </h2>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              maxLength={2000}
              rows={5}
              autoFocus
              className="mt-3 min-h-[120px] w-full resize-none rounded-xl bg-[#F5F4FA] p-3 text-[15px] text-[#211D33] placeholder:text-[#6F6B80] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/40"
              placeholder="Write something..."
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="flex-1 cursor-pointer rounded-lg bg-neutral-200 py-2.5 text-sm font-bold text-[#211D33] transition-colors hover:bg-neutral-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleEditSave()}
                disabled={editBusy || editText.trim().length === 0}
                className="flex-1 cursor-pointer rounded-lg bg-[#4F46E5] py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#4338CA] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {editBusy ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
      {reportOpen && (
        <ReportDialog
          title="Report post"
          placeholder="Why are you reporting this post?"
          onClose={() => setReportOpen(false)}
          onSubmit={handleReportSubmit}
        />
      )}
      {showReactors && (
        <ReactionsModal
          postId={post.id}
          onClose={() => setShowReactors(false)}
        />
      )}
      <ChowkModal
        open={deleteOpen}
        onClose={() => {
          if (!deleting) setDeleteOpen(false);
        }}
        title="Delete this post?"
        subtitle="Are you sure you want to delete this post? This cannot be undone."
        size="sm"
        footer={
          <>
            <ChowkModalButton
              tone="neutral"
              disabled={deleting}
              onClick={() => setDeleteOpen(false)}
            >
              Cancel
            </ChowkModalButton>
            <ChowkModalButton
              tone="dark"
              disabled={deleting}
              onClick={() => void handleDelete()}
            >
              {deleting ? "Deleting..." : "Delete"}
            </ChowkModalButton>
          </>
        }
      >
        <p className="text-[15px] leading-6 text-[#6F6B80]">
          The post will be permanently removed for everyone.
        </p>
      </ChowkModal>
    </article>
  );
}
