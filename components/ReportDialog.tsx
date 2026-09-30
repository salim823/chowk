"use client";

import { useState } from "react";

type ReportDialogProps = {
  title: string;
  placeholder?: string;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
};

/** Small modal asking for a report reason. Caller performs the insert. */
export function ReportDialog({
  title,
  placeholder = "Tell us what is wrong...",
  onClose,
  onSubmit,
}: ReportDialogProps) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const text = reason.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(text);
      onClose();
    } catch {
      setError("Could not submit the report. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex cursor-pointer items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-label={title}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-bold text-[#211D33]">{title}</h2>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          maxLength={500}
          placeholder={placeholder}
          autoFocus
          className="mt-3 w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-[#211D33] placeholder:text-neutral-400 focus:border-[#4F46E5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/30"
        />
        {error && (
          <p className="mt-2 text-sm font-medium text-red-600">{error}</p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="cursor-pointer rounded-xl px-4 py-2.5 text-sm font-semibold text-[#6F6B80] transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={busy || reason.trim().length === 0}
            className="cursor-pointer rounded-xl bg-[#4F46E5] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#4338CA] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Sending..." : "Submit report"}
          </button>
        </div>
      </div>
    </div>
  );
}
