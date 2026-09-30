"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

export interface ChatSettings {
  /** Play a soft beep on incoming messages. */
  messageSounds: boolean;
  /** Auto-open a chat popup when a new message arrives. */
  popupNewMessages: boolean;
  /** Show the desktop Contacts sidebar. */
  showContacts: boolean;
  /** Broadcast my online presence (and see others'). */
  activeStatus: boolean;
}

export const DEFAULT_CHAT_SETTINGS: ChatSettings = {
  messageSounds: true,
  popupNewMessages: true,
  showContacts: true,
  activeStatus: true,
};

function keyFor(userId: string): string {
  return `chowk-chat-settings:${userId}`;
}

interface ChatSettingsContextValue {
  settings: ChatSettings;
  userId: string | null;
  updateSettings: (patch: Partial<ChatSettings>) => void;
}

const ChatSettingsContext = createContext<ChatSettingsContextValue>({
  settings: DEFAULT_CHAT_SETTINGS,
  userId: null,
  updateSettings: () => {},
});

/**
 * Per-user chat settings, persisted in localStorage under a key that
 * includes the user id. Everything here is a real, working toggle.
 */
export function ChatSettingsProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [settings, setSettings] = useState<ChatSettings>(DEFAULT_CHAT_SETTINGS);
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = userId;

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
        if (!cancelled) setUserId(user?.id ?? null);
      } catch {
        // Settings stay at defaults.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Load this user's saved settings (or defaults on first run).
  useEffect(() => {
    if (!userId) {
      setSettings(DEFAULT_CHAT_SETTINGS);
      return;
    }
    try {
      const raw = localStorage.getItem(keyFor(userId));
      if (raw) {
        setSettings({
          ...DEFAULT_CHAT_SETTINGS,
          ...(JSON.parse(raw) as Partial<ChatSettings>),
        });
        return;
      }
    } catch {
      // Corrupt JSON: fall through to defaults.
    }
    setSettings(DEFAULT_CHAT_SETTINGS);
  }, [userId]);

  const updateSettings = useCallback((patch: Partial<ChatSettings>) => {
    const uid = userIdRef.current;
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      if (uid) {
        try {
          localStorage.setItem(keyFor(uid), JSON.stringify(next));
        } catch {
          // Storage is optional.
        }
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ settings, userId, updateSettings }),
    [settings, userId, updateSettings]
  );

  return (
    <ChatSettingsContext.Provider value={value}>
      {children}
    </ChatSettingsContext.Provider>
  );
}

export function useChatSettings(): ChatSettingsContextValue {
  return useContext(ChatSettingsContext);
}
