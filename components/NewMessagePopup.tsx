"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getAcceptedFriendIds } from "@/lib/friends";
import { useChatPopups } from "@/components/ChatPopups";
import { useOnlineUsers } from "@/lib/presence";
import { Avatar } from "@/components/Avatar";
import type { ProfileLite } from "@/lib/types";

type Friend = ProfileLite & { id: string };

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"
      aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

/**
 * "New message" popup (desktop only): search friends by name, click one to
 * open a chat popup with them.
 */
export function NewMessagePopup({ onClose }: { onClose: () => void }) {
  const { openChat } = useChatPopups();
  const onlineIds = useOnlineUsers();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

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
      const ids = await getAcceptedFriendIds(supabase, user.id, 200);
      let list: Friend[] = [];
      if (ids.length > 0) {
        const { data } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", ids)
          .order("full_name", { ascending: true });
        list = (data ?? []) as Friend[];
      }
      if (!cancelled) {
        setFriends(list);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const q = query.trim().toLowerCase();
  const visible = friends
    .filter((f) => (f.full_name || f.username).toLowerCase().includes(q))
    .sort(
      (a, b) =>
        (onlineIds.has(b.id) ? 1 : 0) - (onlineIds.has(a.id) ? 1 : 0)
    );

  return (
    <div className="fixed bottom-20 right-6 z-50 hidden h-[420px] w-[328px] flex-col overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-neutral-300 lg:flex">
      <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-3 py-2.5">
        <p className="text-[15px] font-bold text-[#211D33]">New message</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close new message"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[#6F6B80] transition-colors hover:bg-neutral-100 hover:text-[#211D33]"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="shrink-0 border-b border-neutral-200 px-3 py-2">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
            <SearchIcon />
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search friends"
            autoComplete="off"
            aria-label="Search friends"
            autoFocus
            className="w-full rounded-full bg-neutral-100 py-2 pl-9 pr-3 text-sm text-[#211D33] placeholder:text-[#6F6B80] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/40"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {loading ? (
          <p className="p-4 text-sm text-[#6F6B80]">Loading friends...</p>
        ) : visible.length === 0 ? (
          <p className="p-4 text-sm text-[#6F6B80]">
            {friends.length === 0
              ? "No friends yet. Add friends to start chatting."
              : "No friends match your search."}
          </p>
        ) : (
          <ul>
            {visible.map((f) => {
              const name = f.full_name || f.username;
              const online = onlineIds.has(f.id);
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      void openChat(f.id);
                    }}
                    className="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-neutral-100"
                  >
                    <span className="relative shrink-0">
                      <Avatar
                        name={name}
                        size="sm"
                        avatarUrl={f.avatar_url ?? null}
                        lazy
                      />
                      {online && (
                        <span
                          aria-label="Active now"
                          className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-[#31A24C]"
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-[#211D33]">
                        {name}
                      </span>
                      <span className="block truncate text-xs text-[#6F6B80]">
                        {online ? "Active now" : ""}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
