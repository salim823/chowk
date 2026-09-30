"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { timeAgo } from "@/lib/time";
import { Avatar } from "./Avatar";

type SentRequest = {
  id: string;
  addressee_id: string;
  created_at: string;
  addressee: {
    id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
};

/** Friend requests the viewer sent, with Cancel. */
export function SentRequests({ userId }: { userId: string }) {
  const [requests, setRequests] = useState<SentRequest[]>([]);
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
        .select("id, addressee_id, created_at")
        .eq("requester_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      const rows = (data ?? []) as Omit<SentRequest, "addressee">[];
      let byId = new Map<string, SentRequest["addressee"]>();
      if (rows.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in(
            "id",
            rows.map((r) => r.addressee_id)
          );
        byId = new Map(
          ((profs ?? []) as NonNullable<SentRequest["addressee"]>[]).map(
            (p) => [p.id, p]
          )
        );
      }
      if (!cancelled) {
        setRequests(
          rows.map((r) => ({ ...r, addressee: byId.get(r.addressee_id) ?? null }))
        );
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  async function cancel(requestId: string) {
    if (busyId) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setBusyId(requestId);
    try {
      const { error } = await supabase
        .from("friendships")
        .delete()
        .eq("id", requestId);
      if (error) throw error;
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
    } catch {
      // Best-effort.
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200">
        <p className="text-sm text-[#6F6B80]">Loading sent requests...</p>
      </section>
    );
  }
  if (requests.length === 0) return null;

  return (
    <section
      aria-label="Sent requests"
      className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200"
    >
      <h2 className="text-sm font-bold text-[#211D33]">
        Sent requests{" "}
        <span className="ml-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-bold text-[#6F6B80]">
          {requests.length}
        </span>
      </h2>
      <ul className="mt-3 flex flex-col gap-3">
        {requests.map((r) => {
          const name =
            r.addressee?.full_name || r.addressee?.username || "Unknown";
          return (
            <li key={r.id} className="flex items-center gap-3">
              <Avatar
                name={name}
                size="sm"
                avatarUrl={r.addressee?.avatar_url ?? null}
                lazy
              />
              <div className="min-w-0 flex-1">
                {r.addressee?.username ? (
                  <Link
                    href={`/profile/${encodeURIComponent(r.addressee.username)}`}
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
                onClick={() => void cancel(r.id)}
                disabled={busyId === r.id}
                className="shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold text-[#6F6B80] ring-1 ring-neutral-200 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
