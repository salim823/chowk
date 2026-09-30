"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { Avatar } from "@/components/Avatar";

function UsersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
    </svg>
  );
}

const LINKS = [
  {
    href: "/friends",
    label: "Friends",
    Icon: UsersIcon,
    badge: "bg-[#EEF2FF] text-[#4F46E5]",
    match: (p: string) => p === "/friends" || p.startsWith("/friends/"),
  },
  {
    href: "/saved",
    label: "Saved",
    Icon: BookmarkIcon,
    badge: "bg-purple-100 text-purple-600",
    match: (p: string) => p === "/saved" || p.startsWith("/saved/"),
  },
  {
    href: "/notifications",
    label: "Alerts",
    Icon: BellIcon,
    badge: "bg-red-100 text-red-600",
    match: (p: string) =>
      p === "/notifications" || p.startsWith("/notifications/"),
  },
] as const;

/** Desktop left sidebar: mini profile row and nav links, FB-dense. */
export function LeftSidebar() {
  const pathname = usePathname();
  const [profile, setProfile] = useState<{
    full_name: string | null;
    username: string;
    avatar_url: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, username, avatar_url")
        .eq("id", user.id)
        .single();
      if (!cancelled && data) {
        setProfile(
          data as {
            full_name: string | null;
            username: string;
            avatar_url: string | null;
          }
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="sticky top-20 flex h-[calc(100vh-5rem)] flex-col gap-0 overflow-y-auto py-4 pr-2">
      <Link
        href="/profile"
        className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-neutral-200"
      >
        <Avatar
          name={profile?.full_name || profile?.username || "?"}
          avatarUrl={profile?.avatar_url ?? null}
        />
        <p className="truncate text-[15px] font-semibold text-[#211D33]">
          {profile?.full_name || profile?.username || "Loading..."}
        </p>
      </Link>

      {LINKS.map(({ href, label, Icon, badge, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-[15px] transition-colors ${
              active
                ? "bg-neutral-200/70 font-semibold text-[#211D33] hover:bg-neutral-200"
                : "font-medium text-[#211D33] hover:bg-neutral-200"
            }`}
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${badge}`}
            >
              <Icon />
            </span>
            {label}
          </Link>
        );
      })}

    </div>
  );
}
