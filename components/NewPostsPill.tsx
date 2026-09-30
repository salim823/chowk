"use client";

/**
 * Floating "New posts" pill, Chowk-style. Appears at the top-center of the
 * feed when the poller finds posts newer than what's on screen. Tapping it
 * loads the new posts — nothing is inserted automatically, so reading is
 * never interrupted by layout jumps.
 */
export function NewPostsPill({
  count,
  onTap,
}: {
  count: number;
  onTap: () => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-16 z-40 flex justify-center sm:top-20">
      <button
        type="button"
        onClick={onTap}
        className="new-posts-pill pointer-events-auto flex cursor-pointer items-center gap-2 rounded-full bg-[#4F46E5] py-2 pl-3 pr-4 text-sm font-semibold text-white shadow-lg shadow-black/20 transition-colors hover:bg-[#4338CA] active:bg-[#3730A3]"
        aria-live="polite"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M10 16V4m0 0l-5 5m5-5l5 5" />
        </svg>
        {count === 1 ? "New post" : `${count} new posts`}
      </button>
      <style jsx>{`
        .new-posts-pill {
          animation: new-posts-drop 0.25s ease-out;
        }
        @keyframes new-posts-drop {
          from {
            transform: translateY(-12px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
