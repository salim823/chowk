"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import {
  getOrCreateConversation,
  listConversations,
  type ConversationSummary,
} from "@/lib/messages";
import { ConversationList } from "@/components/ConversationList";
import { ChatThread } from "@/components/ChatThread";

function MessagesInner() {
  const searchParams = useSearchParams();
  const [meId, setMeId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);

  const refreshConversations = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    try {
      const list = await listConversations(supabase);
      setConversations(list);
    } catch {
      // Best-effort: realtime / pollers will retry.
    }
  }, []);

  // Initial load: me + conversations.
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
      if (!cancelled) setMeId(user.id);
      try {
        const list = await listConversations(supabase);
        if (!cancelled) {
          setConversations(list);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Deep links: ?with=<conversationId> selects a thread,
  // ?user=<userId> opens (or creates) the 1-on-1 conversation.
  useEffect(() => {
    const withId = searchParams.get("with");
    const userId = searchParams.get("user");
    if (withId) {
      setActiveId(withId);
      return;
    }
    if (!userId || resolving) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setResolving(true);
    (async () => {
      try {
        const convId = await getOrCreateConversation(supabase, userId);
        setActiveId(convId);
        const list = await listConversations(supabase);
        setConversations(list);
      } catch {
        // Blocked / missing user: stay on the list.
      } finally {
        setResolving(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Keep the list fresh while the tab is visible (15s fallback).
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) void refreshConversations();
    }, 15000);
    return () => clearInterval(timer);
  }, [refreshConversations]);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  // Mobile: thread view replaces the list, with a back button.
  // Desktop (md+): list + thread side by side.
  return (
    <div className="mx-auto flex h-[calc(100dvh-7rem)] max-w-6xl flex-col bg-[#F5F4FA] md:h-[calc(100dvh-4rem)]">
      {/* Mobile thread view */}
      {active && meId && (
        <div className="flex h-full flex-col md:hidden">
          <ChatThread
            summary={active}
            meId={meId}
            onBack={() => setActiveId(null)}
            onMessagesChanged={() => void refreshConversations()}
          />
        </div>
      )}

      {/* Mobile list view */}
      <div className={`h-full md:hidden ${active ? "hidden" : ""}`}>
        <ConversationList
          conversations={conversations}
          activeId={activeId}
          onSelect={setActiveId}
          loading={loading || resolving}
        />
      </div>

      {/* Desktop: side by side */}
      <div className="hidden h-full gap-6 p-4 md:flex">
        <div className="w-96 shrink-0 overflow-hidden rounded-2xl shadow-sm ring-1 ring-neutral-200">
          <ConversationList
            conversations={conversations}
            activeId={activeId}
            onSelect={setActiveId}
            loading={loading || resolving}
          />
        </div>
        <div className="min-w-0 flex-1 overflow-hidden rounded-2xl shadow-sm ring-1 ring-neutral-200">
          {active && meId ? (
            <ChatThread
              summary={active}
              meId={meId}
              onMessagesChanged={() => void refreshConversations()}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center bg-white p-8 text-center">
              <p className="text-lg font-bold text-[#211D33]">
                Your messages
              </p>
              <p className="mt-1 max-w-xs text-sm text-[#6F6B80]">
                Pick a conversation on the left, or open a
                friend&rsquo;s profile and tap Message to start
                chatting.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense>
      <MessagesInner />
    </Suspense>
  );
}
