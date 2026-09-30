-- Username change cooldown (run once in Supabase SQL editor).
-- Tracks the last time a user changed their username so the app can
-- enforce one change per 3 days. The app keeps working if this is not
-- run yet; the cooldown is simply not enforced until then.
alter table public.profiles
  add column if not exists username_changed_at timestamptz;
