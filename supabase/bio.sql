-- Chowk: profile bio
-- Run once in Supabase Dashboard → SQL Editor → New query → Run

alter table profiles add column if not exists bio text;
