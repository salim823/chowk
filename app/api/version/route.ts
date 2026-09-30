export const dynamic = "force-dynamic";

/**
 * Returns the currently deployed build version. The client polls this to
 * detect a new deployment and prompt the user to refresh — no manual
 * hard-refresh needed after we ship an update.
 */
export async function GET() {
  const v = process.env.VERCEL_GIT_COMMIT_SHA || "dev";
  return new Response(JSON.stringify({ v }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
