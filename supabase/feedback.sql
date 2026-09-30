-- ============================================================================
-- Chowk FEEDBACK — "Report a problem" / contact-the-admin inbox.
-- Run once in Supabase Dashboard → SQL Editor → New query → Run.
-- Idempotent: safe to re-run.
--
-- What it does:
--  - feedback table: user-submitted bug reports, suggestions, feedback.
--  - Users can INSERT and SELECT only their own rows.
--  - Admins (profiles.is_admin, via public.is_admin()) can SELECT all and
--    UPDATE/DELETE all — the admin panel inbox. No email is exposed.
-- ============================================================================

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  category text not null check (category in ('bug', 'feedback', 'suggestion', 'other')),
  message text not null check (char_length(message) > 0 and char_length(message) <= 1000),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

-- Drop old policies first so re-runs stay clean.
drop policy if exists "feedback_insert_own" on public.feedback;
drop policy if exists "feedback_select_own" on public.feedback;
drop policy if exists "feedback_admin_all" on public.feedback;
drop policy if exists "feedback_admin_delete" on public.feedback;

-- Any signed-in user can send feedback (their own row only).
create policy "feedback_insert_own"
  on public.feedback for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Users can read their own feedback.
create policy "feedback_select_own"
  on public.feedback for select
  to authenticated
  using (auth.uid() = user_id or public.is_admin());

-- Admins manage the whole inbox (resolve/reopen/delete).
create policy "feedback_admin_all"
  on public.feedback for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "feedback_admin_delete"
  on public.feedback for delete
  to authenticated
  using (public.is_admin());
