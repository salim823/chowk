"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getAcceptedFriendIds } from "@/lib/friends";
import { useChatSettings } from "@/lib/chatSettings";
import { useOnlineUsers } from "@/lib/presence";
import { useChatPopups } from "@/components/ChatPopups";
import { ChatSettingsPanel } from "@/components/ChatSettingsPanel";
import { Avatar } from "@/components/Avatar";
import type { ProfileLite } from "@/lib/types";

type Friend = ProfileLite & { id: string };

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"
      aria-hidden="true">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
    </svg>
  );
}

/**
 * Desktop right sidebar (Chowk-style "Contacts"): friends list with
 * green online dots, name filter, and a "..." menu opening Chat settings.
 * Clicking a contact opens a floating chat popup. Hidden entirely when the
 * user turns "Show contacts" off.
 */
export function ContactsSidebar() {
  const pathname = usePathname();
  const { settings } = useChatSettings();
  const onlineIds = useOnlineUsers();
  const { openChat } = useChatPopups();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        if (!cancelled) setLoaded(true);
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setLoaded(true);
        return;
      }
      const ids = await getAcceptedFriendIds(supabase, user.id, 100);
      if (ids.length > 0 && !cancelled) {
        const { data } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url")
          .in("id", ids)
          .order("full_name", { ascending: true });
        if (!cancelled) setFriends((data ?? []) as Friend[]);
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // Hide the whole rail when the user turns "Show contacts" off.
  if (!settings.showContacts) return null;

  const q = filter.trim().toLowerCase();
  // Online friends first, like Chowk.
  const visible = friends
    .filter((f) => (f.full_name || f.username).toLowerCase().includes(q))
    .sort(
      (a, b) =>
        (onlineIds.has(b.id) ? 1 : 0) - (onlineIds.has(a.id) ? 1 : 0)
    );

  return (
    <div className="sticky top-20 h-[calc(100vh-5rem)] overflow-y-auto py-6 pl-2">
      <div className="flex items-center justify-between px-2">
        <h2 className="text-sm font-bold text-[#211D33]">Contacts</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSearchOpen((v) => !v)}
            aria-label="Search contacts"
            aria-expanded={searchOpen}
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-[#211D33]"
          >
            <SearchIcon />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Chat settings"
              aria-expanded={menuOpen}
              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-[#211D33]"
            >
              <DotsIcon />
            </button>
            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40 cursor-pointer"
                  onClick={() => setMenuOpen(false)}
                  aria-hidden="true"
                />
                <div className="absolute right-0 top-9 z-50">
                  <ChatSettingsPanel />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      {searchOpen && (
        <div className="relative mt-2">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth={2} strokeLinecap="round"
              strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </span>
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search contacts"
            autoComplete="off"
            aria-label="Search contacts"
            autoFocus
            className="w-full rounded-full bg-neutral-200/60 py-1.5 pl-9 pr-3 text-sm text-[#211D33] placeholder:text-neutral-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/40"
          />
        </div>
      )}
      {!loaded ? null : friends.length === 0 ? (
        <p className="px-2 pt-3 text-sm text-[#6F6B80]">
          No friends yet — add some!
        </p>
      ) : visible.length === 0 ? (
        <p className="px-2 pt-3 text-sm text-[#6F6B80]">
          No contacts match your search.
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-0.5">
          {visible.map((f) => {
            const name = f.full_name || f.username;
            const online = onlineIds.has(f.id);
            return (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => void openChat(f.id)}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-neutral-200"
                >
                  <span className="relative shrink-0">
                    <Avatar
                      name={name}
                      size="sm"
                      tone="neutral"
                      avatarUrl={f.avatar_url ?? null}
                      lazy
                    />
                    {online && (
                      <span
                        aria-label={`${name} is active now`}
                        className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-neutral-100 bg-[#31A24C]"
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[#211D33]">
                      {name}
                    </span>
                    {online && (
                      <span className="block text-xs text-[#6F6B80]">
                        Active now
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
