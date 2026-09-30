"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { Avatar } from "./Avatar";
import { MessageButton } from "./MessageButton";
import type { ProfileLite } from "@/lib/types";

type FriendEntry = ProfileLite & { id: string; friendshipId: string };

/**
 * Accepted friends of a user. Optionally lets the viewer remove a friendship
 * (used on the viewer's own profile).
 */
export function FriendsList({
  userId,
  showRemove = false,
  onChanged,
}: {
  userId: string;
  showRemove?: boolean;
  onChanged?: () => void;
}) {
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        if (!cancelled) setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("friendships")
        .select("id, requester_id, addressee_id")
        .eq("status", "accepted")
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
      const rows = (data ?? []) as {
        id: string;
        requester_id: string;
        addressee_id: string;
      }[];
      const otherIds = rows.map((r) =>
        r.requester_id === userId ? r.addressee_id : r.requester_id
      );
      const rowIdByOther = new Map(
        rows.map((r) => [
          r.requester_id === userId ? r.addressee_id : r.requester_id,
          r.id,
        ])
      );
      let list: FriendEntry[] = [];
      if (otherIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", otherIds);
        list = ((profs ?? []) as (ProfileLite & { id: string })[]).map(
          (p) => ({ ...p, friendshipId: rowIdByOther.get(p.id) ?? "" })
        );
      }
      if (!cancelled) {
        setFriends(list);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function handleRemove(entry: FriendEntry) {
    if (!entry.friendshipId || busyId) return;
    if (!window.confirm(`Remove ${entry.full_name || entry.username} from your friends?`)) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setBusyId(entry.id);
    try {
      const { error } = await supabase
        .from("friendships")
        .delete()
        .eq("id", entry.friendshipId);
      if (error) throw error;
      setFriends((prev) => prev.filter((f) => f.id !== entry.id));
      onChanged?.();
    } catch {
      // Best-effort.
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section
      aria-label="Friends"
      className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200"
    >
      <h2 className="text-sm font-bold text-[#211D33]">
        Friends{" "}
        <span className="ml-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-bold text-[#6F6B80]">
          {friends.length}
        </span>
      </h2>
      {loading ? (
        <p className="mt-3 text-sm text-[#6F6B80]">Loading friends...</p>
      ) : friends.length === 0 ? (
        <p className="mt-3 text-sm text-[#6F6B80]">No friends yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {friends.map((f) => {
            const name = f.full_name || f.username;
            return (
              <li key={f.id} className="flex items-center gap-3">
                <Avatar
                  name={name}
                  size="sm"
                  avatarUrl={f.avatar_url ?? null}
                  lazy
                />
                <Link
                  href={`/profile/${encodeURIComponent(f.username)}`}
                  className="min-w-0 flex-1 cursor-pointer truncate text-sm font-semibold text-[#211D33] transition-colors hover:underline"
                >
                  {name}
                </Link>
                {showRemove && (
                  <button
                    type="button"
                    onClick={() => void handleRemove(f)}
                    disabled={busyId === f.id}
                    className="shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold text-red-600 ring-1 ring-red-200 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
                <MessageButton userId={f.id} compact />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
