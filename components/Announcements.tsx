"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { timeAgo } from "@/lib/time";
import type { AnnouncementRow } from "@/lib/types";

/**
 * Pinned announcements at the top of the feed. Admins (profiles.is_admin)
 * also get a small composer to publish new ones.
 */
export function Announcements({
  currentUserId,
  isAdmin,
}: {
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [items, setItems] = useState<AnnouncementRow[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  async function load() {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    const { data } = await supabase
      .from("announcements")
      .select("*, profiles(username, full_name)")
      .eq("is_pinned", true)
      .order("created_at", { ascending: false })
      .limit(10);
    setItems((data ?? []) as AnnouncementRow[]);
  }

  useEffect(() => {
    void load();
  }, []);

  async function handlePublish() {
    const t = title.trim();
    if (!t || busy) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    try {
      const { error: insertError } = await supabase
        .from("announcements")
        .insert({
          user_id: currentUserId,
          title: t,
          content: content.trim() || null,
          is_pinned: true,
        });
      if (insertError) throw insertError;
      setTitle("");
      setContent("");
      setFormOpen(false);
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not publish the announcement."
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteAnnouncement(id: string) {
    if (deletingId) return;
    if (!window.confirm("Delete this announcement?")) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setDeletingId(id);
    try {
      const { error: delError } = await supabase
        .from("announcements")
        .delete()
        .eq("id", id);
      if (delError) throw delError;
      setItems((prev) => prev.filter((a) => a.id !== id));
    } catch {
      // Best-effort.
    } finally {
      setDeletingId(null);
      setMenuOpenId(null);
    }
  }

  if (items.length === 0 && !isAdmin) return null;

  return (
    <section
      aria-label="Announcements"
      className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200"
    >
      <h2 className="text-xs font-bold uppercase tracking-widest text-[#4338CA]">
        Announcements
      </h2>

      {items.length > 0 && (
        <ul className="mt-3 flex flex-col gap-3">
          {items.map((a) => (
            <li
              key={a.id}
              className="relative rounded-xl bg-blue-50/60 p-3 ring-1 ring-[#4F46E5]/30"
            >
              {isAdmin && (
                <div className="absolute right-1.5 top-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setMenuOpenId(menuOpenId === a.id ? null : a.id)
                    }
                    aria-label="Announcement options"
                    aria-expanded={menuOpenId === a.id}
                    className="cursor-pointer rounded-lg px-2 py-0.5 text-lg font-bold leading-none text-[#6F6B80] transition-colors hover:bg-neutral-200 hover:text-neutral-800"
                  >
                    ···
                  </button>
                  {menuOpenId === a.id && (
                    <>
                      <div
                        className="fixed inset-0 z-40 cursor-pointer"
                        onClick={() => setMenuOpenId(null)}
                      />
                      <div className="absolute right-0 z-50 w-48 rounded-xl bg-white py-1 shadow-lg ring-1 ring-neutral-200">
                        <button
                          type="button"
                          onClick={() => void handleDeleteAnnouncement(a.id)}
                          disabled={deletingId === a.id}
                          className="block w-full cursor-pointer px-4 py-2.5 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {deletingId === a.id
                            ? "Deleting..."
                            : "Delete announcement"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
              <p className="pr-8 text-sm font-bold text-[#211D33]">{a.title}</p>
              {a.content && (
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[#211D33]">
                  {a.content}
                </p>
              )}
              <p className="mt-1.5 text-xs text-[#6F6B80]">
                {a.profiles?.full_name || a.profiles?.username || "Admin"} ·{" "}
                {timeAgo(a.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}

      {isAdmin && (
        <div className="mt-3 border-t border-neutral-100 pt-3">
          {!formOpen ? (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#F5F4FA] py-2.5 text-sm font-semibold text-[#211D33] transition-colors hover:bg-neutral-200"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New announcement
            </button>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[#211D33]">
                  New announcement
                </p>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="cursor-pointer rounded-lg px-2 py-1 text-sm font-medium text-[#6F6B80] transition-colors hover:bg-neutral-100"
                >
                  Cancel
                </button>
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                placeholder="Announcement title"
                className="mt-2 w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-[#211D33] placeholder:text-neutral-400 focus:border-[#4F46E5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/30"
              />
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={2}
                maxLength={1000}
                placeholder="Details (optional)"
                className="mt-2 w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-[#211D33] placeholder:text-neutral-400 focus:border-[#4F46E5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/30"
              />
              {error && (
                <p className="mt-2 text-sm font-medium text-red-600">{error}</p>
              )}
              <button
                type="button"
                onClick={handlePublish}
                disabled={busy || title.trim().length === 0}
                className="mt-2 cursor-pointer rounded-xl bg-[#4F46E5] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#4338CA] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? "Publishing..." : "Publish"}
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
