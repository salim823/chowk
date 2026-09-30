import { BottomNav } from "@/components/BottomNav";
import { DesktopHeader } from "@/components/DesktopHeader";
import { DesktopColumns } from "@/components/DesktopColumns";
import { BannedGate } from "@/components/BannedGate";
import { ActivePing } from "@/components/ActivePing";
import { ChatSettingsProvider } from "@/lib/chatSettings";
import { ChatPopupProvider } from "@/components/ChatPopups";
import { ComposeChatButton } from "@/components/ComposeChatButton";
import { VersionCheck } from "@/components/VersionCheck";

/**
 * Main app shell. Mobile (<lg): page content + fixed bottom nav, exactly as
 * before. Desktop (lg+): sticky top header + columns (profile pages hide the
 * sidebars like Chowk); the bottom nav is hidden.
 *
 * Chat providers wrap everything so floating Messenger-style popups,
 * presence, and incoming-message sounds work on every page.
 */
export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#F5F4FA]">
      {/* Update banner (version polling) — covers all main pages. */}
      <VersionCheck />
      <BannedGate>
        <ChatSettingsProvider>
          <ChatPopupProvider>
            <ActivePing />
            <DesktopHeader />

            {/* Desktop columns */}
            <div className="hidden lg:block">
              <DesktopColumns>{children}</DesktopColumns>
            </div>

            {/* Mobile layout: content + bottom nav */}
            <div className="lg:hidden">
              <div className="pb-24">{children}</div>
              <BottomNav />
            </div>

            {/* Floating "new message" compose button (desktop only) */}
            <ComposeChatButton />
          </ChatPopupProvider>
        </ChatSettingsProvider>
      </BannedGate>
    </div>
  );
}
