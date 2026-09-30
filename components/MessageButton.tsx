"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getOrCreateConversation } from "@/lib/messages";

function MessengerGlyph({ className = "" }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"
      className={className} aria-hidden="true">
      <path d="M12 2C6.36 2 2 6.13 2 11.7c0 2.91 1.19 5.44 3.14 7.17.16.14.25.35.25.57l.05 1.78c.02.47.54.73.94.48l2.1-1.33c.18-.11.4-.13.6-.08 1.14.32 2.39.5 3.92.5 5.64 0 10-4.13 10-9.7S17.64 2 12 2zm0 13.5-2.6-2.78-5 2.78 5.5-5.84 2.7 2.78 4.9-2.78-5.5 5.84z" />
    </svg>
  );
}

/**
 * "Message" button: opens (or creates) the 1-on-1 conversation with a user
 * and navigates to /messages?with=<conversationId>.
 */
export function MessageButton({
  userId,
  compact = false,
}: {
  userId: string;
  /** Smaller pill for dense rows (friends list). */
  compact?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (busy) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setBusy(true);
    try {
      const convId = await getOrCreateConversation(supabase, userId);
      router.push(`/messages?with=${encodeURIComponent(convId)}`);
    } catch {
      // Blocked users, missing profiles, etc. surface as a silent no-op here;
      // the button is hidden for blocked relations anyway.
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={busy}
      className={
        compact
          ? "flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-[#E6E3F0] px-3 py-1.5 text-xs font-semibold text-[#211D33] transition-colors hover:bg-neutral-300 disabled:cursor-not-allowed disabled:opacity-50"
          : "flex cursor-pointer items-center gap-2 rounded-lg bg-[#E6E3F0] px-5 py-2 text-[15px] font-semibold text-[#211D33] transition-colors hover:bg-neutral-300 disabled:cursor-not-allowed disabled:opacity-50"
      }
    >
      <MessengerGlyph />
      {busy ? "Opening..." : "Message"}
    </button>
  );
}
