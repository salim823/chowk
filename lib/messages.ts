"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProfileLite } from "@/lib/types";

/** One row of the messages table. */
export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

/** The other person in a 1-on-1 conversation. */
export interface ConversationOther extends ProfileLite {
  id: string;
}

/** A conversation with the other participant, last message, and unread count. */
export interface ConversationSummary {
  id: string;
  last_message_at: string;
  other: ConversationOther;
  lastMessage: { body: string; created_at: string; sender_id: string } | null;
  unread: number;
}

/** Find the existing 1-on-1 conversation with a user, or create it. */
export async function getOrCreateConversation(
  supabase: SupabaseClient,
  otherUserId: string
): Promise<string> {
  const { data, error } = await supabase.rpc(
    "get_or_create_conversation",
    { other_user_id: otherUserId }
  );
  if (error) throw error;
  return data as string;
}

type ParticipantRow = {
  conversation_id: string;
  user_id: string;
  /** To-one join; the untyped client may still infer an array. */
  profiles: (ProfileLite & { id: string; last_active_at?: string | null }) | (ProfileLite & { id: string; last_active_at?: string | null })[] | null;
};

/** Normalize the profiles join (object or single-element array). */
function asProfile(
  p: ParticipantRow["profiles"]
): (ProfileLite & { id: string; last_active_at?: string | null }) | null {
  if (!p) return null;
  const row = Array.isArray(p) ? p[0] : p;
  return row ?? null;
}

/**
 * All conversations of the signed-in user, newest first, each with the other
 * participant's profile, the last message, and the unread count.
 */
export async function listConversations(
  supabase: SupabaseClient
): Promise<ConversationSummary[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // My conversation ids.
  const { data: mine } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", user.id);
  const convIds = ((mine ?? []) as { conversation_id: string }[]).map(
    (r) => r.conversation_id
  );
  if (convIds.length === 0) return [];

  // Other participants + their profiles.
  const { data: parts } = await supabase
    .from("conversation_participants")
    .select("conversation_id, user_id, profiles(id, username, full_name, avatar_url, last_active_at)")
    .in("conversation_id", convIds)
    .neq("user_id", user.id);
  const otherByConv = new Map<string, ConversationOther>();
  for (const p of (parts ?? []) as ParticipantRow[]) {
    const prof = asProfile(p.profiles);
    if (prof) {
      otherByConv.set(p.conversation_id, {
        id: prof.id,
        username: prof.username,
        full_name: prof.full_name,
        avatar_url: prof.avatar_url,
        last_active_at: prof.last_active_at ?? null,
      });
    }
  }

  // Conversation timestamps.
  const { data: convs } = await supabase
    .from("conversations")
    .select("id, last_message_at")
    .in("id", convIds)
    .order("last_message_at", { ascending: false });
  const convRows = (convs ?? []) as { id: string; last_message_at: string }[];

  // Last message per conversation (newest-first scan, first hit wins).
  const { data: msgs } = await supabase
    .from("messages")
    .select("conversation_id, body, created_at, sender_id")
    .in("conversation_id", convIds)
    .order("created_at", { ascending: false })
    .limit(Math.max(convIds.length * 5, 50));
  const lastByConv = new Map<
    string,
    { body: string; created_at: string; sender_id: string }
  >();
  for (const m of (msgs ?? []) as {
    conversation_id: string;
    body: string;
    created_at: string;
    sender_id: string;
  }[]) {
    if (!lastByConv.has(m.conversation_id)) {
      lastByConv.set(m.conversation_id, {
        body: m.body,
        created_at: m.created_at,
        sender_id: m.sender_id,
      });
    }
  }

  // Unread counts (messages I received and haven't read).
  const { data: unreadRows } = await supabase
    .from("messages")
    .select("conversation_id")
    .in("conversation_id", convIds)
    .neq("sender_id", user.id)
    .is("read_at", null);
  const unreadByConv = new Map<string, number>();
  for (const r of (unreadRows ?? []) as { conversation_id: string }[]) {
    unreadByConv.set(r.conversation_id, (unreadByConv.get(r.conversation_id) ?? 0) + 1);
  }

  return convRows
    .map((c) => {
      const other = otherByConv.get(c.id);
      if (!other) return null;
      return {
        id: c.id,
        last_message_at: c.last_message_at,
        other,
        lastMessage: lastByConv.get(c.id) ?? null,
        unread: unreadByConv.get(c.id) ?? 0,
      } satisfies ConversationSummary;
    })
    .filter((c): c is ConversationSummary => c !== null);
}

/** Newest-first messages of one conversation (RLS guarantees membership). */
export async function listMessages(
  supabase: SupabaseClient,
  conversationId: string,
  limit = 100
): Promise<MessageRow[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, body, created_at, read_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as MessageRow[]).reverse();
}

/** Send a text message (max 2000 chars, enforced by DB too). */
export async function sendMessage(
  supabase: SupabaseClient,
  conversationId: string,
  body: string
): Promise<MessageRow> {
  const trimmed = body.trim().slice(0, 2000);
  if (!trimmed) throw new Error("Message is empty");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body: trimmed,
    })
    .select("id, conversation_id, sender_id, body, created_at, read_at")
    .single();
  if (error) throw error;
  return data as MessageRow;
}

/** Delete one of my own messages (RLS: sender_id = auth.uid()). */
export async function deleteMessage(
  supabase: SupabaseClient,
  messageId: string
): Promise<void> {
  const { error } = await supabase
    .from("messages")
    .delete()
    .eq("id", messageId);
  if (error) throw error;
}

/** Mark every message I received in this conversation as read. */
export async function markRead(
  supabase: SupabaseClient,
  conversationId: string
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .neq("sender_id", user.id)
    .is("read_at", null);
}

/** Total unread messages across all my conversations (for nav badges). */
export async function getTotalUnread(supabase: SupabaseClient): Promise<number> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;
  const { data: mine } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", user.id);
  const convIds = ((mine ?? []) as { conversation_id: string }[]).map(
    (r) => r.conversation_id
  );
  if (convIds.length === 0) return 0;
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .in("conversation_id", convIds)
    .neq("sender_id", user.id)
    .is("read_at", null);
  return count ?? 0;
}
