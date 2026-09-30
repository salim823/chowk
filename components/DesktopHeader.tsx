"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { FeedbackModal } from "@/components/FeedbackModal";
import { ChowkModal, ChowkModalButton } from "@/components/ChowkModal";

function MagnifierIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function HouseIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M9 22V12h6v10" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function MessengerIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a8 8 0 0 1-8 8H5l-2 2V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z" />
      <path d="M8.5 12h.01M12 12h.01M15.5 12h.01" strokeWidth={2.6} />
    </svg>
  );
}

function CompassIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
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

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function WrenchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

type IconComponent = React.ComponentType;

/** One row of the Chowk-style account menu: gray circle icon + bold label. */
function MenuRow({
  label,
  Icon,
  chevron,
  onClick,
}: {
  label: string;
  Icon: IconComponent;
  chevron?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-neutral-100"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-[#211D33]">
        <Icon />
      </span>
      <span className="flex-1 text-[15px] font-bold text-[#211D33]">
        {label}
      </span>
      {chevron && (
        <span className="shrink-0 text-[#6F6B80]">
          <ChevronRightIcon />
        </span>
      )}
    </button>
  );
}

function ModalShell({
  label,
  title,
  onClose,
  children,
}: {
  label: string;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#211D33]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-neutral-200 text-[#6F6B80] transition-colors hover:bg-neutral-300"
          >
            <XIcon />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const HELP_SECTIONS = [
  {
    title: "Getting Started",
    faqs: [
      {
        q: "How do I create a post?",
        a: "Tap \u201cWhat\u2019s on your mind?\u201d on the feed, or the Create post button on your profile. Write something, add up to 4 photos, pick who can see it, then tap Post.",
      },
      {
        q: "How do I add friends?",
        a: "Use the search bar at the top to find people, open their profile and tap Add friend. Manage your requests from the Friends page.",
      },
    ],
  },
  {
    title: "Posts & Privacy",
    faqs: [
      {
        q: "How do I save a post?",
        a: "Tap the \u00b7\u00b7\u00b7 menu on any post and choose Save post. Open this menu and tap Saved to see everything you saved.",
      },
      {
        q: "How does anonymous posting work?",
        a: "Turn on \u201cPost anonymously\u201d in the composer before you post. Your name and photo stay hidden \u2014 the post appears as Anonymous. Only admins can see who posted, for everyone\u2019s safety.",
      },
    ],
  },
  {
    title: "Staying Safe",
    faqs: [
      {
        q: "How do I report something?",
        a: "Tap the \u00b7\u00b7\u00b7 menu on a post and choose Report post. To report a person, open their profile and choose Report.",
      },
      {
        q: "How do I block someone?",
        a: "Open the person\u2019s profile and choose Block user, then confirm. You will no longer see their posts. You can unblock them any time to restore everything.",
      },
    ],
  },
] as const;

function HelpModal({
  onClose,
  onContactSupport,
}: {
  onClose: () => void;
  onContactSupport: () => void;
}) {
  const [openKey, setOpenKey] = useState<string | null>("0-0");
  return (
    <ChowkModal
      open
      onClose={onClose}
      title="Help & Support"
      subtitle="Answers to common questions about Chowk."
      size="lg"
    >
      <div className="flex flex-col gap-5">
        {HELP_SECTIONS.map((section, si) => (
          <section key={section.title} aria-label={section.title}>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[#4F46E5]">
              {section.title}
            </p>
            <div className="flex flex-col gap-2">
              {section.faqs.map((faq, fi) => {
                const key = `${si}-${fi}`;
                const isOpen = openKey === key;
                return (
                  <div
                    key={key}
                    className="overflow-hidden rounded-xl ring-1 ring-[#E6E3F0]"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenKey(isOpen ? null : key)}
                      aria-expanded={isOpen}
                      className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-[#F5F4FA]"
                    >
                      <span className="text-sm font-bold text-[#211D33]">
                        {faq.q}
                      </span>
                      <span
                        className={`shrink-0 text-[#6F6B80] transition-transform ${isOpen ? "rotate-180" : ""}`}
                      >
                        <ChevronDownIcon />
                      </span>
                    </button>
                    {isOpen && (
                      <p className="border-t border-[#E6E3F0] bg-[#F5F4FA] px-4 py-3 text-sm leading-relaxed text-[#6F6B80]">
                        {faq.a}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        <div className="rounded-xl bg-[#EEF2FF] p-4 ring-1 ring-[#E6E3F0]">
          <p className="text-sm font-bold text-[#211D33]">Contact support</p>
          <p className="mt-0.5 text-sm text-[#6F6B80]">
            Need help? Send us feedback.
          </p>
          <div className="mt-3">
            <ChowkModalButton tone="primary" onClick={onContactSupport}>
              Send feedback
            </ChowkModalButton>
          </div>
          <p className="mt-3 text-xs text-[#6F6B80]">
            Or email us at{" "}
            <a
              href="https://mail.google.com/mail/?view=cm&fs=1&to=contactnowmuhammadharis@gmail.com"
              target="_blank"
              rel="noopener noreferrer"
              className="cursor-pointer font-semibold text-[#4F46E5] hover:underline"
            >
              contactnowmuhammadharis@gmail.com
            </a>
          </p>
        </div>
      </div>
    </ChowkModal>
  );
}

function AboutModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell label="About Chowk" title="About Chowk" onClose={onClose}>
      <p className="text-[15px] font-bold text-[#211D33]">
        Where your campus comes together.
      </p>
      <p className="mt-2 text-sm leading-relaxed text-[#6F6B80]">
        Chowk is your college community: share updates and
        photos and follow your classmates — the people around you.
      </p>
      <p className="mt-4 text-xs text-[#6F6B80]">Chowk v1.0</p>
    </ModalShell>
  );
}

/** Chowk-style center icon tabs (desktop). */
const TABS = [
  {
    href: "/feed",
    label: "Home",
    Icon: HouseIcon,
    match: (p: string) => p === "/feed",
  },
  {
    href: "/search",
    label: "People",
    Icon: UsersIcon,
    match: (p: string) => p === "/search" || p.startsWith("/search/"),
  },
  {
    href: "/explore",
    label: "Explore",
    Icon: CompassIcon,
    match: (p: string) => p === "/explore" || p.startsWith("/explore/"),
  },
  {
    href: "/notifications",
    label: "Alerts",
    Icon: BellIcon,
    match: (p: string) =>
      p === "/notifications" || p.startsWith("/notifications/"),
  },
  {
    href: "/messages",
    label: "Messages",
    Icon: MessengerIcon,
    match: (p: string) => p === "/messages" || p.startsWith("/messages/"),
  },
] as const;

/** Sticky desktop top bar: logo, search, notifications bell, profile avatar. */
export function DesktopHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState("");
  const [unread, setUnread] = useState(0);
  const [msgUnread, setMsgUnread] = useState(0);
  const [profileName, setProfileName] = useState("?");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_read", false);
      const { data: myParts } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user.id);
      const myConvIds = ((myParts ?? []) as { conversation_id: string }[]).map(
        (r) => r.conversation_id
      );
      let msgCount: number | null = 0;
      if (myConvIds.length > 0) {
        const res = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .in("conversation_id", myConvIds)
          .neq("sender_id", user.id)
          .is("read_at", null);
        msgCount = res.count;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, username, avatar_url, is_admin")
        .eq("id", user.id)
        .single();
      if (!cancelled) {
        setUnread(count ?? 0);
        setMsgUnread(msgCount ?? 0);
        const p = profile as { full_name: string | null; username: string; avatar_url: string | null; is_admin?: boolean } | null;
        setProfileName(p?.full_name || p?.username || "?");
        setAvatarUrl(p?.avatar_url ?? null);
        setIsAdmin(p?.is_admin === true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // Close the account menu on Escape.
  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setMenuOpen(false);
    router.push("/login");
    router.refresh();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const term = q.trim();
    router.push(term ? `/search?q=${encodeURIComponent(term)}` : "/search");
  }

  return (
    <header className="sticky top-0 z-40 hidden border-b border-[#E6E3F0] bg-white/90 backdrop-blur-md lg:block">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-6">
        <div className="flex items-center gap-4">
          <Link href="/feed" className="flex shrink-0 cursor-pointer items-center gap-2.5">
            <Image
              src="/logo.webp"
              alt="Chowk"
              width={36}
              height={36}
              className="rounded-lg"
            />
            <span className="text-xl font-bold text-[#211D33]">Chowk</span>
          </Link>

          <form onSubmit={submit} className="relative w-56 xl:w-72">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
              <MagnifierIcon />
            </span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search people..."
              autoComplete="off"
              aria-label="Search people"
              className="w-full rounded-full bg-neutral-100 py-2.5 pl-10 pr-4 text-sm text-[#211D33] placeholder:text-neutral-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/40"
            />
          </form>
        </div>

        {/* Center icon tabs — Chowk pill style (not FB's underline). */}
        <nav aria-label="Primary" className="flex flex-1 items-center justify-center gap-1 px-2">
          {TABS.map(({ href, label, Icon, match }) => {
            const active = match(pathname);
            const badgeCount = href === "/messages" ? msgUnread : 0;
            return (
              <Link
                key={href}
                href={href}
                title={label}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={`relative flex cursor-pointer items-center justify-center rounded-full px-5 py-2.5 transition-all xl:px-7 ${
                  active
                    ? "bg-[#4F46E5] text-white shadow-md shadow-[#4F46E5]/25"
                    : "text-[#6F6B80] hover:bg-[#EEF2FF] hover:text-[#4338CA] active:scale-95"
                }`}
              >
                <Icon />
                {active && (
                  <span className="ml-2 hidden text-sm font-bold xl:inline">
                    {label}
                  </span>
                )}
                {badgeCount > 0 && (
                  <span
                    className={`absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                      active ? "bg-white text-[#4F46E5]" : "bg-[#EC4899] text-white"
                    }`}
                  >
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          <Link
            href="/notifications"
            aria-label="Notifications"
            className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-neutral-200 text-[#211D33] transition-colors hover:bg-neutral-300"
          >
            <BellIcon />
            {unread > 0 && (
              <span className="absolute right-1 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </Link>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Account menu"
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-neutral-200 text-sm font-bold text-[#211D33] transition-colors hover:bg-neutral-300"
            >
              {profileName.trim().charAt(0).toUpperCase() || "?"}
              <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-neutral-300 text-[#211D33] ring-2 ring-white">
                <ChevronDownIcon />
              </span>
            </button>
            {menuOpen && (
              <div
                className="fixed inset-0 z-40 cursor-pointer"
                onClick={() => setMenuOpen(false)}
              />
            )}
            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl bg-white p-2 shadow-xl ring-1 ring-neutral-200"
              >
                {/* Profile card */}
                <Link
                  href="/profile"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="block cursor-pointer rounded-lg transition-colors hover:bg-neutral-100"
                >
                  <div className="m-1 flex items-center gap-3 rounded-lg bg-neutral-100 px-2.5 py-2.5">
                    {avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarUrl}
                        alt=""
                        className="h-10 w-10 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#4F46E5] text-base font-bold text-white">
                        {profileName.trim().charAt(0).toUpperCase() || "?"}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-bold text-[#211D33]">
                        {profileName}
                      </span>
                      <span className="block text-sm text-[#6F6B80]">
                        See your profile
                      </span>
                    </span>
                  </div>
                </Link>

                <div className="my-1.5 border-t border-neutral-200" />

                <MenuRow
                  label="Friends"
                  Icon={UsersIcon}
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/friends");
                  }}
                />
                <MenuRow
                  label="Saved"
                  Icon={BookmarkIcon}
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/saved");
                  }}
                />
                <MenuRow
                  label="Settings & privacy"
                  Icon={GearIcon}
                  chevron
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/profile?tab=about");
                  }}
                />
                <MenuRow
                  label="Help & support"
                  Icon={HelpIcon}
                  chevron
                  onClick={() => {
                    setMenuOpen(false);
                    setHelpOpen(true);
                  }}
                />
                <MenuRow
                  label="Report a problem"
                  Icon={WrenchIcon}
                  onClick={() => {
                    setMenuOpen(false);
                    setFeedbackOpen(true);
                  }}
                />
                {isAdmin && (
                  <MenuRow
                    label="Admin panel"
                    Icon={ShieldIcon}
                    onClick={() => {
                      setMenuOpen(false);
                      router.push("/admin");
                    }}
                  />
                )}

                <div className="my-1.5 border-t border-neutral-200" />

                <MenuRow
                  label={loggingOut ? "Logging out..." : "Log out"}
                  Icon={LogoutIcon}
                  onClick={handleLogout}
                />

                <p className="px-3 pb-1.5 pt-2 text-xs text-[#6F6B80]">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setAboutOpen(true);
                    }}
                    className="cursor-pointer transition-colors hover:text-[#211D33] hover:underline"
                  >
                    About Chowk
                  </button>
                  <span aria-hidden="true"> · </span>
                  <span>v1.0</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      {helpOpen && (
        <HelpModal
          onClose={() => setHelpOpen(false)}
          onContactSupport={() => {
            setHelpOpen(false);
            setFeedbackOpen(true);
          }}
        />
      )}
      {feedbackOpen && (
        <FeedbackModal open onClose={() => setFeedbackOpen(false)} />
      )}
      {aboutOpen && <AboutModal onClose={() => setAboutOpen(false)} />}
    </header>
  );
}
