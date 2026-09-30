"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={active ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 22V12h6v10" />
    </svg>
  );
}

function SearchIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={active ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function BellIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={active ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function MessengerIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={active ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8 8 0 0 1-8 8H5l-2 2V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z" />
      <path d="M8.5 12h.01M12 12h.01M15.5 12h.01" strokeWidth={2.8} />
    </svg>
  );
}

function UserIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={active ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function ShieldIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={active ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function CompassIcon({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={active ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

const TABS = [
  { href: "/feed", label: "Home", Icon: HomeIcon, badge: "none" },
  { href: "/explore", label: "Explore", Icon: CompassIcon, badge: "none" },
  { href: "/messages", label: "Messages", Icon: MessengerIcon, badge: "messages" },
  { href: "/notifications", label: "Alerts", Icon: BellIcon, badge: "notifications" },
  { href: "/profile", label: "Profile", Icon: UserIcon, badge: "none" },
] as const;

const ADMIN_TAB = { href: "/admin", label: "Admin", Icon: ShieldIcon, badge: "none" } as const;

/** Fixed bottom tab bar for the main app area. */
export function BottomNav() {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  const [msgUnread, setMsgUnread] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data: myParts } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user.id);
      const myConvIds = ((myParts ?? []) as { conversation_id: string }[]).map(
        (r) => r.conversation_id
      );
      const notifQuery = supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      const msgQuery =
        myConvIds.length > 0
          ? supabase
              .from("messages")
              .select("id", { count: "exact", head: true })
              .in("conversation_id", myConvIds)
              .neq("sender_id", user.id)
              .is("read_at", null)
          : null;
      const [{ count }, msgRes, { data: profile }] = await Promise.all([
        notifQuery,
        msgQuery ?? Promise.resolve({ count: 0 as number | null }),
        supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle(),
      ]);
      if (!cancelled) {
        setUnread(count ?? 0);
        setMsgUnread(msgRes.count ?? 0);
        setIsAdmin((profile as { is_admin?: boolean } | null)?.is_admin === true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const tabs = isAdmin ? [...TABS, ADMIN_TAB] : TABS;

  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E6E3F0] bg-white/95 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className={`mx-auto grid w-full max-w-xl ${isAdmin ? "grid-cols-6" : "grid-cols-5"}`}>
        {tabs.map(({ href, label, Icon, badge }) => {
          const active =
            pathname === href || pathname.startsWith(`${href}/`);
          const badgeCount =
            badge === "notifications" ? unread : badge === "messages" ? msgUnread : 0;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="relative flex cursor-pointer flex-col items-center gap-0.5 py-2 text-[11px] font-semibold transition-colors"
            >
              <span
                className={`relative flex h-9 items-center justify-center rounded-full transition-all ${
                  active
                    ? "bg-[#4F46E5] px-5 text-white shadow-md shadow-[#4F46E5]/25"
                    : "px-3 text-neutral-500 hover:text-[#211D33] active:scale-90"
                }`}
              >
                <Icon active={active} />
                {badge !== "none" && badgeCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#EC4899] px-1 text-[10px] font-bold text-white">
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </span>
              <span className={active ? "text-[#4338CA]" : ""}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
