"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { timeAgo } from "@/lib/time";
import { Avatar } from "./Avatar";
import type { ReceivedRequest } from "@/lib/friends";

/**
 * Incoming friend requests with Accept / Decline. Loads its own data so any
 * page can drop it in.
 */
export function FriendRequests({
  userId,
  onChanged,
}: {
  userId: string;
  onChanged?: () => void;
}) {
  const [requests, setRequests] = useState<ReceivedRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("friendships")
      .select("*")
      .eq("addressee_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as ReceivedRequest[];
    const ids = rows.map((r) => r.requester_id);
    let byId = new Map<string, ReceivedRequest["requester"]>();
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .in("id", ids);
      byId = new Map(
        ((profs ?? []) as NonNullable<ReceivedRequest["requester"]>[]).map(
          (p) => [p.id, p]
        )
      );
    }
    setRequests(rows.map((r) => ({ ...r, requester: byId.get(r.requester_id) ?? null })));
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function respond(requestId: string, accept: boolean) {
    const supabase = getSupabaseClient();
    if (!supabase || busyId) return;
    setBusyId(requestId);
    try {
      if (accept) {
        const { error } = await supabase
          .from("friendships")
          .update({ status: "accepted" })
          .eq("id", requestId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("friendships")
          .delete()
          .eq("id", requestId);
        if (error) throw error;
      }
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      onChanged?.();
    } catch {
      // Best-effort; the list reloads on next visit.
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section
      aria-label="Friend requests"
      className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200"
    >
      <h2 className="text-sm font-bold text-[#211D33]">
        Friend requests{" "}
        <span className="ml-1 rounded-full bg-[#EEF2FF] px-2 py-0.5 text-xs font-bold text-[#4338CA]">
          {requests.length}
        </span>
      </h2>
      {loading ? (
        <p className="mt-3 text-sm text-[#6F6B80]">Loading…</p>
      ) : requests.length === 0 ? (
        <p className="mt-3 text-sm text-[#6F6B80]">No friend requests.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
        {requests.map((r) => {
          const name =
            r.requester?.full_name || r.requester?.username || "Unknown";
          return (
            <li key={r.id} className="flex items-center gap-3">
              <Avatar
                name={name}
                size="sm"
                avatarUrl={r.requester?.avatar_url ?? null}
                lazy
              />
              <div className="min-w-0 flex-1">
                {r.requester?.username ? (
                  <Link
                    href={`/profile/${encodeURIComponent(r.requester.username)}`}
                    className="block cursor-pointer truncate text-sm font-semibold text-[#211D33] transition-colors hover:underline"
                  >
                    {name}
                  </Link>
                ) : (
                  <p className="truncate text-sm font-semibold text-[#211D33]">
                    {name}
                  </p>
                )}
                <p className="text-xs text-[#6F6B80]">
                  {timeAgo(r.created_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void respond(r.id, true)}
                disabled={busyId === r.id}
                className="cursor-pointer rounded-full bg-[#4F46E5] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#4338CA] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Accept
              </button>
              <button
                type="button"
                onClick={() => void respond(r.id, false)}
                disabled={busyId === r.id}
                className="cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold text-[#6F6B80] ring-1 ring-neutral-200 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Decline
              </button>
            </li>
          );
        })}
      </ul>
      )}
    </section>
  );
}
