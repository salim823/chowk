-- Chowk: let users delete their own notifications.
-- Run this once in Supabase SQL Editor (after security_lock.sql).
-- The delete button on the Notifications page needs this policy;
-- without it, deletes are silently blocked by RLS.

drop policy if exists "chowk notifications delete" on public.notifications;

create policy "chowk notifications delete" on public.notifications
for delete using (auth.uid() = user_id);
