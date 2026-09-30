"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";

type GateState =
  | "checking"
  | "ok"
  | "banned"
  | "deactivated"
  | "deactivated_expired"
  | "deleted";

const REACTIVATE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

interface StatusFlags {
  is_banned?: boolean;
  is_deactivated?: boolean;
  deactivated_at?: string | null;
  is_deleted?: boolean;
}

/**
 * App-side enforcement for banned / deactivated / deleted users. These
 * accounts see a notice instead of the app (with a way to log out, and a
 * Reactivate button while inside the 7-day deactivation window). The
 * database additionally hides their posts and refuses their new content
 * via RLS policies.
 */
export function BannedGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<GateState>("checking");
  const [reactivating, setReactivating] = useState(false);
  const [reactivateError, setReactivateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        if (!cancelled) setState("ok");
        return;
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) {
        if (!cancelled) setState("ok");
        return;
      }
      // Resilient: if account_status.sql was never run, these columns do
      // not exist, the select fails, and we treat the account as fine.
      const { data } = await supabase
        .from("profiles")
        .select("is_banned, is_deactivated, deactivated_at, is_deleted")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      const flags = (data ?? {}) as StatusFlags;
      if (flags.is_banned === true) {
        setState("banned");
      } else if (flags.is_deleted === true) {
        setState("deleted");
      } else if (flags.is_deactivated === true) {
        const at = flags.deactivated_at ? new Date(flags.deactivated_at).getTime() : 0;
        setState(
          at > 0 && Date.now() - at < REACTIVATE_WINDOW_MS
            ? "deactivated"
            : "deactivated_expired"
        );
      } else {
        setState("ok");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    const supabase = getSupabaseClient();
    if (supabase) await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  async function handleReactivate() {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setReactivating(true);
    setReactivateError(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setReactivateError("Your session expired. Please log in again.");
        return;
      }
      const { error } = await supabase
        .from("profiles")
        .update({ is_deactivated: false, deactivated_at: null })
        .eq("id", user.id);
      if (error) {
        setReactivateError("Could not reactivate. Please try again.");
        return;
      }
      window.location.assign("/feed");
    } finally {
      setReactivating(false);
    }
  }

  if (state === "ok" || state === "checking") {
    // While checking, render children (avoids a flash for normal users).
    return <>{children}</>;
  }

  const copy: Record<
    Exclude<GateState, "checking" | "ok">,
    { title: string; body: string }
  > = {
    banned: {
      title: "Account suspended",
      body: "Your Chowk account has been suspended for breaking community rules. If you think this is a mistake, please contact the Chowk admin.",
    },
    deactivated: {
      title: "Account deactivated",
      body: "You deactivated your Chowk account. You can reactivate it within 7 days of deactivation — after that it cannot be restored.",
    },
    deactivated_expired: {
      title: "Deactivation period ended",
      body: "The 7-day reactivation window for your account has passed and it can no longer be restored. If you think this is a mistake, please contact support.",
    },
    deleted: {
      title: "Account permanently deleted",
      body: "This Chowk account was permanently deleted and cannot be restored. You are welcome to create a brand new account.",
    },
  };

  const { title, body } = copy[state];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-4">
      <div className="w-full rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-neutral-200">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </span>
        <h1 className="mt-4 text-xl font-bold text-[#211D33]">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#6F6B80]">{body}</p>
        {state === "deactivated" && (
          <>
            {reactivateError && (
              <p className="mt-3 text-sm font-medium text-red-600">
                {reactivateError}
              </p>
            )}
            <button
              type="button"
              onClick={handleReactivate}
              disabled={reactivating}
              className="mt-6 w-full cursor-pointer rounded-xl bg-[#4F46E5] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#4338CA] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {reactivating ? "Reactivating..." : "Reactivate my account"}
            </button>
          </>
        )}
        {state === "deactivated_expired" && (
          <a
            href="https://mail.google.com/mail/?view=cm&fs=1&to=contactnowmuhammadharis@gmail.com"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 block w-full cursor-pointer rounded-xl bg-[#E6E3F0] px-4 py-2.5 text-sm font-bold text-[#211D33] transition-colors hover:bg-neutral-300"
          >
            Contact support
          </a>
        )}
        {state === "deleted" && (
          <button
            type="button"
            onClick={() => router.push("/signup")}
            className="mt-6 w-full cursor-pointer rounded-xl bg-[#4F46E5] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#4338CA]"
          >
            Create a new account
          </button>
        )}
        <button
          type="button"
          onClick={handleLogout}
          className="mt-3 w-full cursor-pointer rounded-xl bg-[#E6E3F0] px-4 py-2.5 text-sm font-bold text-[#211D33] transition-colors hover:bg-neutral-300"
        >
          Log out
        </button>
      </div>
    </main>
  );
}
