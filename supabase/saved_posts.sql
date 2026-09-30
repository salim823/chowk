-- Chowk: saved posts table
-- Run this once in Supabase Dashboard → SQL Editor → New query → Run

create table if not exists saved_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  post_id uuid not null references posts(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_id, post_id)
);

alter table saved_posts enable row level security;

drop policy if exists "Users manage own saved posts" on saved_posts;
create policy "Users manage own saved posts" on saved_posts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
