-- Chowk: "Who can comment" per post (everyone | friends)
-- Run once in Supabase Dashboard → SQL Editor → New query → Run

alter table posts
  add column if not exists comment_audience text not null default 'everyone';
