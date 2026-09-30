"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";

export default function Home() {
  const router = useRouter();
  // Landing is hidden until we know the visitor is logged out, so logged-in
  // users never see it flash before the redirect to the feed.
  const [showLanding, setShowLanding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseClient();
      const { data } = supabase
        ? await supabase.auth.getSession()
        : { data: { session: null } };
      if (cancelled) return;
      if (data.session?.user) {
        // Already logged in: go straight to the feed.
        router.replace("/feed");
        return;
      }
      setShowLanding(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!showLanding) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-white">
        <div
          className="h-10 w-10 animate-spin rounded-full border-4 border-[#4F46E5] border-t-transparent"
          role="status"
          aria-label="Loading"
        />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
      <div className="max-w-md">
        <div className="mx-auto mb-6 w-fit overflow-hidden rounded-3xl shadow-sm">
          <Image
            src="/logo.webp"
            alt="Chowk logo"
            width={80}
            height={80}
            className="h-20 w-20 object-cover"
            priority
          />
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-[#211D33]">
          Chowk
        </h1>
        <p className="mt-2 text-lg font-medium text-[#4F46E5]">
          Apna College, Apni App
        </p>
        <p className="mt-4 text-sm leading-6 text-[#6F6B80]">
          Your campus, online. Share updates and photos
          with your classmates.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/signup"
            className="cursor-pointer rounded-xl bg-[#4F46E5] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#4338CA]"
          >
            Create account
          </Link>
          <Link
            href="/login"
            className="cursor-pointer rounded-xl px-6 py-3 text-sm font-semibold text-[#4338CA] ring-1 ring-blue-700 transition-colors hover:bg-blue-50"
          >
            Log in
          </Link>
        </div>
        <Link
          href="/feed"
          className="mt-6 inline-block cursor-pointer text-sm text-neutral-500 underline transition-colors hover:text-[#211D33]"
        >
          Preview the feed
        </Link>
      </div>
    </main>
  );
}
