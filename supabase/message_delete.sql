-- ============================================================================
-- Chowk chat: allow users to delete their own messages.
-- Run once in Supabase Dashboard → SQL Editor → New query → Run.
-- Idempotent: safe to re-run.
-- ============================================================================

-- Users may delete only messages they sent themselves.
drop policy if exists "chowk messages delete own" on public.messages;
create policy "chowk messages delete own"
  on public.messages for delete
  to authenticated
  using (sender_id = auth.uid());

-- The original messaging.sql granted select/insert/update; add delete.
grant delete on public.messages to authenticated;
