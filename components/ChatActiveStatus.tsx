"use client";

import { useOnlineUsers } from "@/lib/presence";

/** "Active 5 min ago" / "Active 2 hr ago" / "Active yesterday" / "Away". */
export function formatActiveAgo(iso: string | null | undefined): string {
  if (!iso) return "Away";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "Away";
  if (ms < 0) return "Active now";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `Active ${Math.max(mins, 1)} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Active ${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Active yesterday";
  return `Active ${days} days ago`;
}

/**
 * Presence for one user: online when tracked in the "chowk-online" presence
 * channel (empty when the viewer turned Active Status OFF — FB hides dots
 * too), otherwise derived from profiles.last_active_at.
 */
export function useActiveStatus(
  otherId: string,
  lastActiveAt?: string | null
): { online: boolean; text: string } {
  const onlineIds = useOnlineUsers();
  const online = onlineIds.has(otherId);
  return { online, text: online ? "Active now" : formatActiveAgo(lastActiveAt) };
}

/**
 * Small chat-header status line: green dot + "Active now", or the
 * last-active text. Replaces the old "@username" line under the name.
 */
export function ChatActiveStatus({
  otherId,
  lastActiveAt,
}: {
  otherId: string;
  lastActiveAt?: string | null;
}) {
  const { online, text } = useActiveStatus(otherId, lastActiveAt);
  return (
    <span className="flex items-center gap-1 text-xs text-[#6F6B80]">
      {online && (
        <span
          aria-hidden
          className="h-2 w-2 shrink-0 rounded-full bg-[#31A24C]"
        />
      )}
      <span className="truncate">{text}</span>
    </span>
  );
}
