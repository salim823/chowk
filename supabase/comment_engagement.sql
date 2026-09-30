-- Chowk: comment engagement (replies + comment likes).
-- Run this in the Supabase SQL Editor (Dashboard > SQL > New query).
-- Until it is run, the app hides Reply and comment-Like buttons gracefully.

-- 1. Replies: a comment can target another comment (one level deep).
alter table comments
  add column if not exists parent_id uuid references comments(id) on delete cascade;

-- 2. Comment likes: one like per user per comment.
create table if not exists comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid references comments(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(comment_id, user_id)
);

alter table comment_likes enable row level security;

drop policy if exists "public read" on comment_likes;
create policy "public read" on comment_likes for select using (true);

drop policy if exists "auth manage comment_likes" on comment_likes;
create policy "auth manage comment_likes" on comment_likes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
