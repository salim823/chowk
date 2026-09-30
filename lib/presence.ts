"use client";

import { useSyncExternalStore } from "react";
import { useChatSettings } from "@/lib/chatSettings";

/**
 * Module-level online-user store. One shared source of truth fed by the
 * PresenceManager (mounted once inside ChatPopupProvider); every consumer
 * re-renders when the set changes.
 */
const onlineIds = new Set<string>();
const listeners = new Set<() => void>();
const EMPTY = new Set<string>();

function notify(): void {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      // A dead listener must not break the rest.
    }
  });
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function getSnapshot(): Set<string> {
  return onlineIds;
}

function getServerSnapshot(): Set<string> {
  return EMPTY;
}

/** Replace the online set (called by PresenceManager on sync/join/leave). */
export function setOnlineIds(ids: string[]): void {
  onlineIds.clear();
  for (const id of ids) onlineIds.add(id);
  notify();
}

/**
 * Ids of users currently tracked in the "chowk-online" presence channel.
 * Returns an empty set when the viewer turned Active Status OFF (Facebook
 * hides other people's dots too in that case).
 */
export function useOnlineUsers(): Set<string> {
  const { settings } = useChatSettings();
  const ids = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return settings.activeStatus ? ids : EMPTY;
}
