-- Chowk: let admins permanently delete any user account.
-- Run once in Supabase Dashboard → SQL Editor → New query → Run
-- (after account_status.sql).
--
-- The admin panel's "Delete permanently" user action calls this RPC.
-- It wipes the target's data exactly like the self-service
-- public.delete_my_account(), then scrubs the profile row into a
-- "Deleted User" tombstone (is_deleted = true) so the person can never
-- sign back in with the same login — BannedGate blocks deleted accounts.
-- The scrubbed row stays visible in the admin Users list with a "Deleted"
-- status badge, and the old username is retired (renamed to deleted_*).
--
-- If the target is ALREADY a tombstone, the profile row is purged
-- entirely (hard delete) so it disappears from the admin Users list.
-- Every FK to profiles is ON DELETE CASCADE, so nothing is stranded.
-- Note: purging removes the BannedGate block too (their Auth login still
-- exists), so only purge test accounts — leave real troublemakers as
-- tombstones.
--
-- Safety:
--   - Only callers with profiles.is_admin = true may run it.
--   - An admin cannot delete their own account through this function.
-- Storage files (avatars, post media) should be deleted client-side via the
-- Storage API BEFORE calling this RPC (best-effort); the function itself
-- must not touch storage.objects (Supabase blocks direct deletes there).

create or replace function public.admin_delete_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_is_admin boolean;
begin
  if v_me is null then
    raise exception 'Not signed in.';
  end if;

  select p.is_admin into v_is_admin
  from public.profiles p
  where p.id = v_me;

  if coalesce(v_is_admin, false) is not true then
    raise exception 'Admins only.';
  end if;

  if target_user_id = v_me then
    raise exception 'You cannot permanently delete your own admin account.';
  end if;

  if not exists (select 1 from public.profiles where id = target_user_id) then
    raise exception 'User not found.';
  end if;

  -- Already a tombstone? Purge the profile row entirely so the admin's
  -- Users list is clean. (Content was wiped on the first delete; FKs are
  -- all ON DELETE CASCADE.) Their Auth login survives, so this lifts the
  -- BannedGate block — only purge test accounts.
  if exists (
    select 1 from public.profiles
    where id = target_user_id and is_deleted is true
  ) then
    delete from public.profiles where id = target_user_id;
    return;
  end if;

  -- Messages sent by the user. (Guarded: messaging.sql may not be installed.)
  if to_regclass('public.messages') is not null then
    delete from public.messages where sender_id = target_user_id;
  end if;

  -- Conversation participations, then conversations left with nobody in them.
  if to_regclass('public.conversation_participants') is not null then
    delete from public.conversation_participants where user_id = target_user_id;
    delete from public.conversations c
    where not exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = c.id
    );
  end if;

  -- The user's posts (cascades: reactions/comments on them, notifications
  -- and reports linked to those posts).
  if to_regclass('public.posts') is not null then
    delete from public.posts where user_id = target_user_id;
  end if;

  -- The user's reactions / comments / comment likes on others' posts.
  if to_regclass('public.reactions') is not null then
    delete from public.reactions where user_id = target_user_id;
  end if;
  if to_regclass('public.comments') is not null then
    delete from public.comments where user_id = target_user_id;
  end if;
  if to_regclass('public.comment_likes') is not null then
    delete from public.comment_likes where user_id = target_user_id;
  end if;

  -- Social graph.
  if to_regclass('public.friendships') is not null then
    delete from public.friendships
    where requester_id = target_user_id or addressee_id = target_user_id;
  end if;
  if to_regclass('public.follows') is not null then
    delete from public.follows
    where follower_id = target_user_id or following_id = target_user_id;
  end if;
  if to_regclass('public.saved_posts') is not null then
    delete from public.saved_posts where user_id = target_user_id;
  end if;
  if to_regclass('public.hidden_posts') is not null then
    -- Rows where the target hid others' posts. (Rows where others hid the
    -- target's posts vanish automatically via ON DELETE CASCADE when the
    -- posts are deleted below.)
    delete from public.hidden_posts where user_id = target_user_id;
  end if;
  if to_regclass('public.notifications') is not null then
    delete from public.notifications where user_id = target_user_id;
  end if;

  -- Moderation + inbox rows touching the user.
  if to_regclass('public.reports') is not null then
    delete from public.reports
    where reporter_id = target_user_id or reported_user_id = target_user_id;
  end if;
  if to_regclass('public.feedback') is not null then
    delete from public.feedback where user_id = target_user_id;
  end if;
  if to_regclass('public.announcements') is not null then
    delete from public.announcements where user_id = target_user_id;
  end if;

  -- Scrub the profile into a "Deleted User" tombstone (same pattern as
  -- self-service delete_my_account). The row is KEPT (not deleted) so:
  --   1. The Auth identity stays linked to an is_deleted profile, so
  --      BannedGate keeps blocking sign-in — the person cannot just
  --      re-register with the same login.
  --   2. The admin Users list can still show the "Deleted" status badge.
  --   3. The old username is retired and can never be re-taken.
  update public.profiles
  set username = 'deleted_' || substr(target_user_id::text, 1, 8),
      full_name = 'Deleted User',
      avatar_url = null,
      cover_url = null,
      bio = null,
      gali = null,
      pinned_post_id = null,
      is_private = true,
      is_admin = false,
      is_banned = false,
      is_deactivated = false,
      deactivated_at = null,
      is_deleted = true
  where id = target_user_id;
end;
$$;

grant execute on function public.admin_delete_user(uuid) to authenticated;
