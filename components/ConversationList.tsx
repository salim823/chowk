"use client";

import { Avatar } from "@/components/Avatar";
import type { ConversationSummary } from "@/lib/messages";

/** Short "2m", "3h", "Tue" style timestamp for the conversation list. */
function shortTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** Chowk-style left pane: avatar, name, last-message preview, unread dot. */
export function ConversationList({
  conversations,
  activeId,
  onSelect,
  loading,
}: {
  conversations: ConversationSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
}) {
  return (
    <div className="flex h-full flex-col bg-white">
      <div className="border-b border-neutral-200 px-4 py-3">
        <h1 className="text-xl font-bold text-[#211D33]">Messages</h1>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="p-4 text-sm text-[#6F6B80]">Loading chats...</p>
        ) : conversations.length === 0 ? (
          <p className="p-4 text-sm text-[#6F6B80]">
            No conversations yet. Open a friend&rsquo;s profile and tap
            Message to start chatting.
          </p>
        ) : (
          <ul>
            {conversations.map((c) => {
              const name = c.other.full_name || c.other.username;
              const active = c.id === activeId;
              const preview = c.lastMessage
                ? c.lastMessage.body
                : "Say hello!";
              const when = c.lastMessage
                ? c.lastMessage.created_at
                : c.last_message_at;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    className={`flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors ${
                      active ? "bg-[#EEF2FF]" : "hover:bg-neutral-100"
                    }`}
                  >
                    <span className="relative shrink-0">
                      <Avatar
                        name={name}
                        size="md"
                        avatarUrl={c.other.avatar_url}
                      />
                      {c.unread > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                          {c.unread > 99 ? "99+" : c.unread}
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span
                          className={`truncate text-[15px] ${
                            c.unread > 0
                              ? "font-bold text-[#211D33]"
                              : "font-semibold text-[#211D33]"
                          }`}
                        >
                          {name}
                        </span>
                        <span className="shrink-0 text-xs text-[#6F6B80]">
                          {shortTime(when)}
                        </span>
                      </span>
                      <span
                        className={`block truncate text-sm ${
                          c.unread > 0
                            ? "font-semibold text-[#211D33]"
                            : "text-[#6F6B80]"
                        }`}
                      >
                        {preview}
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
