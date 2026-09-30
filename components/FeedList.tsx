"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { hidePostFor7Days } from "@/lib/hiddenPosts";
import { getMyFriendData } from "@/lib/friends";
import { PostCard } from "./PostCard";
import type {
  CommentLikeRow,
  CommentRow,
  PostRow,
  ProfileLite,
  ReactionRow,
} from "@/lib/types";

type FeedListProps = {
  posts: PostRow[];
  currentUserId: string;
  currentProfile: ProfileLite | null;
  onShare?: (post: PostRow) => void;
  emptyTitle?: string;
  emptySubtitle?: string;
  /** Accepted friend ids; loaded automatically when omitted. */
  friendIds?: Set<string>;
  /** Post id pinned on the author's profile (shows the "Pinned post" label). */
  pinnedPostId?: string | null;
  /** Called after pin/unpin so parents can reorder. */
  onPinChanged?: (postId: string, pinned: boolean) => void;
  /**
   * Optional slot rendered right after the post at this 0-based index
   * (e.g. 2 = after the 3rd post). If there are fewer posts, the slot
   * renders at the end of the list instead.
   */
  injectedAfterIndex?: number;
  injectedSlot?: ReactNode;
};

/**
 * Renders a list of posts, loading their reactions and comments in bulk.
 * Parents only supply the (already filtered) posts.
 */

export function FeedList({
  posts: initialPosts,
  currentUserId,
  currentProfile,
  onShare,
  emptyTitle = "No posts yet.",
  emptySubtitle,
  friendIds: friendIdsProp,
  pinnedPostId,
  onPinChanged,
  injectedAfterIndex,
  injectedSlot,
}: FeedListProps) {
  const [posts, setPosts] = useState<PostRow[]>(() => initialPosts);
  const [reactionsByPost, setReactionsByPost] = useState<
    Record<string, ReactionRow[]>
  >({});
  const [commentsByPost, setCommentsByPost] = useState<
    Record<string, CommentRow[]>
  >({});
  const [commentLikesByPost, setCommentLikesByPost] = useState<
    Record<string, CommentLikeRow[]>
  >({});
  /** False until comment_engagement.sql has been run; hides the UI then. */
  const [commentLikesSupported, setCommentLikesSupported] = useState(true);
  const [repliesSupported, setRepliesSupported] = useState(true);
  const [friendIds, setFriendIds] = useState<Set<string>>(
    friendIdsProp ?? new Set()
  );

  useEffect(() => {
    setPosts(initialPosts);
  }, [initialPosts]);

  // Friend ids for "Who can comment = Friends" gating (skipped when provided).
  useEffect(() => {
    if (friendIdsProp) {
      setFriendIds(friendIdsProp);
      return;
    }
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      try {
        const fd = await getMyFriendData(supabase, currentUserId);
        if (!cancelled) setFriendIds(fd.acceptedIds);
      } catch {
        // Best-effort; comment gating stays restrictive.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [friendIdsProp, currentUserId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseClient();
      const ids = initialPosts.map((p) => p.id);
      if (!supabase || ids.length === 0) {
        if (!cancelled) {
          setReactionsByPost({});
          setCommentsByPost({});
        }
        return;
      }
      const [{ data: reactionRows }, { data: commentRows }] =
        await Promise.all([
          supabase.from("reactions").select("*").in("post_id", ids),
          supabase
            .from("comments")
            .select("*, profiles(username, full_name, avatar_url)")
            .in("post_id", ids)
            .order("created_at", { ascending: true }),
        ]);
      if (cancelled) return;
      const rMap: Record<string, ReactionRow[]> = {};
      for (const row of (reactionRows ?? []) as ReactionRow[]) {
        (rMap[row.post_id] ||= []).push(row);
      }
      const cMap: Record<string, CommentRow[]> = {};
      for (const row of (commentRows ?? []) as CommentRow[]) {
        (cMap[row.post_id] ||= []).push(row);
      }
      setReactionsByPost(rMap);
      setCommentsByPost(cMap);

      // Comment likes (needs comment_engagement.sql; degrade if missing).
      const commentIds = ((commentRows ?? []) as CommentRow[]).map(
        (c) => c.id
      );
      if (commentIds.length > 0) {
        try {
          const { data: likeRows, error: likeError } = await supabase
            .from("comment_likes")
            .select("*")
            .in("comment_id", commentIds);
          if (likeError) throw likeError;
          const postOfComment = new Map(
            ((commentRows ?? []) as CommentRow[]).map((c) => [c.id, c.post_id])
          );
          const lMap: Record<string, CommentLikeRow[]> = {};
          for (const row of (likeRows ?? []) as CommentLikeRow[]) {
            const pid = postOfComment.get(row.comment_id);
            if (pid) (lMap[pid] ||= []).push(row);
          }
          if (!cancelled) {
            setCommentLikesByPost(lMap);
            setCommentLikesSupported(true);
          }
        } catch {
          if (!cancelled) {
            setCommentLikesByPost({});
            setCommentLikesSupported(false);
          }
        }
      } else if (!cancelled) {
        setCommentLikesByPost({});
      }

      // Replies need the parent_id column (comment_engagement.sql).
      try {
        const { error: probeError } = await supabase
          .from("comments")
          .select("parent_id")
          .limit(1);
        if (!cancelled) setRepliesSupported(!probeError);
      } catch {
        if (!cancelled) setRepliesSupported(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialPosts]);

  const [hideError, setHideError] = useState(false);

  function handleDeleted(postId: string) {
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }

  /**
   * "Hide this post for me": records a 7-day server-side hide, then drops
   * the post from this list. The post is untouched for everyone else and
   * automatically becomes visible again after 7 days.
   */
  async function handleHidden(postId: string) {
    const supabase = getSupabaseClient();
    if (!supabase || !currentUserId) return;
    setHideError(false);
    try {
      await hidePostFor7Days(supabase, currentUserId, postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch {
      // hidden_posts.sql not run yet (or offline): keep the post visible
      // and tell the user instead of silently swallowing it.
      setHideError(true);
    }
  }

  if (posts.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-neutral-200">
        <p className="text-sm font-medium text-[#211D33]">{emptyTitle}</p>
        {emptySubtitle && (
          <p className="mt-1 text-sm text-[#6F6B80]">{emptySubtitle}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {hideError && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-[#6F6B80] ring-1 ring-neutral-200">
          <p>Could not hide this post. Please try again later.</p>
          <button
            type="button"
            onClick={() => setHideError(false)}
            aria-label="Dismiss"
            className="cursor-pointer rounded-full px-2 py-1 font-bold text-[#4F46E5] transition-colors hover:bg-[#F5F4FA]"
          >
            OK
          </button>
        </div>
      )}
      {posts.map((post, i) => (
        <Fragment key={post.id}>
          <PostCard
            post={post}
            currentUserId={currentUserId}
            currentProfile={currentProfile}
            initialReactions={reactionsByPost[post.id] ?? []}
            initialComments={commentsByPost[post.id] ?? []}
            initialCommentLikes={commentLikesByPost[post.id] ?? []}
            commentLikesSupported={commentLikesSupported}
            repliesSupported={repliesSupported}
            onDeleted={handleDeleted}
            // No X button on your own posts — the owner gets the ⋯ menu
            // (Delete/Edit) instead. Hiding is only for others' posts.
            onHidden={
              post.user_id === currentUserId
                ? undefined
                : (postId: string) => void handleHidden(postId)
            }
            onShare={onShare}
            friendIds={friendIds}
            pinnedPostId={pinnedPostId}
            onPinChanged={onPinChanged}
          />
          {injectedSlot && i === injectedAfterIndex && injectedSlot}
        </Fragment>
      ))}
      {/* Fewer posts than the target index: slot goes at the end. */}
      {injectedSlot &&
        injectedAfterIndex !== undefined &&
        posts.length <= injectedAfterIndex &&
        injectedSlot}
    </div>
  );
}
