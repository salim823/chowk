"use client";

import { useEffect, type ReactNode } from "react";

/**
 * ChowkModal — the single shared modal shell for the whole app.
 *
 * Delete-post confirmations, admin dialogs, Help, and Feedback all use this,
 * so every dialog shares the same border radius, typography, spacing, button
 * system, close behavior, overlay, and responsive behavior.
 *
 * - Overlay: fixed, black/50, click to close (unless `dismissable` is false)
 * - Panel: white, rounded-2xl, soft shadow, purple accent title
 * - Sizes: sm (max-w-sm), md (max-w-md), lg (max-w-lg)
 * - Responsive: fits small screens with margin, scrolls internally when tall
 * - Escape key closes; body scroll is locked while open
 */
export function ChowkModal({
  open,
  onClose,
  title,
  subtitle,
  size = "md",
  children,
  dismissable = true,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  dismissable?: boolean;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissable) onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, dismissable]);

  if (!open) return null;

  const maxW =
    size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-lg" : "max-w-md";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={() => {
        if (dismissable) onClose();
      }}
    >
      <div
        className={`flex max-h-[85vh] w-full ${maxW} flex-col overflow-hidden rounded-2xl bg-white shadow-xl shadow-[#211D33]/10 ring-1 ring-[#E6E3F0]`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#E6E3F0] px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[#211D33]">{title}</h2>
            {subtitle && (
              <p className="mt-0.5 text-sm text-[#6F6B80]">{subtitle}</p>
            )}
          </div>
          {dismissable && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-[#6F6B80] transition-colors hover:bg-[#F5F4FA] hover:text-[#211D33]"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
              >
                <path d="M3 3l10 10M13 3L3 13" />
              </svg>
            </button>
          )}
        </div>

        <div className="overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <div className="flex flex-col-reverse gap-2 border-t border-[#E6E3F0] px-5 py-4 sm:flex-row sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** Primary (purple) and neutral modal buttons with consistent styling. */
export function ChowkModalButton({
  children,
  onClick,
  tone = "neutral",
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "primary" | "neutral" | "dark";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const tones = {
    primary:
      "bg-[#4F46E5] text-white hover:bg-[#4338CA] shadow-sm shadow-[#4F46E5]/25",
    neutral: "bg-[#F5F4FA] text-[#211D33] hover:bg-[#E6E3F0]",
    // For genuinely destructive confirms (e.g. final Delete). Neutral dark,
    // never bright red — per Chowk's design rules.
    dark: "bg-[#211D33] text-white hover:bg-black",
  } as const;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`cursor-pointer rounded-xl px-5 py-2.5 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}
