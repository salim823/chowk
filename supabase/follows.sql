-- Chowk: follows / fan-following table
-- Run this once in Supabase Dashboard → SQL Editor → New query → Run

create table if not exists follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references profiles(id) on delete cascade,
  following_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(follower_id, following_id),
  check (follower_id <> following_id)
);

alter table follows enable row level security;

drop policy if exists "Public read follows" on follows;
create policy "Public read follows" on follows for select using (true);

drop policy if exists "Users can follow others" on follows;
create policy "Users can follow others" on follows for insert with check (auth.uid() = follower_id);

drop policy if exists "Users can unfollow" on follows;
create policy "Users can unfollow" on follows for delete using (auth.uid() = follower_id);
