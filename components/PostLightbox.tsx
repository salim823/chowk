"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { VideoPlayer } from "@/components/VideoPlayer";
import { isVideoUrl } from "@/lib/media";
import { timeAgo } from "@/lib/time";
import type { PostRow } from "@/lib/types";

/**
 * PostLightbox — a lightweight viewer for a photo/video post, shared by
 * Campus Moments and the Explore page. Display-only: no new backend, no
 * new interactions beyond viewing. Escape or backdrop tap closes it.
 */
export function PostLightbox({
  post,
  onClose,
}: {
  post: PostRow;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const authorName = post.is_anonymous
    ? "Anonymous"
    : (post.profiles?.full_name || "Student");
  const media = (post.image_urls ?? []).filter(Boolean);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-[#211D33]/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Post preview"
      onClick={onClose}
    >
      <div
        className="chowk-rise max-h-[90dvh] w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-4 pb-3">
          <Avatar
            name={authorName}
            size="md"
            tone={post.is_anonymous ? "neutral" : "blue"}
            avatarUrl={post.is_anonymous ? null : post.profiles?.avatar_url}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold text-[#211D33]">
              {authorName}
            </p>
            <p className="text-xs text-[#6F6B80]">{timeAgo(post.created_at)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="cursor-pointer rounded-full p-2 text-[#6F6B80] transition-colors hover:bg-[#F5F4FA] hover:text-[#211D33]"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {post.content && (
          <p className="max-h-24 overflow-y-auto px-4 pb-3 text-[15px] leading-6 text-[#211D33]">
            {post.content}
          </p>
        )}

        <div className="max-h-[55dvh] overflow-y-auto bg-[#211D33]/5">
          {media.map((url) =>
            isVideoUrl(url) ? (
              <VideoPlayer key={url} url={url} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt="Post media"
                className="w-full object-contain"
              />
            )
          )}
        </div>

        {!post.is_anonymous && post.profiles && (
          <div className="p-4 pt-3">
            <Link
              href={`/profile/${post.profiles.username}`}
              onClick={onClose}
              className="chowk-btn-quiet w-full px-4 py-2.5 text-sm"
            >
              View profile
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
