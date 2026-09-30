"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { Avatar } from "@/components/Avatar";
import type { ProfileLite } from "@/lib/types";

type SearchResult = ProfileLite & { id: string };

/** Find people by username or name. Accepts `?q=` from the desktop header. */
function SearchPageInner() {
  const searchParams = useSearchParams();
  const qParam = searchParams.get("q") ?? "";
  const [userId, setUserId] = useState<string | null>(null);
  const [query, setQuery] = useState(qParam);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Keep the input in sync with the `q` URL param (desktop header search).
  useEffect(() => {
    setQuery(qParam);
  }, [qParam]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!cancelled) setUserId(user?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced search as the user types.
  useEffect(() => {
    const term = query.trim().replace(/[%_,]/g, "");
    if (!term || !userId) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = window.setTimeout(async () => {
      const supabase = getSupabaseClient();
      if (!supabase) {
        setSearching(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("id, username, full_name, avatar_url")
        .or(`username.ilike.%${term}%,full_name.ilike.%${term}%`)
        .neq("id", userId)
        // Deleted accounts are tombstoned, never surfaced.
        .not("is_deleted", "is", true)
        .limit(20);
      setResults((data ?? []) as SearchResult[]);
      setSearching(false);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [query, userId]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-3 bg-[#F5F4FA] px-3 py-3 sm:px-4 lg:bg-transparent">
      <header className="px-1">
        <h1 className="text-xl font-bold text-[#211D33]">Search people</h1>
      </header>

      <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-neutral-200">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by username or name..."
          autoComplete="off"
          className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-base text-[#211D33] placeholder:text-neutral-400 focus:border-[#4F46E5] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/30"
        />
      </div>

      {searching ? (
        <p className="px-1 text-sm text-[#6F6B80]">Searching...</p>
      ) : query.trim() && results.length === 0 ? (
        <div className="rounded-2xl bg-white p-8 text-center ring-1 ring-neutral-200">
          <p className="text-sm font-medium text-[#211D33]">
            No people found.
          </p>
          <p className="mt-1 text-sm text-[#6F6B80]">
            Try a different name or username.
          </p>
        </div>
      ) : (
        results.length > 0 && (
          <ul className="flex flex-col gap-2">
            {results.map((r) => {
              const name = r.full_name || r.username;
              return (
                <li key={r.id}>
                  <Link
                    href={`/profile/${encodeURIComponent(r.username)}`}
                    className="flex cursor-pointer items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-neutral-200 transition-colors hover:ring-[#4F46E5]/60"
                  >
                    <Avatar name={name} avatarUrl={r.avatar_url ?? null} lazy />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#211D33]">
                        {name}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )
      )}
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchPageInner />
    </Suspense>
  );
}
