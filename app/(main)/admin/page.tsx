"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { timeAgo } from "@/lib/time";
import { ChowkModal, ChowkModalButton } from "@/components/ChowkModal";

type ReportPostAuthor = {
  username: string;
  full_name: string | null;
};

type ReportRow = {
  id: string;
  reporter_id: string;
  post_id: string | null;
  reported_user_id: string | null;
  reason: string | null;
  created_at: string;
  reporter: { username: string; full_name: string | null } | null;
  post: {
    id: string;
    content: string | null;
    user_id: string;
    is_anonymous: boolean;
    author: ReportPostAuthor | null;
  } | null;
  reported_user: {
    id: string;
    username: string;
    full_name: string | null;
    is_banned: boolean | null;
  } | null;
};

type AdminUser = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  is_banned: boolean | null;
  is_admin: boolean | null;
  bio: string | null;
  is_private: boolean | null;
  last_active_at: string | null;
  /** Present only when account_status.sql is installed (else undefined). */
  is_deleted?: boolean | null;
};

type UserDetail = {
  followers: number;
  following: number;
  posts: {
    id: string;
    content: string | null;
    created_at: string;
    is_anonymous: boolean;
  }[];
};

type AdminPost = {
  id: string;
  content: string | null;
  created_at: string;
  is_anonymous: boolean;
  user_id: string;
  author: {
    username: string;
    full_name: string | null;
    is_admin: boolean | null;
    avatar_url: string | null;
  } | null;
};

type ActivityStats = {
  today: number;
  week: number;
  month: number;
  buckets: { label: string; count: number }[];
};

type FeedbackRow = {
  id: string;
  user_id: string;
  category: "bug" | "suggestion" | "feedback" | "other";
  message: string;
  status: "open" | "resolved";
  created_at: string;
  user: { username: string; full_name: string | null; avatar_url: string | null } | null;
};

/** A pending destructive/moderation confirmation, shown via ChowkModal. */
type PendingConfirm = {
  title: string;
  body: string;
  confirmLabel: string;
  tone: "dark" | "primary";
  /** When set, the confirm button stays disabled until the box is checked. */
  requireCheck?: string;
  run: () => void;
};

type TabId = "overview" | "posts" | "reports" | "users" | "feedback" | "activity";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "posts", label: "Posts" },
  { id: "reports", label: "Reports" },
  { id: "users", label: "Users" },
  { id: "feedback", label: "Feedback" },
  { id: "activity", label: "Activity" },
];

const POSTS_PAGE_SIZE = 10;
const USERS_PAGE_SIZE = 15;

const FEEDBACK_CATEGORY_META: Record<
  FeedbackRow["category"],
  { label: string; badge: string }
> = {
  bug: { label: "Bug", badge: "bg-red-100 text-red-700" },
  suggestion: { label: "Suggestion", badge: "bg-amber-100 text-amber-700" },
  feedback: { label: "Feedback", badge: "bg-[#EEF2FF] text-[#4F46E5]" },
  other: { label: "Other", badge: "bg-neutral-200 text-[#6F6B80]" },
};

/** PostgREST to-one embeds can arrive as an object or a 1-array; normalize. */
function one<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ${
        highlight ? "ring-2 ring-[#4F46E5]" : "ring-[#E6E3F0]"
      }`}
    >
      <p
        className={`text-2xl font-bold ${
          highlight ? "text-[#4F46E5]" : "text-[#211D33]"
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-sm text-[#6F6B80]">{label}</p>
    </div>
  );
}

/** Simple SVG bar chart for the Overview analytics. Real data only. */
function BarChart({
  labels,
  values,
  color,
}: {
  labels: string[];
  values: number[];
  color: string;
}) {
  const W = 560;
  const H = 150;
  const max = Math.max(1, ...values);
  const n = Math.max(1, values.length);
  const slot = W / n;
  const bw = Math.min(34, slot * 0.62);
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mt-2 w-full"
      role="img"
      aria-label="14-day activity chart"
    >
      {values.map((v, i) => {
        const h = Math.max(v > 0 ? 4 : 0, ((H - 34) * v) / max);
        const x = slot * i + (slot - bw) / 2;
        return (
          <g key={i}>
            <title>{`${labels[i]}: ${v}`}</title>
            <rect
              x={x}
              y={H - 22 - h}
              width={bw}
              height={h}
              rx={4}
              fill={color}
              opacity={v === 0 ? 0.18 : 0.92}
            />
            {i % 2 === 0 && (
              <text
                x={slot * i + slot / 2}
                y={H - 6}
                textAnchor="middle"
                fontSize={10}
                fill="#6F6B80"
              >
                {labels[i]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Compact ⋮ action menu used on user rows and post rows. */
function RowMenu({
  label,
  items,
}: {
  label: string;
  items: { label: string; onClick: () => void }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-[#6F6B80] transition-colors hover:bg-[#F5F4FA] hover:text-[#211D33]"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <circle cx="12" cy="5" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 w-48 overflow-hidden rounded-xl bg-white py-1 shadow-lg shadow-[#211D33]/10 ring-1 ring-[#E6E3F0]"
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className="block w-full cursor-pointer px-4 py-2.5 text-left text-sm font-medium text-[#211D33] transition-colors hover:bg-[#F5F4FA]"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Small inline moderation button (reports / feedback cards, pagers). Never red. */
function MiniButton({
  label,
  tone,
  onClick,
  busy,
  disabled,
}: {
  label: string;
  tone: "primary" | "neutral";
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  const tones = {
    primary: "bg-[#4F46E5] text-white hover:bg-[#4338CA]",
    neutral:
      "bg-white text-[#211D33] ring-1 ring-[#E6E3F0] hover:bg-[#F5F4FA]",
  } as const;
  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={onClick}
      className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]}`}
    >
      {busy ? "Working..." : label}
    </button>
  );
}

function StatusBadge({ kind }: { kind: "active" | "banned" | "deleted" }) {
  const styles = {
    active: "bg-green-100 text-green-700",
    banned: "bg-red-100 text-red-700",
    deleted: "bg-neutral-200 text-[#6F6B80]",
  } as const;
  const labels = { active: "Active", banned: "Banned", deleted: "Deleted" } as const;
  return (
    <span
      className={`ml-1.5 rounded px-1.5 py-0.5 align-middle text-xs font-bold ${styles[kind]}`}
    >
      {labels[kind]}
    </span>
  );
}

function AnonymousBadge() {
  return (
    <span className="ml-1.5 rounded bg-neutral-200 px-1.5 py-0.5 align-middle text-xs font-bold text-[#6F6B80]">
      Anonymous
    </span>
  );
}

function ReportedBadge({ count }: { count: number }) {
  return (
    <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 align-middle text-xs font-bold text-amber-800">
      {count > 1 ? `${count} reports` : "Reported"}
    </span>
  );
}

function AvatarThumb({
  url,
  name,
  size = "h-10 w-10",
  text = "text-sm",
}: {
  url: string | null;
  name: string;
  size?: string;
  text?: string;
}) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className={`${size} shrink-0 rounded-full object-cover`} />;
  }
  return (
    <span
      className={`flex ${size} shrink-0 items-center justify-center rounded-full bg-[#4F46E5] ${text} font-bold text-white`}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

/** Previous/Next pager shared by the Posts and Users tabs. */
function Pager({
  page,
  totalPages,
  disableNext,
  summary,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number | null;
  disableNext: boolean;
  summary: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#E6E3F0] pt-3">
      <p className="text-xs text-[#6F6B80]">{summary}</p>
      <div className="flex items-center gap-2">
        <MiniButton
          label="Previous"
          tone="neutral"
          onClick={onPrev}
          disabled={page === 0}
        />
        <span className="whitespace-nowrap text-xs font-bold text-[#211D33]">
          Page {page + 1}
          {totalPages !== null ? ` of ${totalPages}` : ""}
        </span>
        <MiniButton
          label="Next"
          tone="neutral"
          onClick={onNext}
          disabled={disableNext}
        />
      </div>
    </div>
  );
}

/** "View all" link used on the Overview tab to jump to a detail tab. */
function ViewAllLink({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer text-sm font-bold text-[#4F46E5] transition-colors hover:text-[#4338CA] hover:underline"
    >
      {label}
    </button>
  );
}

function SectionTitle({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="text-base font-bold text-[#211D33]">{title}</h2>
        {subtitle && (
          <p className="mt-0.5 text-xs text-[#6F6B80]">{subtitle}</p>
        )}
      </div>
      {right}
    </div>
  );
}

const USER_SELECT_FULL =
  "id, username, full_name, avatar_url, created_at, is_banned, is_admin, bio, is_private, last_active_at, is_deleted";
const USER_SELECT_LEGACY =
  "id, username, full_name, avatar_url, created_at, is_banned, is_admin, bio, is_private";

/** Admin panel: moderation workspace with tabbed sections. Admins only. */
export default function AdminPage() {
  const router = useRouter();
  const [me, setMe] = useState<string | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [stats, setStats] = useState<{
    users: number;
    posts: number;
    comments: number;
    reports: number;
    newUsers7d: number | null;
  } | null>(null);
  const [activity, setActivity] = useState<ActivityStats | null>(null);
  const [activityReady, setActivityReady] = useState(false);
  const [dailyStats, setDailyStats] = useState<{
    labels: string[];
    signups: number[];
    posts: number[];
    comments: number[];
  } | null>(null);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRow[]>([]);
  const [feedbackReady, setFeedbackReady] = useState(false);
  const [postsAll, setPostsAll] = useState<AdminPost[]>([]);
  const [postPage, setPostPage] = useState(0);
  const [postDetail, setPostDetail] = useState<AdminPost | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userPage, setUserPage] = useState(0);
  // Users tab filter: "active" (default — deleted accounts hidden) or
  // "deleted" (only tombstones, with the Remove action to purge them).
  const [userFilter, setUserFilter] = useState<"active" | "deleted">("active");
  const [newestUsers, setNewestUsers] = useState<AdminUser[]>([]);
  const [postCounts, setPostCounts] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, UserDetail>>({});
  const [detailLoading, setDetailLoading] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Pending destructive/moderation confirmation (rendered via ChowkModal).
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const [confirmChecked, setConfirmChecked] = useState(false);

  // Guard: non-admins go back to the feed.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        router.replace("/feed");
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if ((data as { is_admin?: boolean } | null)?.is_admin === true) {
        setMe(user.id);
        setAllowed(true);
      } else {
        router.replace("/feed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  /** Dashboard stat counts, with the 42703 fallback for missing columns. */
  const loadStats = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase || !me) return;
    try {
      // Total users excludes deleted accounts — tombstones are not community
      // members. Falls back gracefully when is_deleted doesn't exist yet.
      const usersCount = (async () => {
        const filtered = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .not("is_deleted", "is", true);
        if (filtered.error && filtered.error.code === "42703") {
          return supabase
            .from("profiles")
            .select("id", { count: "exact", head: true });
        }
        return filtered;
      })();
      const [u, p, c, r] = await Promise.all([
        usersCount,
        supabase.from("posts").select("id", { count: "exact", head: true }),
        supabase.from("comments").select("id", { count: "exact", head: true }),
        supabase.from("reports").select("id", { count: "exact", head: true }),
      ]);
      // New signups in the last 7 days. Excludes deleted/deactivated accounts
      // when those columns exist (account_status.sql); falls back gracefully.
      const weekAgoIso = new Date(Date.now() - 7 * 864e5).toISOString();
      async function countNewUsers(
        withStatus: boolean
      ): Promise<number | null> {
        const s = getSupabaseClient();
        if (!s) return null;
        let req = s
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .gte("created_at", weekAgoIso);
        if (withStatus) {
          req = req.eq("is_deleted", false).eq("is_deactivated", false);
        }
        const { count, error } = await req;
        if (error) {
          if (error.code === "42703" && withStatus) {
            return countNewUsers(false);
          }
          return null;
        }
        return count ?? 0;
      }
      const newUsers7d = await countNewUsers(true);
      setStats({
        users: u.count ?? 0,
        posts: p.count ?? 0,
        comments: c.count ?? 0,
        reports: r.count ?? 0,
        newUsers7d,
      });
    } catch {
      setError("Could not load admin data. Please retry.");
    }
  }, [me]);

  /** 14-day analytics buckets (signups / posts / comments). Real data only;
      hidden admin + deleted accounts excluded, like everywhere else. */
  const loadDailyStats = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase || !me) return;
    try {
      const daysAgoIso = new Date(Date.now() - 14 * 864e5).toISOString();
      const [profRes, postRes, commentRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, created_at, is_admin, is_deleted")
          .gte("created_at", daysAgoIso),
        supabase
          .from("posts")
          .select("created_at, user_id")
          .gte("created_at", daysAgoIso),
        supabase
          .from("comments")
          .select("created_at")
          .gte("created_at", daysAgoIso),
      ]);
      if (profRes.error || postRes.error || commentRes.error) return;
      const adminIds = new Set(
        ((profRes.data ?? []) as { id: string; is_admin?: boolean }[])
          .filter((p) => p.is_admin)
          .map((p) => p.id)
      );
      const days: { label: string; start: number }[] = Array.from(
        { length: 14 },
        (_, i) => {
          const d = new Date();
          d.setHours(0, 0, 0, 0);
          d.setDate(d.getDate() - (13 - i));
          return {
            label: d.toLocaleDateString("en-US", {
              day: "numeric",
              month: "short",
            }),
            start: d.getTime(),
          };
        }
      );
      const bucketOf = (iso: string) => {
        const t = new Date(iso).getTime();
        for (let i = 0; i < days.length; i++) {
          if (t >= days[i].start && t < days[i].start + 864e5) return i;
        }
        return -1;
      };
      const signups = new Array(14).fill(0);
      const posts = new Array(14).fill(0);
      const comments = new Array(14).fill(0);
      for (const p of (profRes.data ?? []) as {
        created_at: string;
        is_admin?: boolean;
        is_deleted?: boolean;
      }[]) {
        if (p.is_admin || p.is_deleted) continue;
        const b = bucketOf(p.created_at);
        if (b >= 0) signups[b] += 1;
      }
      for (const p of (postRes.data ?? []) as {
        created_at: string;
        user_id: string;
      }[]) {
        if (adminIds.has(p.user_id)) continue;
        const b = bucketOf(p.created_at);
        if (b >= 0) posts[b] += 1;
      }
      for (const c of (commentRes.data ?? []) as { created_at: string }[]) {
        const b = bucketOf(c.created_at);
        if (b >= 0) comments[b] += 1;
      }
      setDailyStats({
        labels: days.map((d) => d.label),
        signups,
        posts,
        comments,
      });
    } catch {
      /* leave as null — charts show Loading */
    }
  }, [me]);

  /** Reports queue (newest first). */
  const loadReports = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase || !me) return;
    try {
      const { data: reportRows, error: reportError } = await supabase
        .from("reports")
        .select(
          `id, reporter_id, post_id, reported_user_id, reason, created_at,
           reporter:profiles!reports_reporter_id_fkey(username, full_name),
           post:posts!reports_post_id_fkey(id, content, user_id, is_anonymous, author:profiles!posts_user_id_fkey(username, full_name)),
           reported_user:profiles!reports_reported_user_id_fkey(id, username, full_name, is_banned)`
        )
        .order("created_at", { ascending: false })
        .limit(50);
      if (reportError) throw reportError;
      const normalized = ((reportRows ?? []) as unknown as Array<
        Record<string, unknown>
      >).map((row) => {
        const post = one(
          row["post"] as ReportRow["post"] | ReportRow["post"][]
        );
        return {
          ...(row as object),
          reporter: one(
            row["reporter"] as ReportRow["reporter"] | ReportRow["reporter"][]
          ),
          post: post
            ? {
                ...post,
                author: one(
                  post.author as
                    | ReportPostAuthor
                    | ReportPostAuthor[]
                    | null
                    | undefined
                ),
              }
            : null,
          reported_user: one(
            row["reported_user"] as
              | ReportRow["reported_user"]
              | ReportRow["reported_user"][]
          ),
        };
      }) as ReportRow[];
      setReports(normalized);
    } catch {
      setError("Could not load admin data. Please retry.");
    }
  }, [me]);

  /**
   * Posts browser (newest first, bounded fetch).
   * Admin-authored posts are NEVER shown here — the secret admin stays hidden.
   */
  const loadPosts = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase || !me) return;
    try {
      const { data: postRows, error: postError } = await supabase
        .from("posts")
        .select(
          "id, content, created_at, is_anonymous, user_id, author:profiles!posts_user_id_fkey(username, full_name, is_admin, avatar_url)"
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (postError) throw postError;
      const mapped = (
        ((postRows ?? []) as unknown as Array<Record<string, unknown>>).map(
          (row) => ({
            ...(row as object),
            author: one(
              row["author"] as AdminPost["author"] | AdminPost["author"][]
            ),
          })
        ) as AdminPost[]
      ).filter((p) => p.author?.is_admin !== true);
      setPostsAll(mapped);
    } catch {
      setError("Could not load admin data. Please retry.");
    }
  }, [me]);

  /** Feedback inbox: fail-safe — the table exists only after feedback.sql. */
  const loadFeedback = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase || !me) return;
    try {
      const { data: feedbackRows, error: feedbackError } = await supabase
        .from("feedback")
        .select(
          "id, user_id, category, message, status, created_at, user:profiles!feedback_user_id_fkey(username, full_name, avatar_url)"
        )
        .order("created_at", { ascending: false })
        .limit(100);
      if (feedbackError) throw feedbackError;
      setFeedback(
        ((feedbackRows ?? []) as unknown as Array<
          Record<string, unknown>
        >).map((row) => ({
          ...(row as object),
          user: one(
            row["user"] as FeedbackRow["user"] | FeedbackRow["user"][]
          ),
        })) as FeedbackRow[]
      );
      setFeedbackReady(true);
    } catch {
      setFeedbackReady(false);
    }
  }, [me]);

  /** Activity stats — fail-safe until security_lock.sql §14 (last_active_at) is run. */
  const loadActivity = useCallback(async () => {
    try {
      const supabase2 = getSupabaseClient();
      if (!supabase2) {
        setActivityReady(true);
        return;
      }
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const weekAgo = new Date(Date.now() - 7 * 864e5);
      const monthAgo = new Date(Date.now() - 30 * 864e5);
      const [d, w, m, rows] = await Promise.all([
        supabase2
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .gte("last_active_at", startOfToday.toISOString()),
        supabase2
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .gte("last_active_at", weekAgo.toISOString()),
        supabase2
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .gte("last_active_at", monthAgo.toISOString()),
        supabase2
          .from("profiles")
          .select("last_active_at")
          .gte("last_active_at", weekAgo.toISOString())
          .not("last_active_at", "is", null),
      ]);
      if (d.error || w.error || m.error || rows.error) throw new Error("activity");
      const buckets = Array.from({ length: 7 }, (_, i) => {
        const day = new Date();
        day.setHours(0, 0, 0, 0);
        day.setDate(day.getDate() - (6 - i));
        return {
          label: day.toLocaleDateString("en-US", { weekday: "short" }),
          start: day.getTime(),
          count: 0,
        };
      });
      for (const row of (rows.data ?? []) as { last_active_at: string }[]) {
        const t = new Date(row.last_active_at).getTime();
        for (const b of buckets) {
          if (t >= b.start && t < b.start + 864e5) {
            b.count += 1;
            break;
          }
        }
      }
      setActivity({
        today: d.count ?? 0,
        week: w.count ?? 0,
        month: m.count ?? 0,
        buckets: buckets.map(({ label, count }) => ({ label, count })),
      });
    } catch {
      setActivity(null);
    } finally {
      setActivityReady(true);
    }
  }, []);

  /** Newest-users preview for the Overview tab (deleted accounts excluded). */
  const loadNewestPreview = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase || !me) return;
    const run = (columns: string, filterDeleted: boolean) => {
      let q = supabase
        .from("profiles")
        .select(columns)
        .order("created_at", { ascending: false })
        .limit(5);
      if (filterDeleted) q = q.not("is_deleted", "is", true);
      return q;
    };
    let { data, error } = await run(USER_SELECT_FULL, true);
    if (error && error.code === "42703") {
      ({ data, error } = await run(USER_SELECT_LEGACY, false));
    }
    if (!error) setNewestUsers(((data ?? []) as unknown) as AdminUser[]);
  }, [me]);

  /** Core datasets for Overview/Posts/Reports. */
  const loadCore = useCallback(async () => {
    setError(null);
    await Promise.all([loadStats(), loadReports(), loadPosts(), loadDailyStats()]);
  }, [loadStats, loadReports, loadPosts, loadDailyStats]);

  const loadUsers = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase || !me) return;
    const q = query.trim();
    const start = userPage * USERS_PAGE_SIZE;
    const run = async (columns: string, withDeletedFilter: boolean) => {
      let req = supabase
        .from("profiles")
        .select(columns)
        .order("created_at", { ascending: false })
        .range(start, start + USERS_PAGE_SIZE - 1);
      if (withDeletedFilter) {
        req =
          userFilter === "deleted"
            ? req.eq("is_deleted", true)
            : req.not("is_deleted", "is", true);
      }
      if (q) req = req.or(`username.ilike.%${q}%,full_name.ilike.%${q}%`);
      return req;
    };
    let { data, error } = await run(USER_SELECT_FULL, true);
    if (error && error.code === "42703") {
      // last_active_at / is_deleted columns not added yet — retry without them.
      ({ data, error } = await run(USER_SELECT_LEGACY, false));
    }
    if (error) return;
    const list = ((data ?? []) as unknown) as AdminUser[];
    setUsers(list);
    if (list.length > 0) {
      const { data: posts } = await supabase
        .from("posts")
        .select("user_id")
        .in(
          "user_id",
          list.map((u) => u.id)
        );
      const counts: Record<string, number> = {};
      for (const row of (posts ?? []) as { user_id: string }[]) {
        counts[row.user_id] = (counts[row.user_id] ?? 0) + 1;
      }
      setPostCounts(counts);
    } else {
      setPostCounts({});
    }
  }, [me, query, userPage, userFilter]);

  useEffect(() => {
    if (allowed) {
      void loadCore();
      void loadActivity();
      void loadNewestPreview();
      // Eager like the other datasets (fail-safe if feedback.sql is missing);
      // also powers the open-feedback badge on the Feedback tab.
      void loadFeedback();
    }
  }, [allowed, loadCore, loadActivity, loadNewestPreview, loadFeedback]);

  useEffect(() => {
    if (!allowed) return;
    const t = window.setTimeout(() => void loadUsers(), 300);
    return () => window.clearTimeout(t);
  }, [allowed, loadUsers]);

  // Keep the post page in range when the underlying list shrinks.
  useEffect(() => {
    const max = Math.max(0, Math.ceil(postsAll.length / POSTS_PAGE_SIZE) - 1);
    if (postPage > max) setPostPage(max);
  }, [postsAll, postPage]);

  // Live new signups: a freshly registered user appears at the top of the
  // admin users list instantly, no refresh needed. Requires profiles to be in
  // the supabase_realtime publication (supabase/realtime_profiles.sql).
  // queryRef mirrors the search box (and userPageRef the page) so typing or
  // paging doesn't resubscribe.
  const queryRef = useRef(query);
  queryRef.current = query;
  const userPageRef = useRef(userPage);
  userPageRef.current = userPage;
  useEffect(() => {
    if (!allowed) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    // Unique topic per effect run: supabase.channel() dedupes by topic and
    // hands back the existing channel if the previous one hasn't finished
    // its async unsubscribe yet — calling .on() on that joined channel
    // throws "cannot add ... callbacks ... after 'subscribe()'".
    const runId = `${Date.now().toString(36)}${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const channel = supabase
      .channel(`chowk-admin-signups:${runId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "profiles" },
        (payload) => {
          const row = payload.new as unknown as AdminUser;
          if (!row || !row.id) return;
          setStats((prev) =>
            prev
              ? {
                  ...prev,
                  users: prev.users + 1,
                  newUsers7d:
                    prev.newUsers7d === null ? null : prev.newUsers7d + 1,
                }
              : prev
          );
          // Don't disturb an active search or a later page.
          if (queryRef.current.trim() !== "" || userPageRef.current !== 0)
            return;
          setUsers((prev) => {
            if (prev.some((u) => u.id === row.id)) return prev;
            return [row, ...prev].slice(0, USERS_PAGE_SIZE);
          });
          setPostCounts((prev) => ({ ...prev, [row.id]: 0 }));
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [allowed]);

  async function toggleExpand(u: AdminUser) {
    if (expandedId === u.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(u.id);
    if (details[u.id] || detailLoading === u.id) return;
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setDetailLoading(u.id);
    try {
      const [fer, fing, psts] = await Promise.all([
        supabase
          .from("follows")
          .select("follower_id", { count: "exact", head: true })
          .eq("following_id", u.id),
        supabase
          .from("follows")
          .select("following_id", { count: "exact", head: true })
          .eq("follower_id", u.id),
        supabase
          .from("posts")
          .select("id, content, created_at, is_anonymous")
          .eq("user_id", u.id)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);
      setDetails((prev) => ({
        ...prev,
        [u.id]: {
          followers: fer.count ?? 0,
          following: fing.count ?? 0,
          posts: (psts.data ?? []) as UserDetail["posts"],
        },
      }));
    } catch {
      setDetails((prev) => ({
        ...prev,
        [u.id]: { followers: 0, following: 0, posts: [] },
      }));
    } finally {
      setDetailLoading(null);
    }
  }

  async function dismissReport(id: string) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setBusyId(id);
    try {
      const { error } = await supabase.from("reports").delete().eq("id", id);
      if (error) throw error;
      await Promise.all([loadStats(), loadReports()]);
    } catch {
      setError("Could not dismiss the report.");
    } finally {
      setBusyId(null);
    }
  }

  function requestDeletePost(postId: string, reportId?: string) {
    setConfirmChecked(false);
    setConfirm({
      title: "Delete this post?",
      body: "Are you sure you want to delete this post? This cannot be undone.",
      confirmLabel: "Delete",
      tone: "dark",
      run: () => {
        setConfirm(null);
        void doDeletePost(postId, reportId);
      },
    });
  }

  async function doDeletePost(postId: string, reportId?: string) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setBusyId(postId);
    try {
      const { error } = await supabase.from("posts").delete().eq("id", postId);
      if (error) throw error;
      if (reportId) await supabase.from("reports").delete().eq("id", reportId);
      await loadCore();
      setPostPage(0);
    } catch {
      setError("Could not delete the post.");
    } finally {
      setBusyId(null);
    }
  }

  function requestBanToggle(u: {
    id: string;
    username: string;
    full_name: string | null;
    is_banned: boolean | null;
  }) {
    const banning = !u.is_banned;
    const name = u.full_name || `@${u.username}`;
    setConfirmChecked(false);
    setConfirm({
      title: banning ? "Ban this user?" : "Unban this user?",
      body: banning
        ? `${name} will lose access to the app.`
        : `Restore access for ${name}?`,
      confirmLabel: banning ? "Ban user" : "Unban user",
      tone: banning ? "dark" : "primary",
      run: () => {
        setConfirm(null);
        void doSetBanned(u.id, banning);
      },
    });
  }

  async function doSetBanned(userId: string, banned: boolean) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setError(null);
    setBusyId(userId);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_banned: banned })
        .eq("id", userId);
      if (error) throw error;
      await Promise.all([loadUsers(), loadReports()]);
    } catch {
      setError("Could not update the user.");
    } finally {
      setBusyId(null);
    }
  }

  function requestPermanentDelete(u: AdminUser) {
    const name = u.full_name || `@${u.username}`;
    const alreadyDeleted = u.is_deleted === true;
    setConfirmChecked(false);
    setConfirm({
      title: alreadyDeleted ? "Remove deleted account?" : "Delete user permanently?",
      body: alreadyDeleted
        ? `This removes ${name}'s deleted account from the user list for good. Their posts and data are already gone. This cannot be undone.`
        : `This permanently deletes ${name} and all their posts, comments, messages and data. This cannot be undone.`,
      confirmLabel: alreadyDeleted ? "Remove" : "Delete permanently",
      tone: "dark",
      requireCheck: "I understand this cannot be undone",
      run: () => {
        setConfirm(null);
        void deleteUserPermanently(u.id);
      },
    });
  }

  async function deleteUserPermanently(userId: string) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setError(null);
    setBusyId(userId);
    try {
      // Best-effort: remove the user's storage files first via the Storage
      // API (Supabase blocks direct DELETE on storage.objects, so the RPC
      // cannot remove files itself). Failures here never block the delete.
      try {
        const folders = [
          userId,
          `${userId}/videos`,
          `${userId}/comments`,
          `avatars/${userId}`,
          `covers/${userId}`,
        ];
        for (const folder of folders) {
          const { data: files } = await supabase.storage
            .from("post-images")
            .list(folder);
          const paths = (files ?? [])
            .filter((f) => f.id)
            .map((f) => `${folder}/${f.name}`);
          if (paths.length > 0) {
            await supabase.storage.from("post-images").remove(paths);
          }
        }
      } catch {
        // best-effort only
      }
      const { error } = await supabase.rpc("admin_delete_user", {
        target_user_id: userId,
      });
      if (error) throw error;
      if (expandedId === userId) setExpandedId(null);
      await Promise.all([loadCore(), loadUsers(), loadNewestPreview()]);
    } catch (e) {
      const msg =
        e instanceof Error && e.message
          ? e.message
          : "Could not delete the user.";
      // The RPC only exists after admin_delete_user.sql is run in Supabase.
      setError(
        /could not find the function|does not exist/i.test(msg)
          ? "Could not delete — the database update (admin_delete_user.sql) may not be installed yet."
          : msg
      );
    } finally {
      setBusyId(null);
    }
  }

  async function setFeedbackStatus(id: string, status: "open" | "resolved") {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setBusyId(id);
    try {
      const { error } = await supabase
        .from("feedback")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
      await loadFeedback();
    } catch {
      setError("Could not update the feedback.");
    } finally {
      setBusyId(null);
    }
  }

  function requestDeleteFeedback(id: string) {
    setConfirmChecked(false);
    setConfirm({
      title: "Delete this feedback?",
      body: "Are you sure you want to delete this feedback? This cannot be undone.",
      confirmLabel: "Delete",
      tone: "dark",
      run: () => {
        setConfirm(null);
        void doDeleteFeedback(id);
      },
    });
  }

  async function doDeleteFeedback(id: string) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setBusyId(id);
    try {
      const { error } = await supabase.from("feedback").delete().eq("id", id);
      if (error) throw error;
      await loadFeedback();
    } catch {
      setError("Could not delete the feedback.");
    } finally {
      setBusyId(null);
    }
  }

  /** Reports grouped by the reported post, for post-row badges and menus. */
  const reportedByPost = useMemo(() => {
    const m = new Map<string, ReportRow[]>();
    for (const r of reports) {
      if (!r.post_id) continue;
      const arr = m.get(r.post_id) ?? [];
      arr.push(r);
      m.set(r.post_id, arr);
    }
    return m;
  }, [reports]);

  const totalPostPages = Math.max(
    1,
    Math.ceil(postsAll.length / POSTS_PAGE_SIZE)
  );
  const pagePosts = postsAll.slice(
    postPage * POSTS_PAGE_SIZE,
    postPage * POSTS_PAGE_SIZE + POSTS_PAGE_SIZE
  );
  const pendingReports = reports.length;
  const openFeedbackCount = feedback.filter((f) => f.status === "open").length;
  const userTotalPages = stats
    ? Math.max(1, Math.ceil(stats.users / USERS_PAGE_SIZE))
    : null;

  if (allowed !== true) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center px-4">
        <p className="text-sm text-[#6F6B80]">Loading...</p>
      </main>
    );
  }

  const chartMax = Math.max(1, ...(activity?.buckets.map((b) => b.count) ?? [1]));

  const openPostDetail = (p: AdminPost) => setPostDetail(p);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-4 bg-[#F5F4FA] px-3 py-4 sm:px-4">
      {/* Moderation-mode header with tab navigation */}
      <header className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#E6E3F0]">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#4F46E5] text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-[#211D33]">Admin Panel</h1>
            <p className="text-sm text-[#6F6B80]">
              Manage your Chowk community
            </p>
          </div>
        </div>
        <nav
          aria-label="Admin sections"
          className="mt-4 flex gap-1 overflow-x-auto pb-1"
        >
          {TABS.map((t) => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                  active
                    ? "bg-[#4F46E5] text-white shadow-sm shadow-[#4F46E5]/25"
                    : "text-[#6F6B80] hover:bg-[#F5F4FA] hover:text-[#211D33]"
                }`}
              >
                {t.label}
                {t.id === "reports" && pendingReports > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                      active
                        ? "bg-white/25 text-white"
                        : "bg-[#4F46E5]/10 text-[#4F46E5]"
                    }`}
                  >
                    {pendingReports}
                  </span>
                )}
                {t.id === "feedback" && openFeedbackCount > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${
                      active
                        ? "bg-white/25 text-white"
                        : "bg-[#4F46E5]/10 text-[#4F46E5]"
                    }`}
                  >
                    {openFeedbackCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </header>

      {error && (
        <div className="rounded-2xl bg-red-50 p-4 text-sm font-medium text-red-700 ring-1 ring-red-200">
          {error}
        </div>
      )}

      {/* ================= OVERVIEW ================= */}
      {activeTab === "overview" && (
        <div className="flex flex-col gap-6">
          {/* Stat cards: full width on top */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard
              label="New Users"
              value={stats && stats.newUsers7d !== null ? String(stats.newUsers7d) : "…"}
              highlight
            />
            <StatCard label="Total Users" value={stats ? String(stats.users) : "…"} />
            <StatCard label="Posts" value={stats ? String(stats.posts) : "…"} />
            <StatCard label="Comments" value={stats ? String(stats.comments) : "…"} />
            <StatCard label="Reports" value={stats ? String(stats.reports) : "…"} />
          </section>

          <div className="grid items-start gap-6 lg:grid-cols-3">
          {/* LEFT: the whole left side is analytics */}
          <div className="lg:col-span-2">
          {/* Analytics — real data, last 14 days */}
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#E6E3F0]">
            <SectionTitle
              title="Analytics"
              right={
                <span className="text-xs font-medium text-[#6F6B80]">
                  Last 14 days
                </span>
              }
            />
            {!dailyStats ? (
              <p className="mt-3 text-sm text-[#6F6B80]">Loading...</p>
            ) : (
              <>
                <p className="mt-4 text-sm font-bold text-[#211D33]">
                  New signups
                </p>
                <BarChart
                  labels={dailyStats.labels}
                  values={dailyStats.signups}
                  color="#4F46E5"
                />
                <p className="mt-4 text-sm font-bold text-[#211D33]">Posts</p>
                <BarChart
                  labels={dailyStats.labels}
                  values={dailyStats.posts}
                  color="#8B5CF6"
                />
                <p className="mt-4 text-sm font-bold text-[#211D33]">Comments</p>
                <BarChart
                  labels={dailyStats.labels}
                  values={dailyStats.comments}
                  color="#EC4899"
                />
              </>
            )}
          </section>
          </div>

          {/* RIGHT: moderation + activity */}
          <div className="flex flex-col gap-4">
            {/* Moderation summary */}
            <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#E6E3F0]">
              <SectionTitle title="Needs attention" />
              {pendingReports === 0 ? (
                <div className="mt-3 rounded-xl bg-[#F5F4FA] p-5 text-center ring-1 ring-[#E6E3F0]">
                  <p className="text-sm font-bold text-[#211D33]">
                    You&apos;re all caught up.
                  </p>
                  <p className="mt-0.5 text-sm text-[#6F6B80]">
                    No reports need your attention.
                  </p>
                </div>
              ) : (
                <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-[#F5F4FA] p-4 ring-1 ring-[#E6E3F0]">
                  <p className="text-sm text-[#6F6B80]">
                    <span className="text-2xl font-bold text-[#211D33]">
                      {pendingReports}
                    </span>{" "}
                    pending {pendingReports === 1 ? "report" : "reports"}
                  </p>
                  <ViewAllLink
                    label="Review reports →"
                    onClick={() => setActiveTab("reports")}
                  />
                </div>
              )}
              <div className="mt-3 flex flex-col gap-2 border-t border-[#E6E3F0] pt-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-[#6F6B80]">Content moderation</p>
                  <ViewAllLink
                    label="View all posts →"
                    onClick={() => setActiveTab("posts")}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-[#6F6B80]">User management</p>
                  <ViewAllLink
                    label="View all users →"
                    onClick={() => setActiveTab("users")}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-sm text-[#6F6B80]">
                    Feedback
                    {openFeedbackCount > 0 && ` (${openFeedbackCount} open)`}
                  </p>
                  <ViewAllLink
                    label="View feedback →"
                    onClick={() => setActiveTab("feedback")}
                  />
                </div>
              </div>
            </section>

            {/* Activity summary */}
            <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#E6E3F0]">
              <SectionTitle
                title="Activity summary"
                right={
                  <ViewAllLink
                    label="View activity →"
                    onClick={() => setActiveTab("activity")}
                  />
                }
              />
              {!activityReady ? (
                <p className="mt-3 text-sm text-[#6F6B80]">Loading...</p>
              ) : !activity ? (
                <p className="mt-3 text-sm text-[#6F6B80]">
                  Activity tracking is not enabled yet. Run the latest
                  security_lock.sql in Supabase SQL Editor, then refresh.
                </p>
              ) : (
                <div className="mt-3 grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-[#F5F4FA] p-3 ring-1 ring-[#E6E3F0]">
                    <p className="text-xl font-bold text-[#211D33]">
                      {activity.today}
                    </p>
                    <p className="mt-0.5 text-xs text-[#6F6B80]">Active today</p>
                  </div>
                  <div className="rounded-xl bg-[#F5F4FA] p-3 ring-1 ring-[#E6E3F0]">
                    <p className="text-xl font-bold text-[#211D33]">
                      {activity.week}
                    </p>
                    <p className="mt-0.5 text-xs text-[#6F6B80]">This week</p>
                  </div>
                  <div className="rounded-xl bg-[#F5F4FA] p-3 ring-1 ring-[#E6E3F0]">
                    <p className="text-xl font-bold text-[#211D33]">
                      {activity.month}
                    </p>
                    <p className="mt-0.5 text-xs text-[#6F6B80]">This month</p>
                  </div>
                </div>
              )}
            </section>

          {/* Recent posts preview */}
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#E6E3F0]">
            <SectionTitle
              title="Recent posts"
              right={
                <ViewAllLink
                  label="View all posts →"
                  onClick={() => setActiveTab("posts")}
                />
              }
            />
            {postsAll.length === 0 ? (
              <p className="mt-2 text-sm text-[#6F6B80]">No posts yet.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-1">
                {postsAll.slice(0, 5).map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setActiveTab("posts")}
                      className="flex w-full cursor-pointer items-start gap-3 rounded-xl p-2 text-left transition-colors hover:bg-[#F5F4FA]"
                    >
                      <AvatarThumb
                        url={p.author?.avatar_url ?? null}
                        name={p.author?.full_name || p.author?.username || "?"}
                        size="h-9 w-9"
                        text="text-xs"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          <span className="font-bold text-[#211D33]">
                            {p.author?.full_name ||
                              (p.author ? `@${p.author.username}` : "Someone")}
                          </span>
                          {p.is_anonymous && <AnonymousBadge />}
                          {(reportedByPost.get(p.id)?.length ?? 0) > 0 && (
                            <ReportedBadge
                              count={reportedByPost.get(p.id)!.length}
                            />
                          )}
                          <span className="ml-1.5 text-xs text-[#6F6B80]">
                            · {timeAgo(p.created_at)}
                          </span>
                        </p>
                        {p.content && (
                          <p className="mt-0.5 line-clamp-2 text-sm text-[#6F6B80]">
                            {p.content}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Newest users preview */}
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#E6E3F0]">
            <SectionTitle
              title="Newest users"
              right={
                <ViewAllLink
                  label="View all users →"
                  onClick={() => setActiveTab("users")}
                />
              }
            />
            {newestUsers.length === 0 ? (
              <p className="mt-2 text-sm text-[#6F6B80]">No users yet.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-1">
                {newestUsers.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => setActiveTab("users")}
                      className="flex w-full cursor-pointer items-center gap-3 rounded-xl p-2 text-left transition-colors hover:bg-[#F5F4FA]"
                    >
                      <AvatarThumb
                        url={u.avatar_url}
                        name={u.full_name || u.username}
                        size="h-9 w-9"
                        text="text-xs"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-[#211D33]">
                          {u.full_name || u.username}
                          <StatusBadge
                            kind={
                              u.is_deleted
                                ? "deleted"
                                : u.is_banned
                                  ? "banned"
                                  : "active"
                            }
                          />
                        </p>
                        <p className="truncate text-xs text-[#6F6B80]">
                          @{u.username} · joined {timeAgo(u.created_at)}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          </div>
          </div>
        </div>
      )}

      {/* ================= POSTS ================= */}
      {activeTab === "posts" && (
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#E6E3F0]">
          <SectionTitle
            title="Posts"
            subtitle="Anonymous authors are revealed to admins only."
            right={
              <p className="shrink-0 text-xs font-medium text-[#6F6B80]">
                {postsAll.length} {postsAll.length === 1 ? "post" : "posts"}
              </p>
            }
          />
          {postsAll.length === 0 ? (
            <p className="mt-2 text-sm text-[#6F6B80]">No posts yet.</p>
          ) : (
            <>
              <ul className="mt-3 flex flex-col gap-2">
                {pagePosts.map((p) => {
                  const postReports = reportedByPost.get(p.id) ?? [];
                  return (
                    <li
                      key={p.id}
                      className="flex items-start gap-3 rounded-xl p-2 ring-1 ring-[#E6E3F0] transition-colors hover:bg-[#F5F4FA]"
                    >
                      <AvatarThumb
                        url={p.author?.avatar_url ?? null}
                        name={p.author?.full_name || p.author?.username || "?"}
                        size="h-10 w-10"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          <span className="font-bold text-[#211D33]">
                            {p.author?.full_name ||
                              (p.author ? `@${p.author.username}` : "Someone")}
                          </span>
                          {p.author && (
                            <span className="ml-1.5 text-xs font-medium text-[#4F46E5]">
                              @{p.author.username}
                            </span>
                          )}
                          {p.is_anonymous && <AnonymousBadge />}
                          {postReports.length > 0 && (
                            <ReportedBadge count={postReports.length} />
                          )}
                          <span className="ml-1.5 text-xs text-[#6F6B80]">
                            · {timeAgo(p.created_at)}
                          </span>
                        </p>
                        {p.content && (
                          <p className="mt-0.5 line-clamp-2 text-sm text-[#6F6B80]">
                            {p.content}
                          </p>
                        )}
                      </div>
                      <RowMenu
                        label={`Moderate post by ${p.author?.username ?? "unknown"}`}
                        items={[
                          {
                            label: "Post details",
                            onClick: () => openPostDetail(p),
                          },
                          ...(p.author
                            ? [
                                {
                                  label: "View profile",
                                  onClick: () =>
                                    window.open(
                                      `/profile/${encodeURIComponent(p.author!.username)}`,
                                      "_blank",
                                      "noopener,noreferrer"
                                    ),
                                },
                              ]
                            : []),
                          ...(postReports.length > 0
                            ? [
                                {
                                  label:
                                    postReports.length > 1
                                      ? `Go to reports (${postReports.length})`
                                      : "Go to report",
                                  onClick: () => setActiveTab("reports"),
                                },
                              ]
                            : []),
                          {
                            label: "Delete post",
                            onClick: () => requestDeletePost(p.id),
                          },
                        ]}
                      />
                    </li>
                  );
                })}
              </ul>
              <Pager
                page={postPage}
                totalPages={totalPostPages}
                disableNext={postPage >= totalPostPages - 1}
                summary={`Showing ${pagePosts.length} of ${postsAll.length} posts`}
                onPrev={() => setPostPage((v) => Math.max(0, v - 1))}
                onNext={() =>
                  setPostPage((v) => Math.min(totalPostPages - 1, v + 1))
                }
              />
            </>
          )}
        </section>
      )}

      {/* ================= REPORTS ================= */}
      {activeTab === "reports" && (
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#E6E3F0]">
          <SectionTitle title="Reports" />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <StatCard
              label="Needs attention"
              value={String(pendingReports)}
              highlight={pendingReports > 0}
            />
            <StatCard label="Total reports" value={String(reports.length)} />
          </div>
          <p className="mt-2 text-xs text-[#6F6B80]">
            Dismissed reports are removed from the queue.
          </p>
          {reports.length === 0 ? (
            <div className="mt-3 rounded-xl bg-[#F5F4FA] p-6 text-center ring-1 ring-[#E6E3F0]">
              <p className="text-sm font-bold text-[#211D33]">
                No reports need your attention.
              </p>
              <p className="mt-0.5 text-sm text-[#6F6B80]">
                Everything is clear for now.
              </p>
            </div>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {reports.map((rep) => (
                <li
                  key={rep.id}
                  className="rounded-xl bg-[#F5F4FA] p-3 ring-1 ring-[#E6E3F0]"
                >
                  <div className="flex flex-wrap items-center gap-x-2 text-sm">
                    <span className="font-bold text-[#211D33]">
                      {rep.reporter?.full_name || rep.reporter?.username || "Someone"}
                    </span>
                    <span className="text-[#6F6B80]">reported</span>
                    {rep.post ? (
                      <span className="font-bold text-[#211D33]">
                        a post by{" "}
                        {rep.post.author ? (
                          <Link
                            href={`/profile/${rep.post.author.username}`}
                            className="cursor-pointer text-[#4F46E5] hover:underline"
                          >
                            @{rep.post.author.username}
                          </Link>
                        ) : (
                          "someone"
                        )}
                        {rep.post.is_anonymous && <AnonymousBadge />}
                      </span>
                    ) : rep.reported_user ? (
                      <Link
                        href={`/profile/${rep.reported_user.username}`}
                        className="cursor-pointer font-bold text-[#4F46E5] hover:underline"
                      >
                        @{rep.reported_user.username}
                      </Link>
                    ) : (
                      <span className="text-[#6F6B80]">something</span>
                    )}
                    <span className="text-xs text-[#6F6B80]">
                      · {timeAgo(rep.created_at)}
                    </span>
                  </div>
                  {rep.reason && (
                    <p className="mt-1.5 text-sm text-[#211D33]">
                      <span className="font-bold">Reason: </span>
                      {rep.reason}
                    </p>
                  )}
                  {rep.post?.content && (
                    <p className="mt-1.5 line-clamp-2 rounded-lg bg-white p-2 text-sm text-[#6F6B80] ring-1 ring-[#E6E3F0]">
                      {rep.post.content}
                    </p>
                  )}
                  {rep.reported_user?.is_banned && (
                    <span className="mt-1.5 inline-block rounded bg-red-100 px-1.5 py-0.5 text-xs font-bold text-red-700">
                      Currently banned
                    </span>
                  )}
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {rep.post && (
                      <MiniButton
                        label="Delete post"
                        tone="neutral"
                        busy={busyId === rep.post.id}
                        onClick={() => requestDeletePost(rep.post!.id, rep.id)}
                      />
                    )}
                    {rep.reported_user && (
                      <MiniButton
                        label={
                          rep.reported_user.is_banned ? "Unban user" : "Ban user"
                        }
                        tone="neutral"
                        busy={busyId === rep.reported_user.id}
                        disabled={rep.reported_user.id === me}
                        onClick={() =>
                          requestBanToggle({
                            id: rep.reported_user!.id,
                            username: rep.reported_user!.username,
                            full_name: rep.reported_user!.full_name,
                            is_banned: rep.reported_user!.is_banned,
                          })
                        }
                      />
                    )}
                    <MiniButton
                      label="Dismiss"
                      tone="neutral"
                      busy={busyId === rep.id}
                      onClick={() => void dismissReport(rep.id)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* ================= USERS ================= */}
      {activeTab === "users" && (
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#E6E3F0]">
          <SectionTitle
            title="Users"
            subtitle="Search, moderate, and manage community members."
          />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setUserPage(0);
            }}
            placeholder="Search by username or name..."
            className="mt-3 w-full rounded-xl border border-[#E6E3F0] bg-[#F5F4FA] px-4 py-2.5 text-sm text-[#211D33] placeholder:text-neutral-400 focus:border-[#4F46E5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/30"
          />
          <div
            className="mt-3 flex gap-2"
            role="tablist"
            aria-label="User list filter"
          >
            {(
              [
                { id: "active", label: "Active users" },
                { id: "deleted", label: "Deleted" },
              ] as const
            ).map((f) => {
              const selected = userFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => {
                    setUserFilter(f.id);
                    setUserPage(0);
                  }}
                  className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
                    selected
                      ? "bg-[#4F46E5] text-white shadow-sm shadow-[#4F46E5]/25"
                      : "text-[#6F6B80] hover:bg-[#F5F4FA] hover:text-[#211D33]"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
          {userFilter === "deleted" && (
            <p className="mt-2 text-xs text-[#6F6B80]">
              Deleted accounts stay blocked from signing in. Open ⋮ → Delete
              permanently on one, then confirm Remove, to erase it from this
              list for good.
            </p>
          )}
          <ul className="mt-3 flex flex-col gap-2">
            {users.map((u) => {
              const expanded = expandedId === u.id;
              const d = details[u.id];
              return (
                <li
                  key={u.id}
                  className="rounded-xl ring-1 ring-[#E6E3F0]"
                >
                  <div className="flex items-center gap-3 p-2">
                    <button
                      type="button"
                      onClick={() => void toggleExpand(u)}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg text-left"
                      aria-expanded={expanded}
                    >
                      <AvatarThumb
                        url={u.avatar_url}
                        name={u.full_name || u.username}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-[#211D33]">
                          {u.full_name || u.username}
                          {u.id === me && (
                            <span className="ml-1.5 text-xs font-normal text-[#6F6B80]">
                              (you)
                            </span>
                          )}
                          {u.is_admin && (
                            <span className="ml-1.5 rounded bg-[#EEF2FF] px-1.5 py-0.5 align-middle text-xs font-bold text-[#4F46E5]">
                              admin
                            </span>
                          )}
                          <StatusBadge
                            kind={
                              u.is_deleted
                                ? "deleted"
                                : u.is_banned
                                  ? "banned"
                                  : "active"
                            }
                          />
                        </p>
                        <p className="truncate text-xs text-[#6F6B80]">
                          @{u.username} · joined {timeAgo(u.created_at)} ·{" "}
                          {postCounts[u.id] ?? 0} posts
                          {u.last_active_at
                            ? ` · active ${timeAgo(u.last_active_at)}`
                            : ""}
                        </p>
                      </div>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`shrink-0 text-[#6F6B80] transition-transform ${expanded ? "rotate-180" : ""}`}
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>
                    <RowMenu
                      label={`Actions for ${u.username}`}
                      items={[
                        {
                          label: "View profile",
                          onClick: () =>
                            window.open(
                              `/profile/${encodeURIComponent(u.username)}`,
                              "_blank",
                              "noopener,noreferrer"
                            ),
                        },
                        {
                          label: expanded ? "Hide activity" : "View activity",
                          onClick: () => void toggleExpand(u),
                        },
                        ...(u.id === me
                          ? []
                          : [
                              {
                                label: u.is_banned ? "Unban user" : "Ban user",
                                onClick: () => requestBanToggle(u),
                              },
                              {
                                label: "Delete permanently",
                                onClick: () => requestPermanentDelete(u),
                              },
                            ]),
                      ]}
                    />
                  </div>

                  {expanded && (
                    <div className="border-t border-[#E6E3F0] p-3">
                      {detailLoading === u.id || !d ? (
                        <p className="text-sm text-[#6F6B80]">Loading details...</p>
                      ) : (
                        <>
                          <a
                            href={`/profile/${encodeURIComponent(u.username)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mb-3 inline-flex cursor-pointer items-center gap-1.5 rounded-full bg-[#4F46E5] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-[#4338CA]"
                          >
                            View full profile
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2.5}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                              <polyline points="15 3 21 3 21 9" />
                              <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                          </a>
                          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                            <div>
                              <dt className="text-xs font-medium text-[#6F6B80]">Bio</dt>
                              <dd className="font-medium text-[#211D33]">{u.bio || "—"}</dd>
                            </div>
                            <div>
                              <dt className="text-xs font-medium text-[#6F6B80]">Account</dt>
                              <dd className="font-medium text-[#211D33]">
                                {u.is_private ? "Private" : "Public"}
                              </dd>
                            </div>
                            <div>
                              <dt className="text-xs font-medium text-[#6F6B80]">Followers</dt>
                              <dd className="font-medium text-[#211D33]">{d.followers}</dd>
                            </div>
                            <div>
                              <dt className="text-xs font-medium text-[#6F6B80]">Following</dt>
                              <dd className="font-medium text-[#211D33]">{d.following}</dd>
                            </div>
                            <div>
                              <dt className="text-xs font-medium text-[#6F6B80]">Posts</dt>
                              <dd className="font-medium text-[#211D33]">{postCounts[u.id] ?? 0}</dd>
                            </div>
                            <div>
                              <dt className="text-xs font-medium text-[#6F6B80]">Joined</dt>
                              <dd className="font-medium text-[#211D33]">{timeAgo(u.created_at)}</dd>
                            </div>
                            <div>
                              <dt className="text-xs font-medium text-[#6F6B80]">Last active</dt>
                              <dd className="font-medium text-[#211D33]">
                                {u.last_active_at ? timeAgo(u.last_active_at) : "Never"}
                              </dd>
                            </div>
                          </dl>
                          <p className="mt-3 text-sm font-bold text-[#211D33]">
                            Recent posts
                          </p>
                          {d.posts.length === 0 ? (
                            <p className="mt-1 text-sm text-[#6F6B80]">No posts yet.</p>
                          ) : (
                            <ul className="mt-1.5 flex flex-col gap-1.5">
                              {d.posts.map((p) => (
                                <li
                                  key={p.id}
                                  className="rounded-lg bg-[#F5F4FA] p-2 text-sm ring-1 ring-[#E6E3F0]"
                                >
                                  <span className="text-[#211D33]">
                                    {p.content ? (
                                      <span className="line-clamp-2">{p.content}</span>
                                    ) : (
                                      <span className="italic text-[#6F6B80]">(photo post)</span>
                                    )}
                                  </span>
                                  {p.is_anonymous && <AnonymousBadge />}
                                  <span className="ml-1.5 text-xs text-[#6F6B80]">
                                    · {timeAgo(p.created_at)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
            {users.length === 0 && (
              <p className="text-sm text-[#6F6B80]">No users found.</p>
            )}
          </ul>
          <Pager
            page={userPage}
            totalPages={query.trim() === "" ? userTotalPages : null}
            disableNext={users.length < USERS_PAGE_SIZE}
            summary={
              query.trim() === ""
                ? `${stats ? stats.users : "…"} users total`
                : `${users.length} result${users.length === 1 ? "" : "s"}`
            }
            onPrev={() => setUserPage((v) => Math.max(0, v - 1))}
            onNext={() => setUserPage((v) => v + 1)}
          />
        </section>
      )}

      {/* ================= FEEDBACK ================= */}
      {activeTab === "feedback" && (
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#E6E3F0]">
          <SectionTitle
            title="Feedback"
            subtitle="User feedback and suggestions will appear here."
            right={
              feedbackReady && feedback.length > 0 ? (
                <p className="shrink-0 text-xs font-medium text-[#6F6B80]">
                  {feedback.filter((f) => f.status === "open").length} open ·{" "}
                  {feedback.length} total
                </p>
              ) : undefined
            }
          />
          {!feedbackReady ? (
            <p className="mt-2 text-sm text-[#6F6B80]">
              Feedback is not enabled yet. Run feedback.sql in Supabase SQL
              Editor, then refresh.
            </p>
          ) : feedback.length === 0 ? (
            <p className="mt-2 text-sm text-[#6F6B80]">
              No feedback yet. When users report a problem, it lands here.
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-3">
              {feedback.map((f) => {
                const meta = FEEDBACK_CATEGORY_META[f.category] ?? FEEDBACK_CATEGORY_META.other;
                return (
                  <li
                    key={f.id}
                    className="rounded-xl bg-[#F5F4FA] p-3 ring-1 ring-[#E6E3F0]"
                  >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <AvatarThumb
                        url={f.user?.avatar_url ?? null}
                        name={f.user?.full_name || f.user?.username || "?"}
                        size="h-8 w-8"
                        text="text-xs"
                      />
                      <span className="text-sm font-bold text-[#211D33]">
                        {f.user?.full_name || (f.user ? `@${f.user.username}` : "Someone")}
                      </span>
                      <span className={`rounded px-1.5 py-0.5 text-xs font-bold ${meta.badge}`}>
                        {meta.label}
                      </span>
                      {f.status === "resolved" ? (
                        <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-bold text-green-700">
                          Resolved
                        </span>
                      ) : (
                        <span className="rounded bg-[#EEF2FF] px-1.5 py-0.5 text-xs font-bold text-[#4F46E5]">
                          Open
                        </span>
                      )}
                      <span className="text-xs text-[#6F6B80]">
                        · {timeAgo(f.created_at)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-[#211D33]">
                      {f.message}
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <MiniButton
                        label={f.status === "open" ? "Mark resolved" : "Reopen"}
                        tone={f.status === "open" ? "primary" : "neutral"}
                        busy={busyId === f.id}
                        onClick={() =>
                          void setFeedbackStatus(
                            f.id,
                            f.status === "open" ? "resolved" : "open"
                          )
                        }
                      />
                      <MiniButton
                        label="Delete"
                        tone="neutral"
                        busy={busyId === f.id}
                        onClick={() => requestDeleteFeedback(f.id)}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* ================= ACTIVITY ================= */}
      {activeTab === "activity" && (
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-[#E6E3F0]">
          <SectionTitle title="Activity" />
          {!activityReady ? (
            <p className="mt-2 text-sm text-[#6F6B80]">Loading...</p>
          ) : !activity ? (
            <p className="mt-2 text-sm text-[#6F6B80]">
              Activity tracking is not enabled yet. Run the latest
              security_lock.sql in Supabase SQL Editor, then refresh.
            </p>
          ) : (
            <>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <StatCard label="Active today" value={String(activity.today)} />
                <StatCard label="Active this week" value={String(activity.week)} />
                <StatCard label="Active this month" value={String(activity.month)} />
              </div>
              <p className="mt-4 text-sm font-bold text-[#211D33]">
                Last active by day
              </p>
              <div className="mt-2 flex h-36 items-end gap-2">
                {activity.buckets.map((b, i) => (
                  <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                    <span className="text-xs font-bold text-[#211D33]">{b.count}</span>
                    <div
                      className="w-full rounded-t-md bg-[#4F46E5] transition-all"
                      style={{
                        height: `${Math.max(b.count > 0 ? 3 : 0, (b.count / chartMax) * 70)}%`,
                      }}
                    />
                    <span className="text-[10px] font-medium text-[#6F6B80]">
                      {b.label}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* Post details modal (from the Posts tab ⋮ menu) */}
      {postDetail && (
        <ChowkModal
          open
          onClose={() => setPostDetail(null)}
          title="Post details"
          subtitle={`Posted ${timeAgo(postDetail.created_at)}`}
          size="md"
          footer={
            <>
              <ChowkModalButton tone="neutral" onClick={() => setPostDetail(null)}>
                Close
              </ChowkModalButton>
              <ChowkModalButton
                tone="dark"
                onClick={() => {
                  const id = postDetail.id;
                  setPostDetail(null);
                  requestDeletePost(id);
                }}
              >
                Delete post
              </ChowkModalButton>
            </>
          }
        >
          <div className="flex items-center gap-3">
            <AvatarThumb
              url={postDetail.author?.avatar_url ?? null}
              name={
                postDetail.author?.full_name || postDetail.author?.username || "?"
              }
            />
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#211D33]">
                {postDetail.author?.full_name ||
                  (postDetail.author
                    ? `@${postDetail.author.username}`
                    : "Someone")}
                {postDetail.is_anonymous && <AnonymousBadge />}
              </p>
              {postDetail.author && (
                <p className="text-xs text-[#4F46E5]">@{postDetail.author.username}</p>
              )}
            </div>
          </div>
          {postDetail.content ? (
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#211D33]">
              {postDetail.content}
            </p>
          ) : (
            <p className="mt-3 text-sm italic text-[#6F6B80]">(photo post)</p>
          )}
          {(reportedByPost.get(postDetail.id) ?? []).length > 0 && (
            <div className="mt-4 rounded-xl bg-[#F5F4FA] p-3 ring-1 ring-[#E6E3F0]">
              <p className="text-sm font-bold text-[#211D33]">
                {reportedByPost.get(postDetail.id)!.length}{" "}
                {reportedByPost.get(postDetail.id)!.length === 1
                  ? "report"
                  : "reports"}{" "}
                on this post
              </p>
              <ul className="mt-2 flex flex-col gap-2">
                {reportedByPost.get(postDetail.id)!.map((r) => (
                  <li key={r.id} className="text-sm text-[#6F6B80]">
                    <span className="font-bold text-[#211D33]">
                      {r.reporter?.full_name || r.reporter?.username || "Someone"}
                    </span>
                    {r.reason ? `: ${r.reason}` : ""}{" "}
                    <span className="text-xs">· {timeAgo(r.created_at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </ChowkModal>
      )}

      {/* Shared confirmation dialog for all destructive/moderation actions. */}
      {confirm && (
        <ChowkModal
          open
          onClose={() => setConfirm(null)}
          title={confirm.title}
          subtitle={confirm.body}
          size="sm"
          footer={
            <>
              <ChowkModalButton tone="neutral" onClick={() => setConfirm(null)}>
                Cancel
              </ChowkModalButton>
              <ChowkModalButton
                tone={confirm.tone}
                onClick={confirm.run}
                disabled={!!confirm.requireCheck && !confirmChecked}
              >
                {confirm.confirmLabel}
              </ChowkModalButton>
            </>
          }
        >
          {confirm.requireCheck && (
            <label className="flex cursor-pointer items-start gap-2.5 text-sm text-[#211D33]">
              <input
                type="checkbox"
                checked={confirmChecked}
                onChange={(e) => setConfirmChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#4F46E5]"
              />
              <span className="font-medium">{confirm.requireCheck}</span>
            </label>
          )}
        </ChowkModal>
      )}
    </main>
  );
}
