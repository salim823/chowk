"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when both Supabase env vars are present. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

let browserClient: SupabaseClient | undefined;

/**
 * Returns a singleton browser Supabase client.
 * Returns `undefined` (and warns once) when the env vars are not set,
 * so pages can render a "not configured" state instead of crashing.
 */
export function getSupabaseClient(): SupabaseClient | undefined {
  if (!isSupabaseConfigured) {
    console.warn(
      "[chowk] Supabase is not configured. Copy .env.local.example to .env.local " +
        "and set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
    return undefined;
  }
  if (!browserClient) {
    browserClient = createBrowserClient(supabaseUrl!, supabaseAnonKey!);
  }
  return browserClient;
}
