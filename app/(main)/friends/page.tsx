"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { FriendRequests } from "@/components/FriendRequests";
import { SentRequests } from "@/components/SentRequests";
import { FriendsList } from "@/components/FriendsList";

/** Dedicated Friends page: requests (received/sent) + friends list. */
export default function FriendsPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

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
      if (!cancelled) {
        setUserId(user?.id ?? null);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = () => setRefreshKey((k) => k + 1);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-3 bg-[#F5F4FA] px-3 py-3 sm:px-4 lg:bg-transparent">
      <header className="px-1">
        <h1 className="text-xl font-bold text-[#211D33]">Friends</h1>
      </header>

      {loading ? (
        <div className="rounded-2xl bg-white p-6 text-center ring-1 ring-neutral-200">
          <p className="text-sm text-[#6F6B80]">Loading...</p>
        </div>
      ) : userId ? (
        <div key={refreshKey} className="flex flex-col gap-3">
          <Link
            href="/search"
            className="flex cursor-pointer items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-neutral-200 transition-colors hover:ring-[#4F46E5]/60"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EEF2FF] text-[#4F46E5]">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold text-[#211D33]">
                Find friends
              </span>
              <span className="block truncate text-sm text-[#6F6B80]">
                Search for students on Chowk
              </span>
            </span>
            <span className="text-[#6F6B80]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </span>
          </Link>
          <FriendRequests userId={userId} onChanged={refresh} />
          <SentRequests userId={userId} />
          <FriendsList userId={userId} showRemove onChanged={refresh} />
        </div>
      ) : (
        <p className="rounded-2xl bg-white p-6 text-center text-sm text-[#6F6B80] ring-1 ring-neutral-200">
          Please log in to see your friends.
        </p>
      )}
    </main>
  );
}
