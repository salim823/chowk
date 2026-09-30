"use client";

import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { PostLightbox } from "@/components/PostLightbox";
import { timeAgo } from "@/lib/time";
import type { PostRow } from "@/lib/types";

/**
 * Campus Moments — a horizontal strip of recent photo/video posts, with
 * Chowk's own look (not a stories clone). Display-only: it surfaces posts
 * that already exist. The first tile opens the post composer so sharing a
 * moment is one tap away. Tapping a moment opens a lightbox preview.
 *
 * Privacy: `posts` must already be visibility-filtered by the caller (the
 * feed passes its own filtered list), so Moments can never surface a post
 * the viewer isn't allowed to see.
 */
export function CampusMoments({
  posts,
  onAddMoment,
}: {
  posts: PostRow[];
  onAddMoment: () => void;
}) {
  const [active, setActive] = useState<PostRow | null>(null);

  const moments = posts
    .filter((p) => (p.image_urls ?? []).length > 0)
    .slice(0, 12);

  if (moments.length === 0) return null;

  return (
    <section aria-label="Campus moments">
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-[15px] font-bold text-[#211D33]">
          Campus Moments
        </h2>
        <span className="text-xs font-medium text-[#6F6B80]">
          Fresh from your campus
        </span>
      </div>
      <div className="no-scrollbar -mx-3 flex gap-3 overflow-x-auto px-3 pb-1 sm:-mx-4 sm:px-4">
        {/* Add-moment tile: opens the existing composer. */}
        <button
          type="button"
          onClick={onAddMoment}
          className="group flex h-36 w-24 shrink-0 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#C7D2FE] bg-[#EEF2FF]/60 transition-colors hover:border-[#4F46E5] hover:bg-[#EEF2FF]"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#4F46E5] text-white shadow-md shadow-[#4F46E5]/30 transition-transform group-active:scale-90">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          <span className="px-1 text-center text-[11px] font-bold leading-tight text-[#4338CA]">
            Add moment
          </span>
        </button>

        {moments.map((m) => {
          const url = (m.image_urls ?? [])[0];
          const name = m.is_anonymous
            ? "Anonymous"
            : (m.profiles?.full_name || "Student");
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setActive(m)}
              className="group relative h-36 w-24 shrink-0 cursor-pointer overflow-hidden rounded-2xl bg-[#E6E3F0] text-left shadow-sm ring-1 ring-[#E6E3F0] transition-transform active:scale-95"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <span className="absolute inset-0 bg-gradient-to-t from-[#211D33]/70 via-transparent to-transparent" />
              <span className="absolute left-1.5 top-1.5 rounded-full bg-gradient-to-br from-[#4F46E5] to-[#EC4899] p-[2px]">
                <Avatar
                  name={name}
                  size="xs"
                  tone={m.is_anonymous ? "neutral" : "blue"}
                  avatarUrl={
                    m.is_anonymous ? null : m.profiles?.avatar_url
                  }
                />
              </span>
              <span className="absolute inset-x-1.5 bottom-1.5">
                <span className="block truncate text-[11px] font-bold leading-tight text-white">
                  {name}
                </span>
                <span className="block text-[10px] leading-tight text-white/80">
                  {timeAgo(m.created_at)}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {active && (
        <PostLightbox post={active} onClose={() => setActive(null)} />
      )}
    </section>
  );
}
