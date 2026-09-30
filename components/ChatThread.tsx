"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { Avatar } from "@/components/Avatar";
import { ChatActiveStatus } from "@/components/ChatActiveStatus";
import type {
  ConversationOther,
  ConversationSummary,
  MessageRow,
} from "@/lib/messages";
import { listMessages, markRead, sendMessage, deleteMessage } from "@/lib/messages";

function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3.4 20.4 21.9 12 3.4 3.6l2.6 7.1 9.5 1.3-9.5 1.3z" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Message composer: auto-growing textarea, Enter sends, Shift+Enter newline. */
function ChatInput({
  onSend,
  sending,
}: {
  onSend: (body: string) => void;
  sending: boolean;
}) {
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  function submit() {
    const text = value.trim();
    if (!text || sending) return;
    onSend(text);
    setValue("");
    requestAnimationFrame(() => ref.current?.focus());
  }

  return (
    <div className="flex items-end gap-2 border-t border-neutral-200 bg-white px-3 py-2.5">
      <textarea
        ref={ref}
        rows={1}
        value={value}
        maxLength={2000}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Type a message..."
        aria-label="Type a message"
        className="max-h-32 flex-1 resize-none rounded-2xl bg-neutral-100 px-4 py-2.5 text-[15px] text-[#211D33] placeholder:text-[#6F6B80] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/40"
      />
      <button
        type="button"
        onClick={submit}
        disabled={!value.trim() || sending}
        aria-label="Send message"
        className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#4F46E5] text-white transition-colors hover:bg-[#4338CA] disabled:cursor-not-allowed disabled:opacity-40"
      >
        <SendIcon />
      </button>
    </div>
  );
}

/**
 * The viewer's own message: blue bubble, per-message timestamp, and a "…"
 * menu (hover on desktop, long-press/right-click on touch) with Delete.
 * Deletes via RLS-guarded row delete; the realtime DELETE handler drops it
 * from every open thread.
 */
function OwnMessageBubble({
  m,
  onDeleted,
}: {
  m: MessageRow;
  onDeleted: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const longPressRef = useRef<number | null>(null);

  function stopLongPress() {
    if (longPressRef.current !== null) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }

  function startLongPress() {
    stopLongPress();
    longPressRef.current = window.setTimeout(() => setMenuOpen(true), 550);
  }

  useEffect(() => stopLongPress, []);

  async function handleDelete() {
    setMenuOpen(false);
    if (!window.confirm("Delete this message?")) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      await deleteMessage(supabase, m.id);
      onDeleted(m.id);
    } catch {
      // RLS or network failure: leave the message in place.
    }
  }

  return (
    <div className="group flex max-w-[75%] flex-col items-end">
      <div className="flex items-center gap-1">
        <span className="relative">
          <button
            type="button"
            aria-label="Message options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenuOpen(true);
            }}
            onTouchStart={startLongPress}
            onTouchEnd={stopLongPress}
            onTouchMove={stopLongPress}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-[#6F6B80] opacity-0 transition-opacity hover:bg-neutral-200 group-hover:opacity-100 focus-visible:opacity-100"
          >
            <DotsIcon />
          </button>
          {menuOpen && (
            <>
              <button
                type="button"
                aria-hidden
                tabIndex={-1}
                onClick={() => setMenuOpen(false)}
                className="fixed inset-0 z-20 cursor-default"
              />
              <div
                role="menu"
                className="absolute bottom-8 right-0 z-30 w-36 overflow-hidden rounded-xl bg-white py-1 shadow-xl ring-1 ring-neutral-200"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => void handleDelete()}
                  className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium text-[#211D33] transition-colors hover:bg-neutral-100"
                >
                  <TrashIcon />
                  Delete
                </button>
              </div>
            </>
          )}
        </span>
        <div className="whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-[#4F46E5] px-3.5 py-2 text-[15px] leading-snug text-white">
          {m.body}
        </div>
      </div>
      <p className="mt-0.5 pr-1 text-[11px] text-[#6F6B80]">
        {formatClock(m.created_at)}
      </p>
    </div>
  );
}
/**
 * One open chat: header with the other person's name + active status, message
 * bubbles (own = blue right, theirs = gray left with avatar), per-message
 * timestamps, delete for own messages, live updates via Supabase realtime
 * with a 15s polling fallback, and read receipts.
 */
export function ChatThread({
  summary,
  meId,
  onBack,
  onMessagesChanged,
  compact = false,
}: {
  summary: ConversationSummary;
  meId: string;
  /** Shown on mobile only; desktop renders list + thread side by side. */
  onBack?: () => void;
  /** Lets the parent refresh unread counts / previews after activity. */
  onMessagesChanged: () => void;
  /** Compact mode for floating chat popups: the popup owns the header. */
  compact?: boolean;
}) {
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const convId = summary.id;
  const other: ConversationOther = summary.other;
  const otherName = other.full_name || other.username;

  // Load the thread.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        if (!cancelled) {
          setError("Chat is not available right now.");
          setLoading(false);
        }
        return;
      }
      try {
        const rows = await listMessages(supabase, convId);
        if (!cancelled) {
          setMessages(rows);
          setLoading(false);
        }
        await markRead(supabase, convId);
        if (!cancelled) onMessagesChanged();
      } catch {
        if (!cancelled) {
          setError("Could not load messages. Please try again.");
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId]);

  // Keep pinned to the newest message.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, loading]);

  // Realtime new messages + read-receipt updates + 15s polling fallback
  // while the tab is visible.
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    let stopped = false;
    // Unique topic per effect run: supabase.channel() dedupes by topic and
    // hands back the existing channel if the previous one hasn't finished
    // its async unsubscribe yet — calling .on() on that joined channel
    // throws "cannot add ... callbacks ... after 'subscribe()'".
    const runId = `${Date.now().toString(36)}${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    async function refresh() {
      if (stopped || document.hidden) return;
      try {
        const rows = await listMessages(supabase!, convId);
        if (stopped) return;
        setMessages((prev) => {
          if (
            prev.length === rows.length &&
            prev[prev.length - 1]?.id === rows[rows.length - 1]?.id
          ) {
            return prev;
          }
          return rows;
        });
        // Reliably mark incoming messages read while the thread is open.
        await markRead(supabase!, convId);
        onMessagesChanged();
      } catch {
        // Best-effort; realtime or the next poll will catch up.
      }
    }

    const channel = supabase
      .channel(`messages:${convId}:${runId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${convId}`,
        },
        () => {
          void refresh();
        }
      )
      // UPDATEs carry read_at changes: read receipts appear live without
      // waiting for the poller.
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${convId}`,
        },
        () => {
          void refresh();
        }
      )
      // DELETEs drop the bubble from every open thread instantly.
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${convId}`,
        },
        (payload) => {
          const id = (payload.old as { id?: string } | null)?.id;
          if (id) {
            setMessages((prev) => prev.filter((m) => m.id !== id));
          }
        }
      )
      .subscribe();
    const timer = setInterval(() => void refresh(), 15000);

    // Mark read immediately when the tab regains focus (the poller skips
    // hidden tabs, so this closes the gap).
    function onVisible() {
      if (document.hidden) return;
      const s = getSupabaseClient();
      if (!s) return;
      void markRead(s, convId).then(() => {
        if (!stopped) onMessagesChanged();
      });
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convId]);

  async function handleSend(body: string) {
    const supabase = getSupabaseClient();
    if (!supabase || sending) return;
    setSending(true);
    try {
      const msg = await sendMessage(supabase, convId, body);
      setMessages((prev) =>
        prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]
      );
      onMessagesChanged();
    } catch {
      setError("Message could not be sent. Please try again.");
    } finally {
      setSending(false);
    }
  }

  // Chowk-style read receipt: the single newest message of mine that the
  // other person has seen (read_at set by their markRead). Nothing shows
  // until they have read at least one message.
  let lastSeenId: string | null = null;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.sender_id === meId && m.read_at) {
      lastSeenId = m.id;
      break;
    }
  }

  let lastDay = "";
  return (
    <div className="flex h-full flex-col bg-white">
      {/* Header (popups render their own header in compact mode) */}
      {!compact && (
        <div className="flex items-center gap-2 border-b border-neutral-200 px-3 py-2.5">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to conversations"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-[#211D33] transition-colors hover:bg-neutral-100"
          >
            <BackIcon />
          </button>
        )}
        <Avatar name={otherName} size="sm" avatarUrl={other.avatar_url} />
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold text-[#211D33]">
            {otherName}
          </p>
          <ChatActiveStatus
            otherId={other.id}
            lastActiveAt={other.last_active_at}
          />
        </div>
      </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-[#F5F4FA] px-3 py-4">
        {loading ? (
          <p className="py-8 text-center text-sm text-[#6F6B80]">
            Loading messages...
          </p>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-[#6F6B80]">
            No messages yet. Say hello!
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {messages.map((m) => {
              const mine = m.sender_id === meId;
              const day = formatDay(m.created_at);
              const showDay = day !== lastDay;
              lastDay = day;
              return (
                <div key={m.id}>
                  {showDay && (
                    <p className="my-2 text-center text-xs font-semibold text-[#6F6B80]">
                      {day}
                    </p>
                  )}
                  <div
                    className={`flex items-end gap-2 ${
                      mine ? "justify-end" : "justify-start"
                    }`}
                  >
                    {!mine && (
                      <Avatar
                        name={otherName}
                        size="xs"
                        avatarUrl={other.avatar_url}
                      />
                    )}
                    {mine ? (
                      <OwnMessageBubble
                        m={m}
                        onDeleted={(id) => {
                          setMessages((prev) =>
                            prev.filter((x) => x.id !== id)
                          );
                          onMessagesChanged();
                        }}
                      />
                    ) : (
                      <div className="flex max-w-[75%] flex-col items-start">
                        <div className="whitespace-pre-wrap break-words rounded-2xl rounded-bl-md bg-white px-3.5 py-2 text-[15px] leading-snug text-[#211D33] shadow-sm ring-1 ring-neutral-200">
                          {m.body}
                        </div>
                        <p className="mt-0.5 pl-1 text-[11px] text-[#6F6B80]">
                          {formatClock(m.created_at)}
                        </p>
                      </div>
                    )}
                  </div>
                  {/* Chowk-style read receipt: the other person's tiny avatar under
                      the newest message of mine they have seen. */}
                  {mine && lastSeenId === m.id && m.read_at ? (
                    <div
                      className="mt-0.5 flex justify-end pr-1"
                      title={`Seen ${formatClock(m.read_at)}`}
                    >
                      <Avatar
                        name={otherName}
                        size="xxs"
                        avatarUrl={other.avatar_url}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
        {error && (
          <p className="mt-2 text-center text-xs text-red-600">{error}</p>
        )}
      </div>

      <ChatInput onSend={(b) => void handleSend(b)} sending={sending} />
    </div>
  );
}
