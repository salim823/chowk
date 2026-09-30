"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Content width: profile and messages pages get the wider column (messages
 * needs room for the list + thread side by side), the desktop feed gets a
 * widened 680px column, everything else keeps the regular width.
 */
export function MainContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const wide =
    pathname === "/profile" ||
    pathname.startsWith("/profile/") ||
    pathname === "/messages" ||
    pathname.startsWith("/messages/") ||
    pathname === "/explore";
  return (
    <main
      className={`min-w-0 w-full flex-1 py-6 ${
        wide ? "max-w-[1095px]" : "max-w-[680px]"
      }`}
    >
      {children}
    </main>
  );
}
