"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { LeftSidebar } from "@/components/LeftSidebar";
import { ContactsSidebar } from "@/components/ContactsSidebar";
import { CampusSidebar } from "@/components/CampusSidebar";
import { MainContent } from "@/components/MainContent";
import { useChatSettings } from "@/lib/chatSettings";

/**
 * Desktop 3-column shell. Like Chowk, profile pages hide both sidebars
 * and the profile content takes the full width. The right contacts rail
 * collapses when the user turns "Show contacts" off in chat settings.
 *
 * Feed layout: the left rail sits flush toward the left edge of the screen,
 * the center feed is centered in the remaining space (widened to 680px),
 * and the gaps between the three columns stay consistent.
 */
export function DesktopColumns({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { settings } = useChatSettings();
  const isProfile =
    pathname === "/profile" || pathname.startsWith("/profile/");
  const isAdminPage = pathname === "/admin";
  const isMessagesPage =
    pathname === "/messages" || pathname.startsWith("/messages/");
  const isFeedPage = pathname === "/feed";

  if (isProfile || isAdminPage || isMessagesPage) {
    return (
      <div className="mx-auto flex w-full max-w-[1095px] justify-center px-6">
        <MainContent>{children}</MainContent>
      </div>
    );
  }

  return (
    <div className="hidden w-full items-start gap-8 px-4 lg:flex">
      {/* Left rail — flush toward the left edge of the screen. */}
      <aside className="w-64 shrink-0">
        <LeftSidebar />
      </aside>
      {/* Center feed — centered in the remaining space between the rails. */}
      <div className="flex min-w-0 flex-1 justify-center">
        <MainContent>{children}</MainContent>
      </div>
      {/* Right rail: on the feed, live campus highlights; elsewhere, as-is. */}
      {isFeedPage ? (
        <aside className="w-80 shrink-0">
          <CampusSidebar />
        </aside>
      ) : (
        settings.showContacts && (
          <aside className="w-80 shrink-0">
            <ContactsSidebar />
          </aside>
        )
      )}
    </div>
  );
}
