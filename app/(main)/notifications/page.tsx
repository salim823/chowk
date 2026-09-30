"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { timeAgo } from "@/lib/time";
import type { NotificationRow } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  reaction: "Reaction",
  comment: "Comment",
  friend_request: "Friend request",
  friend_post: "New post",
};

/** Newest-first notifications; everything is marked read on open. */
export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  async function deleteNotification(id: string): Promise<void> {
    if (deletingId) return;
    setDeletingId(id);
    // Optimistic: drop it from the list right away.
    setItems((prev) => prev.filter((n) => n.id !== id));
    try {
      const supabase = getSupabaseClient();
      if (supabase) {
        await supabase.from("notifications").delete().eq("id", id);
      }
    } catch {
      // Best-effort; the item is already gone from the list.
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        if (!cancelled) setLoading(false);
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (!cancelled) {
        setItems((data ?? []) as NotificationRow[]);
        setLoading(false);
      }
      // Mark everything as read (fire-and-forget; the nav badge refreshes
      // when the route changes).
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-3 bg-[#F5F4FA] px-3 py-3 sm:px-4 lg:bg-transparent">
      <header className="px-1">
        <h1 className="text-xl font-bold text-[#211D33]">Notifications</h1>
        {!loading && items.length > 0 && (
          <div
            role="tablist"
            aria-label="Notification filters"
            className="mt-3 flex gap-2"
          >
            {(
              [
                { id: "all", label: "All" },
                { id: "unread", label: "Unread" },
              ] as const
            ).map((f) => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(f.id)}
                  className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-semibold transition-all active:scale-95 ${
                    active
                      ? "bg-[#4F46E5] text-white shadow-md shadow-[#4F46E5]/25"
                      : "bg-white text-[#6F6B80] ring-1 ring-[#E6E3F0] hover:bg-[#EEF2FF] hover:text-[#4338CA]"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {loading ? (
        <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-neutral-200">
          <p className="text-sm text-[#6F6B80]">Loading notifications...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-neutral-200">
          <p className="text-sm font-medium text-[#211D33]">
            Nothing here yet.
          </p>
          <p className="mt-1 text-sm text-[#6F6B80]">
            Reactions, comments and friend activity will show up here.
          </p>
        </div>
      ) : filter === "unread" && items.every((n) => n.is_read) ? (
        <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-neutral-200">
          <p className="text-sm font-medium text-[#211D33]">
            You&apos;re all caught up.
          </p>
          <p className="mt-1 text-sm text-[#6F6B80]">
            No unread notifications right now.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items
            .filter((n) => filter === "all" || !n.is_read)
            .map((n) => (
              <li key={n.id} className="relative">
              <Link
                href={n.post_id ? "/feed" : "/profile"}
                className="flex cursor-pointer items-start gap-3 rounded-2xl bg-white p-4 pr-12 shadow-sm ring-1 ring-neutral-200 transition-shadow hover:shadow"
              >
                <span
                  aria-hidden
                  className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                    n.is_read ? "bg-neutral-200" : "bg-[#4F46E5]"
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <span className="inline-block rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-[#6F6B80]">
                    {TYPE_LABELS[n.type] ?? "Update"}
                  </span>
                  <p className="mt-1 break-words text-sm text-[#211D33]">
                    {n.title}
                  </p>
                  <p className="mt-1 text-xs text-[#6F6B80]">
                    {timeAgo(n.created_at)}
                  </p>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => void deleteNotification(n.id)}
                disabled={deletingId === n.id}
                aria-label="Delete notification"
                title="Delete"
                className="absolute right-2.5 top-2.5 cursor-pointer rounded-full p-1.5 text-[#6F6B80] transition-colors hover:bg-neutral-100 hover:text-[#211D33] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  aria-hidden
                >
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
