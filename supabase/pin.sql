-- Chowk: pin a post to the top of your profile
-- Run once in Supabase Dashboard → SQL Editor → New query → Run

alter table profiles
  add column if not exists pinned_post_id uuid references posts(id) on delete set null;
