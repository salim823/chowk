import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * NOTE (Next.js 16): the `middleware` file convention was deprecated and
 * renamed to `proxy`. This file must export a function named `proxy`
 * (or a default export). Behavior is identical to the old middleware.
 *
 * Runs before routes render: refreshes the Supabase session cookie and
 * enforces auth redirects for the app's protected/auth routes.
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Graceful pass-through when Supabase is not configured yet.
  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  // Route groups like (main) do not appear in the URL; match real paths.
  const isMainRoute =
    pathname === "/feed" ||
    pathname.startsWith("/feed/") ||
    pathname === "/profile" ||
    pathname.startsWith("/profile/") ||
    pathname === "/search" ||
    pathname.startsWith("/search/") ||
    pathname === "/notifications" ||
    pathname.startsWith("/notifications/") ||
    pathname === "/complete-profile";
  const isAuthRoute = pathname === "/login" || pathname === "/signup";

  // Not logged in -> protected pages bounce to /login.
  if (!user && isMainRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // Already logged in -> /login and /signup bounce to /feed.
  if (user && isAuthRoute) {
    const feedUrl = request.nextUrl.clone();
    feedUrl.pathname = "/feed";
    return NextResponse.redirect(feedUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/feed/:path*",
    "/profile/:path*",
    "/search/:path*",
    "/notifications/:path*",
    "/complete-profile",
    "/login",
    "/signup",
  ],
};
