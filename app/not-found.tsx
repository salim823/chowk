"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Branded 404 page. Shown for any URL that doesn't match a route, so users
 * always see Chowk's own screen instead of the default Next.js error page.
 */
export default function NotFound() {
  const router = useRouter();

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-[#F5F4FA] px-4">
      <div className="flex w-full max-w-sm flex-col items-center rounded-2xl bg-white px-6 py-10 text-center shadow-sm">
        <Image
          src="/logo.webp"
          alt="Chowk"
          width={56}
          height={56}
          className="h-14 w-14 rounded-2xl object-cover"
          priority
        />
        <p className="mt-5 text-5xl font-extrabold tracking-tight text-[#211D33]">
          404
        </p>
        <h1 className="mt-2 text-xl font-bold text-[#211D33]">Page not found</h1>
        <p className="mt-2 text-sm leading-6 text-[#6F6B80]">
          The link you followed may be broken, or the page may have been
          removed.
        </p>
        <div className="mt-6 flex w-full flex-col gap-2.5">
          <Link
            href="/"
            className="flex h-11 w-full cursor-pointer items-center justify-center rounded-xl bg-[#4F46E5] text-sm font-semibold text-white transition-colors hover:bg-[#4338CA] active:bg-[#3730A3]"
          >
            Go home
          </Link>
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-11 w-full cursor-pointer items-center justify-center rounded-xl bg-[#F5F4FA] text-sm font-semibold text-[#211D33] transition-colors hover:bg-[#e4e6e9] active:bg-[#d8dadf]"
          >
            Go back
          </button>
        </div>
      </div>
    </main>
  );
}
