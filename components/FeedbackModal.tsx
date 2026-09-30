"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { ChowkModal, ChowkModalButton } from "@/components/ChowkModal";

const CATEGORIES = [
  { value: "bug", label: "Something isn't working" },
  { value: "suggestion", label: "Suggestion" },
  { value: "feedback", label: "Feedback" },
  { value: "other", label: "Other" },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];

/**
 * Feedback / "Report a problem" modal. Lets any signed-in user send feedback
 * or a bug report straight to the admin inbox (no email exposed). Used from
 * the desktop account menu and the own-profile About tab (mobile).
 *
 * Uses the shared ChowkModal shell. The category is stored in
 * feedback.category so problem reports land in the admin Feedback inbox
 * with a category badge — the submission logic below is unchanged.
 */
export function FeedbackModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<Category>("bug");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCategory("bug");
    setMessage("");
    setError(null);
    setSent(false);
    setBusy(false);
  }, [open]);

  if (!open) return null;

  async function handleSend() {
    const text = message.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Could not connect. Please try again.");
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("You are not logged in.");
      const { error: insertError } = await supabase.from("feedback").insert({
        user_id: user.id,
        category,
        message: text,
      });
      if (insertError) throw insertError;
      setSent(true);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Could not send. Please try again.";
      // Missing table (feedback.sql not run yet) → friendly message.
      setError(
        msg.includes("PGRST205") || /table.*feedback/i.test(msg)
          ? "Feedback is not available right now. Please try again later."
          : msg
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <ChowkModal
      open
      onClose={onClose}
      title="Feedback"
      subtitle="Tell us what happened, or what we can do better."
      size="md"
      footer={
        sent ? (
          <ChowkModalButton tone="primary" onClick={onClose}>
            Done
          </ChowkModalButton>
        ) : (
          <>
            <ChowkModalButton tone="neutral" onClick={onClose}>
              Cancel
            </ChowkModalButton>
            <ChowkModalButton
              tone="primary"
              onClick={handleSend}
              disabled={busy || message.trim().length === 0}
            >
              {busy ? "Sending..." : "Send Feedback"}
            </ChowkModalButton>
          </>
        )
      }
    >
      {sent ? (
        <div className="flex flex-col items-center py-6 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EEF2FF] text-[#4F46E5]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <p className="mt-3 text-[15px] font-bold text-[#211D33]">
            Thanks! Your report was sent.
          </p>
          <p className="mt-1 text-sm text-[#6F6B80]">
            We&apos;ll complete your request within 24 hours.
          </p>
        </div>
      ) : (
        <>
          {error && (
            <p className="mb-3 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700 ring-1 ring-red-200">
              {error}
            </p>
          )}
          <label
            htmlFor="feedback-category"
            className="mb-1.5 block text-sm font-medium text-[#211D33]"
          >
            What is this about?
          </label>
          <select
            id="feedback-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="w-full cursor-pointer rounded-xl border border-[#E6E3F0] bg-white px-4 py-2.5 text-[15px] text-[#211D33] focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/30"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <label
            htmlFor="feedback-message"
            className="mb-1.5 mt-4 block text-sm font-medium text-[#211D33]"
          >
            Describe the problem
          </label>
          <textarea
            id="feedback-message"
            rows={5}
            maxLength={1000}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell us what happened, or what we can do better..."
            className="w-full resize-none rounded-xl border border-[#E6E3F0] px-4 py-3 text-[15px] text-[#211D33] placeholder:text-neutral-400 focus:border-[#4F46E5] focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/30"
          />
          <p className="mt-1 text-right text-xs text-[#6F6B80]">
            {message.length}/1000
          </p>
        </>
      )}
    </ChowkModal>
  );
}
