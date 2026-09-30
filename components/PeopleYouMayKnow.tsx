"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getMyFriendData } from "@/lib/friends";
import { notify } from "@/lib/notify";
import { Avatar } from "@/components/Avatar";
import type { ProfileLite } from "@/lib/types";

type Suggestion = ProfileLite & { id: string };

/**
 * "Students on Chowk" discovery cards, shown in the feed and on Explore.
 * Suggests profiles the user has no friendship (or block) relationship with
 * yet. Dismissing hides a card for the session; the whole section hides
 * when there is nothing to suggest.
 */
export function PeopleYouMayKnow() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [myUsername, setMyUsername] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setLoaded(true);
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) {
        setLoaded(true);
        return;
      }

      const friendData = await getMyFriendData(supabase, user.id);
      const { data: me } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .single();
      if (!cancelled && me) {
        setMyUsername((me as { username: string }).username);
      }

      const excluded = new Set<string>([
        user.id,
        ...friendData.acceptedIds,
        ...friendData.pendingSentIds,
        ...friendData.blockedIds,
        ...friendData.receivedRequests.map((r) => r.requester_id),
      ]);

      let query = supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        // The secret admin must never appear as a suggestion to anyone.
        .eq("is_admin", false)
        // Deleted accounts are tombstoned, never suggested.
        .not("is_deleted", "is", true)
        .order("created_at", { ascending: false })
        .limit(12);
      if (excluded.size > 0) {
        query = query.not("id", "in", `(${[...excluded].join(",")})`);
      }
      const { data } = await query;
      if (!cancelled) {
        setSuggestions(((data ?? []) as Suggestion[]).slice(0, 10));
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAddFriend(target: Suggestion) {
    if (busyId) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setBusyId(target.id);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase.from("friendships").insert({
        requester_id: user.id,
        addressee_id: target.id,
        status: "pending",
      });
      if (error) throw error;
      void notify({
        user_id: target.id,
        type: "friend_request",
        title: `${myUsername || "Someone"} sent you a friend request`,
      });
      setSent((prev) => new Set(prev).add(target.id));
    } catch {
      // Best-effort: the card stays so the user can retry.
    } finally {
      setBusyId(null);
    }
  }

  function handleDismiss(id: string) {
    setDismissed((prev) => new Set(prev).add(id));
  }

  const visible = suggestions.filter((s) => !dismissed.has(s.id));
  if (!loaded || visible.length === 0) return null;

  return (
    <section
      aria-label="Students on Chowk"
      className="chowk-card chowk-rise p-4"
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 className="flex items-center gap-2 text-[15px] font-bold text-[#211D33]">
          <span
            aria-hidden
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#4F46E5]"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </span>
          Students on Chowk
        </h2>
        <span className="text-xs font-medium text-[#6F6B80]">
          Say hello to a classmate
        </span>
      </div>
      <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
        {visible.map((s) => {
          const requested = sent.has(s.id);
          return (
            <div
              key={s.id}
              className="relative w-36 shrink-0 rounded-2xl bg-[#F5F4FA] p-3 text-center ring-1 ring-[#E6E3F0]"
            >
              <button
                type="button"
                onClick={() => handleDismiss(s.id)}
                aria-label={`Dismiss ${s.full_name || s.username}`}
                className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-white/80 text-sm font-bold text-[#6F6B80] shadow-sm transition-colors hover:bg-white hover:text-[#211D33]"
              >
                ×
              </button>
              <Link
                href={`/profile/${s.username}`}
                aria-label={`View ${s.full_name || s.username}'s profile`}
                className="block cursor-pointer"
              >
                <div className="flex justify-center">
                  <span className="block rounded-full bg-gradient-to-br from-[#4F46E5] to-[#EC4899] p-[2.5px] transition-shadow hover:shadow-md">
                    <span className="block rounded-full bg-white p-[2px]">
                      <Avatar
                        name={s.full_name || s.username}
                        size="lg"
                        avatarUrl={s.avatar_url ?? null}
                        lazy
                      />
                    </span>
                  </span>
                </div>
                <p className="mt-2 truncate text-sm font-bold text-[#211D33] hover:text-[#4F46E5] hover:underline">
                  {s.full_name || s.username}
                </p>
              </Link>
              <button
                type="button"
                onClick={() => handleAddFriend(s)}
                disabled={requested || busyId === s.id}
                className="chowk-btn mt-2.5 w-full py-1.5 text-sm disabled:bg-neutral-300 disabled:text-[#6F6B80]"
              >
                {requested
                  ? "Requested"
                  : busyId === s.id
                    ? "Sending..."
                    : "Add friend"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
