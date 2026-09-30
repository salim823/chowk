-- Chowk: make yourself admin (for announcements)
-- Run once in Supabase Dashboard → SQL Editor → New query → Run

update profiles set is_admin = true where username = 'travelwithharis';
