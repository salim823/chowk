"use client";

import { useChatPopups } from "@/components/ChatPopups";

function PencilIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"
      aria-hidden="true">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
    </svg>
  );
}

/**
 * Floating compose button (desktop only, bottom-right).
 * Opens the "New message" popup.
 */
export function ComposeChatButton() {
  const { newMessageOpen, setNewMessageOpen } = useChatPopups();

  return (
    <button
      type="button"
      onClick={() => setNewMessageOpen(!newMessageOpen)}
      aria-label="New message"
      aria-expanded={newMessageOpen}
      className="fixed bottom-6 right-6 z-40 hidden h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-white text-[#211D33] shadow-xl ring-1 ring-neutral-200 transition-all hover:scale-105 hover:bg-neutral-100 lg:flex"
    >
      <PencilIcon />
    </button>
  );
}
