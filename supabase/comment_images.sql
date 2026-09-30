-- ============================================================================
-- Chowk comment photos — adds comments.image_url (nullable text).
-- Run once in Supabase Dashboard → SQL Editor → New query → Run.
-- Idempotent: safe to re-run.
--
-- What it does:
--  - Adds public.comments.image_url so a comment can carry one photo.
--
-- Why no other changes are needed:
--  - Storage: comment photos are uploaded to the post-images bucket under
--    <uid>/comments/<file>. The existing "chowk storage insert" policy
--    already allows any path starting with "<uid>/%", so uploads work.
--  - RLS: the existing "chowk comments insert" policy
--    (auth.uid() = user_id, not banned, post exists) is column-agnostic,
--    so inserting image_url needs no policy change.
--  - Cleanup: delete_my_account() already wipes storage.objects rows whose
--    name starts with "<uid>/%", which covers "<uid>/comments/...".
--    Comment rows themselves are deleted by that function too.
-- ============================================================================

alter table public.comments
  add column if not exists image_url text;

-- deploy trigger
