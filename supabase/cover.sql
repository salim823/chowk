-- Chowk: profile cover photos
-- Run once in Supabase Dashboard → SQL Editor → New query → Run

alter table profiles add column if not exists cover_url text;
