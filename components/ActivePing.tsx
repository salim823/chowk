"use client";

import { useEffect } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

const KEY = "chowk-last-active-ping";
const HOUR_MS = 60 * 60 * 1000;

/**
 * Activity heartbeat. Marks the logged-in user's profiles.last_active_at at
 * most once per hour (tracked in localStorage). Fire-and-forget: it never
 * blocks rendering and all errors are swallowed.
 */
export function ActivePing() {
  useEffect(() => {
    let cancelled = false;
    try {
      const last = Number(localStorage.getItem(KEY) || 0);
      if (Date.now() - last < HOUR_MS) return;
    } catch {
      return;
    }
    (async () => {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) return;
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        await supabase
          .from("profiles")
          .update({ last_active_at: new Date().toISOString() })
          .eq("id", user.id);
        try {
          localStorage.setItem(KEY, String(Date.now()));
        } catch {
          // Storage is optional.
        }
      } catch {
        // Best-effort only.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
