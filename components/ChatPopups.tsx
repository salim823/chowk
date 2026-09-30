"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { useChatSettings } from "@/lib/chatSettings";
import { setOnlineIds, useOnlineUsers } from "@/lib/presence";
import { playMessageSound } from "@/lib/messageSound";
import {
  getOrCreateConversation,
  listConversations,
  type ConversationOther,
  type ConversationSummary,
} from "@/lib/messages";
import { Avatar } from "@/components/Avatar";
import { ChatActiveStatus } from "@/components/ChatActiveStatus";
import { ChatThread } from "@/components/ChatThread";
import { NewMessagePopup } from "@/components/NewMessagePopup";

const MAX_POPUPS = 3;

export interface ChatPopup {
  key: string;
  conversationId: string;
  other: ConversationOther;
}

interface ChatPopupsContextValue {
  popups: ChatPopup[];
  meId: string | null;
  /** Open a 1-on-1 chat with a user (popup on desktop, /messages on mobile). */
  openChat: (userId: string) => void;
  /** Open an existing conversation by id. */
  openConversation: (conversationId: string) => void;
  closePopup: (key: string) => void;
  isConversationOpen: (conversationId: string) => boolean;
  newMessageOpen: boolean;
  setNewMessageOpen: (open: boolean) => void;
}

const ChatPopupsContext = createContext<ChatPopupsContextValue>({
  popups: [],
  meId: null,
  openChat: () => {},
  openConversation: () => {},
  closePopup: () => {},
  isConversationOpen: () => false,
  newMessageOpen: false,
  setNewMessageOpen: () => {},
});

export function useChatPopups(): ChatPopupsContextValue {
  return useContext(ChatPopupsContext);
}

function isDesktopViewport(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(min-width: 1024px)").matches
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"
      aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

/**
 * Tracks {user_id} in the "chowk-online" Realtime Presence channel when the
 * viewer is signed in and Active Status is ON. Remounts (via key) when the
 * toggle flips so tracking starts/stops cleanly.
 *
 * The topic must stay shared ("chowk-online") — presence only syncs between
 * clients on the same topic. But supabase.channel() dedupes by topic: if the
 * previous mount's channel hasn't finished its async unsubscribe yet,
 * channel() hands back that still-joined instance and .on("presence", ...)
 * throws "cannot add ... callbacks ... after 'subscribe()'". Serializing the
 * teardown across remounts avoids the crash while keeping the shared topic.
 */
let onlineTeardown: Promise<unknown> | null = null;

function PresenceManager({ active }: { active: boolean }) {
  useEffect(() => {
    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    function readState(): void {
      if (cancelled || !channel) return;
      const presence = channel.presenceState();
      const ids: string[] = [];
      for (const metas of Object.values(presence)) {
        for (const m of metas as { user_id?: unknown }[]) {
          if (m && typeof m.user_id === "string") ids.push(m.user_id);
        }
      }
      setOnlineIds(ids);
    }

    (async () => {
      const supabase = getSupabaseClient();
      if (!supabase || cancelled) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      // Wait for the previous mount's channel to finish tearing down so
      // supabase.channel() creates a fresh instance (see note above).
      if (onlineTeardown) {
        try {
          await onlineTeardown;
        } catch {
          // Best-effort; a failed teardown just means we try fresh.
        }
        onlineTeardown = null;
      }
      if (cancelled) return;
      channel = supabase.channel("chowk-online");
      channel.on("presence", { event: "sync" }, readState);
      channel.on("presence", { event: "join" }, readState);
      channel.on("presence", { event: "leave" }, readState);
      channel.subscribe(async (status) => {
        if (cancelled || status !== "SUBSCRIBED") return;
        readState();
        if (active && user && channel) {
          try {
            await channel.track({
              user_id: user.id,
              online_at: new Date().toISOString(),
            });
          } catch {
            // Presence is best-effort.
          }
        }
      });
    })();

    return () => {
      cancelled = true;
      if (channel) {
        const supabase = getSupabaseClient();
        if (supabase) {
          // Remember the pending teardown so a remount waits for it instead
          // of crashing on the still-joined channel (see note above).
          onlineTeardown = supabase.removeChannel(channel).catch(() => "teardown-failed");
        }
      }
      setOnlineIds([]);
    };
  }, [active]);

  return null;
}

/**
 * Watches every incoming message for the signed-in user (Realtime INSERT on
 * messages; RLS only delivers conversations they belong to). Plays the
 * message sound and auto-opens a popup per the user's chat settings.
 * Never fires for messages the user sent themselves.
 */
function IncomingMessageListener() {
  const { openConversation, isConversationOpen } = useChatPopups();
  const { settings } = useChatSettings();
  const pathname = usePathname();
  const live = useRef({ settings, openConversation, isConversationOpen, pathname });
  live.current = { settings, openConversation, isConversationOpen, pathname };

  useEffect(() => {
    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    (async () => {
      const supabase = getSupabaseClient();
      if (!supabase || cancelled) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled || !user) return;
      const meId = user.id;
      // Unique topic per run (see above): avoids the "cannot add callbacks
      // after subscribe()" throw when a previous channel is still tearing
      // down.
      const runId = `${Date.now().toString(36)}${Math.random()
        .toString(36)
        .slice(2, 8)}`;

      channel = supabase
        .channel(`chowk-incoming:${runId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages" },
          (payload) => {
            const row = payload.new as {
              conversation_id?: string;
              sender_id?: string;
            };
            if (!row?.conversation_id || !row?.sender_id) return;
            if (row.sender_id === meId) return; // never for my own messages
            const s = live.current;
            if (s.settings.messageSounds) playMessageSound();
            if (!s.settings.popupNewMessages) return;
            if (s.pathname.startsWith("/messages")) return; // already viewing it there
            if (s.isConversationOpen(row.conversation_id)) return;
            void s.openConversation(row.conversation_id);
          }
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) {
        const supabase = getSupabaseClient();
        if (supabase) void supabase.removeChannel(channel);
      }
    };
    // Subscribes once; live ref always holds fresh settings/callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

/** One floating chat window (desktop only). */
function ChatPopupWindow({
  popup,
  meId,
  onClose,
}: {
  popup: ChatPopup;
  meId: string | null;
  onClose: () => void;
}) {
  const onlineIds = useOnlineUsers();
  const other = popup.other;
  const name = other.full_name || other.username;
  const online = onlineIds.has(other.id);
  const summary: ConversationSummary = useMemo(
    () => ({
      id: popup.conversationId,
      last_message_at: new Date().toISOString(),
      other,
      lastMessage: null,
      unread: 0,
    }),
    [popup.conversationId, other]
  );

  return (
    <div className="pointer-events-auto flex h-[420px] w-[328px] flex-col overflow-hidden rounded-t-xl bg-white shadow-2xl ring-1 ring-neutral-300">
      {/* Popup header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-neutral-200 px-2 py-1.5">
        <span className="relative shrink-0">
          <Avatar name={name} size="xs" avatarUrl={other.avatar_url ?? null} />
          {online && (
            <span
              aria-label="Active now"
              className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#31A24C]"
            />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[#211D33]">{name}</p>
          <ChatActiveStatus
            otherId={other.id}
            lastActiveAt={other.last_active_at}
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close chat with ${name}`}
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#6F6B80] transition-colors hover:bg-neutral-100 hover:text-[#211D33]"
        >
          <CloseIcon />
        </button>
      </div>
      {/* Thread (compact: popup owns the header) */}
      <div className="min-h-0 flex-1">
        {meId ? (
          <ChatThread
            summary={summary}
            meId={meId}
            compact
            onMessagesChanged={() => {}}
          />
        ) : (
          <p className="py-8 text-center text-sm text-[#6F6B80]">
            Loading chat...
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Floating chat popups (Chowk-style, desktop only) + presence tracking +
 * incoming-message listener. Mount once high in the logged-in layout.
 */
export function ChatPopupProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { settings } = useChatSettings();
  const [version, force] = useReducer((x: number) => x + 1, 0);
  const popupsRef = useRef<ChatPopup[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [newMessageOpen, setNewMessageOpen] = useState(false);

  const setPopups = useCallback((next: ChatPopup[]) => {
    popupsRef.current = next;
    force();
  }, []);

  // Who is signed in?
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) return;
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!cancelled) setMeId(user?.id ?? null);
      } catch {
        // Popups degrade to a loading state.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Insert a popup: bring existing to front, cap at MAX_POPUPS. */
  const insertPopup = useCallback(
    (popup: ChatPopup) => {
      const prev = popupsRef.current;
      const existing = prev.find(
        (p) => p.conversationId === popup.conversationId
      );
      if (existing) {
        setPopups([
          ...prev.filter((p) => p.key !== existing.key),
          existing,
        ]);
        return;
      }
      const trimmed = prev.length >= MAX_POPUPS ? prev.slice(1) : prev;
      setPopups([...trimmed, popup]);
    },
    [setPopups]
  );

  const openConversation = useCallback(
    async (conversationId: string) => {
      if (!isDesktopViewport()) {
        router.push(`/messages?with=${encodeURIComponent(conversationId)}`);
        return;
      }
      const existing = popupsRef.current.find(
        (p) => p.conversationId === conversationId
      );
      if (existing) {
        insertPopup(existing);
        return;
      }
      const supabase = getSupabaseClient();
      if (!supabase) return;
      try {
        const list = await listConversations(supabase);
        const found = list.find((c) => c.id === conversationId);
        if (!found) return;
        insertPopup({
          key: `popup-${Date.now()}`,
          conversationId,
          other: found.other,
        });
      } catch {
        // Unknown/blocked conversation: silent no-op.
      }
    },
    [insertPopup, router]
  );

  const openChat = useCallback(
    async (userId: string) => {
      if (!isDesktopViewport()) {
        router.push(`/messages?user=${encodeURIComponent(userId)}`);
        return;
      }
      const existing = popupsRef.current.find((p) => p.other.id === userId);
      if (existing) {
        insertPopup(existing);
        return;
      }
      const supabase = getSupabaseClient();
      if (!supabase) return;
      try {
        const conversationId = await getOrCreateConversation(supabase, userId);
        const { data } = await supabase
          .from("profiles")
          .select("id, username, full_name, avatar_url, last_active_at")
          .eq("id", userId)
          .single();
        if (!data) return;
        insertPopup({
          key: `popup-${Date.now()}`,
          conversationId,
          other: data as ConversationOther,
        });
      } catch {
        // Blocked users etc: silent no-op (buttons are hidden for them anyway).
      }
    },
    [insertPopup, router]
  );

  const closePopup = useCallback(
    (key: string) => {
      setPopups(popupsRef.current.filter((p) => p.key !== key));
    },
    [setPopups]
  );

  const isConversationOpen = useCallback((conversationId: string) => {
    return popupsRef.current.some((p) => p.conversationId === conversationId);
  }, []);

  const value = useMemo<ChatPopupsContextValue>(
    () => ({
      popups: popupsRef.current,
      meId,
      openChat,
      openConversation,
      closePopup,
      isConversationOpen,
      newMessageOpen,
      setNewMessageOpen,
    }),
    [
      // `version` bumps on every popup open/close so consumers re-render.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      version,
      meId,
      openChat,
      openConversation,
      closePopup,
      isConversationOpen,
      newMessageOpen,
    ]
  );

  return (
    <ChatPopupsContext.Provider value={value}>
      {children}
      {/* Presence: remounts when the toggle flips so tracking restarts cleanly. */}
      <PresenceManager key={settings.activeStatus ? "on" : "off"} active={settings.activeStatus} />
      <IncomingMessageListener />
      {/* Floating popups, bottom-right, desktop only */}
      <div className="pointer-events-none fixed bottom-0 right-24 z-40 hidden items-end gap-3 lg:flex">
        {popupsRef.current.map((p) => (
          <ChatPopupWindow
            key={p.key}
            popup={p}
            meId={meId}
            onClose={() => closePopup(p.key)}
          />
        ))}
      </div>
      {newMessageOpen && (
        <NewMessagePopup onClose={() => setNewMessageOpen(false)} />
      )}
    </ChatPopupsContext.Provider>
  );
}
