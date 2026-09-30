"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";

/** Signs the user out and sends them back to the login screen. */
export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    setBusy(true);
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={busy}
      className="w-full cursor-pointer rounded-xl px-6 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-200 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? "Logging out..." : "Log out"}
    </button>
  );
}
