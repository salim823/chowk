-- Chowk: per-user post hiding ("Hide this post for me", 7 days).
-- Run once in Supabase Dashboard → SQL Editor → New query → Run.
--
-- The X button on someone else's post inserts a row here with
-- hidden_until = now() + 7 days. Feed/explore queries exclude posts the
-- viewer hid where hidden_until is still in the future, so the post
-- automatically becomes visible again after 7 days. Nothing is deleted
-- from the posts table; other users are unaffected.

create table if not exists public.hidden_posts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  hidden_until timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

alter table public.hidden_posts enable row level security;

drop policy if exists "Users manage own hidden posts" on public.hidden_posts;
create policy "Users manage own hidden posts" on public.hidden_posts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Optional: keep the table tidy. Expired rows are ignored by the app
-- (it only hides where hidden_until > now()), so no cron is required.
