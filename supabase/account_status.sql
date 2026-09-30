-- ============================================================================
-- Chowk ACCOUNT STATUS — Deactivate (7-day reversible) + permanent Delete.
-- Run once in Supabase Dashboard → SQL Editor → New query → Run.
-- Idempotent: safe to re-run.
--
-- IMPORTANT: run AFTER supabase/security_lock.sql. This file replaces
-- public.can_view_post() with an extended version (deactivated/deleted
-- authors' posts are hidden) and tightens several INSERT policies. Do not
-- re-run security_lock.sql afterwards or it will revert those changes.
-- If you run supabase/messaging.sql AFTER this file, re-run this file too:
-- messaging.sql recreates the messages INSERT policy without the
-- deactivation guard, and this file re-applies it.
--
-- What it does:
--  - profiles.is_deactivated / deactivated_at / is_deleted columns.
--  - Deactivated/deleted users' posts are hidden from everyone (admins
--    still see everything, authors still see their own rows).
--  - Deactivated/deleted users cannot write: posts, reactions, comments,
--    comment_likes, friendships, follows, reports, feedback, messages.
--  - New conversations with a deactivated/deleted account are refused
--    (trigger on conversation_participants), and messages to them are
--    refused (messages INSERT policy).
--  - public.delete_my_account(): SECURITY DEFINER wipe used by the
--    "Delete account" button. Removes the user's messages, conversations
--    left empty, posts, reactions, comments, comment_likes, friendships,
--    follows, saved posts, notifications, reports, feedback, announcements
--    and storage files, then scrubs the profile row and marks is_deleted.
--    The auth.users row is intentionally KEPT so the login screen can show
--    "This account was permanently deleted". The email (username@chowk.app)
--    stays taken: a deleted user must register with a new username.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 0. Columns
-- --------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_deactivated boolean not null default false,
  add column if not exists deactivated_at timestamptz,
  add column if not exists is_deleted boolean not null default false;

-- --------------------------------------------------------------------------
-- 1. Helper: is the signed-in user deactivated or deleted?
-- --------------------------------------------------------------------------
create or replace function public.is_deactivated_or_deleted()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and (is_deactivated or is_deleted)
  );
$$;

-- --------------------------------------------------------------------------
-- 2. Hide deactivated/deleted authors' posts (replaces security_lock version)
-- --------------------------------------------------------------------------
create or replace function public.can_view_post(p_author_id uuid, p_audience text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_author_id = auth.uid()
    or public.is_admin()
    or (
      not exists (
        select 1 from public.profiles pr
        where pr.id = p_author_id
          and (pr.is_banned or pr.is_deactivated or pr.is_deleted)
      )
      and not public.blocked_between(p_author_id, auth.uid())
      and (
        public.are_friends(p_author_id, auth.uid())
        or (
          p_audience = 'everyone'
          and not exists (
            select 1 from public.profiles pr
            where pr.id = p_author_id and pr.is_private
          )
        )
      )
    );
$$;

-- --------------------------------------------------------------------------
-- 3. Hide deactivated/deleted users' reactions / comments / comment likes
--    (RESTRICTIVE policies: they only further restrict, never widen.)
-- --------------------------------------------------------------------------
drop policy if exists "chowk hide disabled reactions" on public.reactions;
create policy "chowk hide disabled reactions" on public.reactions
as restrictive for select
using (
  public.is_admin()
  or not exists (
    select 1 from public.profiles pr
    where pr.id = reactions.user_id
      and (pr.is_deactivated or pr.is_deleted)
  )
);

drop policy if exists "chowk hide disabled comments" on public.comments;
create policy "chowk hide disabled comments" on public.comments
as restrictive for select
using (
  public.is_admin()
  or not exists (
    select 1 from public.profiles pr
    where pr.id = comments.user_id
      and (pr.is_deactivated or pr.is_deleted)
  )
);

drop policy if exists "chowk hide disabled comment_likes" on public.comment_likes;
create policy "chowk hide disabled comment_likes" on public.comment_likes
as restrictive for select
using (
  public.is_admin()
  or not exists (
    select 1 from public.profiles pr
    where pr.id = comment_likes.user_id
      and (pr.is_deactivated or pr.is_deleted)
  )
);

-- --------------------------------------------------------------------------
-- 4. Write guards: deactivated/deleted users cannot create content.
--    (Recreate the security_lock INSERT policies with the extra condition.)
-- --------------------------------------------------------------------------
drop policy if exists "chowk posts insert" on public.posts;
create policy "chowk posts insert" on public.posts
for insert with check (
  auth.uid() = user_id
  and not public.is_banned()
  and not public.is_deactivated_or_deleted()
);

drop policy if exists "chowk reactions insert" on public.reactions;
create policy "chowk reactions insert" on public.reactions
for insert with check (
  auth.uid() = user_id
  and not public.is_banned()
  and not public.is_deactivated_or_deleted()
  and exists (select 1 from public.posts p where p.id = post_id)
);

drop policy if exists "chowk comments insert" on public.comments;
create policy "chowk comments insert" on public.comments
for insert with check (
  auth.uid() = user_id
  and not public.is_banned()
  and not public.is_deactivated_or_deleted()
  and exists (select 1 from public.posts p where p.id = post_id)
);

drop policy if exists "chowk comment_likes insert" on public.comment_likes;
create policy "chowk comment_likes insert" on public.comment_likes
for insert with check (
  auth.uid() = user_id
  and not public.is_banned()
  and not public.is_deactivated_or_deleted()
  and exists (
    select 1 from public.comments c
    join public.posts p on p.id = c.post_id
    where c.id = comment_id
  )
);

drop policy if exists "chowk friendships insert" on public.friendships;
create policy "chowk friendships insert" on public.friendships
for insert with check (
  auth.uid() = requester_id
  and status in ('pending', 'blocked')
  and not public.is_banned()
  and not public.is_deactivated_or_deleted()
);

drop policy if exists "chowk follows insert" on public.follows;
create policy "chowk follows insert" on public.follows
for insert with check (
  auth.uid() = follower_id
  and not public.is_banned()
  and not public.is_deactivated_or_deleted()
);

drop policy if exists "chowk reports insert" on public.reports;
create policy "chowk reports insert" on public.reports
for insert with check (
  auth.uid() = reporter_id
  and not public.is_banned()
  and not public.is_deactivated_or_deleted()
);

drop policy if exists "feedback_insert_own" on public.feedback;
create policy "feedback_insert_own"
  on public.feedback for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and not public.is_deactivated_or_deleted()
  );

-- Messages: sender must be active AND every other participant must be active
-- (so a deactivated account cannot be messaged). Conditional: messaging.sql
-- may not have been run yet when this file runs.
do $$
begin
  if to_regclass('public.messages') is not null then
    drop policy if exists "chowk messages insert own" on public.messages;
    create policy "chowk messages insert own"
      on public.messages for insert
      to authenticated
      with check (
        sender_id = auth.uid()
        and public.is_conversation_participant(conversation_id)
        and not public.is_deactivated_or_deleted()
        and not exists (
          select 1
          from public.conversation_participants cp
          join public.profiles p on p.id = cp.user_id
          where cp.conversation_id = messages.conversation_id
            and cp.user_id <> auth.uid()
            and (p.is_deactivated or p.is_deleted)
        )
      );
  end if;
end
$$;

-- Refuse to add a deactivated/deleted user to any conversation (covers
-- get_or_create_conversation() which inserts participant rows directly).
-- Conditional for the same reason as above.
create or replace function public.block_deactivated_participant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.profiles p
    where p.id = NEW.user_id and (p.is_deactivated or p.is_deleted)
  ) then
    raise exception 'Cannot message a deactivated account.';
  end if;
  return NEW;
end;
$$;

do $$
begin
  if to_regclass('public.conversation_participants') is not null then
    drop trigger if exists trg_block_deactivated_participant
      on public.conversation_participants;
    create trigger trg_block_deactivated_participant
      before insert on public.conversation_participants
      for each row execute function public.block_deactivated_participant();
  end if;
end
$$;

-- --------------------------------------------------------------------------
-- 5. delete_my_account(): permanent wipe for the "Delete account" button.
-- --------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not signed in.';
  end if;

  -- Messages sent by the user. (Guarded: messaging.sql may not be installed.)
  if to_regclass('public.messages') is not null then
    delete from public.messages where sender_id = v_uid;
  end if;

  -- Conversation participations, then conversations left with nobody in them.
  if to_regclass('public.conversation_participants') is not null then
    delete from public.conversation_participants where user_id = v_uid;
    delete from public.conversations c
    where not exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = c.id
    );
  end if;

  -- The user's posts (cascades: reactions/comments on them, notifications
  -- and reports linked to those posts).
  -- Every table below is guarded with to_regclass: if a feature's table was
  -- removed/renamed (e.g. announcements), the wipe must not fail entirely.
  if to_regclass('public.posts') is not null then
    delete from public.posts where user_id = v_uid;
  end if;

  -- The user's reactions / comments / comment likes on others' posts.
  if to_regclass('public.reactions') is not null then
    delete from public.reactions where user_id = v_uid;
  end if;
  if to_regclass('public.comments') is not null then
    delete from public.comments where user_id = v_uid;
  end if;
  if to_regclass('public.comment_likes') is not null then
    delete from public.comment_likes where user_id = v_uid;
  end if;

  -- Social graph.
  if to_regclass('public.friendships') is not null then
    delete from public.friendships
    where requester_id = v_uid or addressee_id = v_uid;
  end if;
  if to_regclass('public.follows') is not null then
    delete from public.follows
    where follower_id = v_uid or following_id = v_uid;
  end if;
  if to_regclass('public.saved_posts') is not null then
    delete from public.saved_posts where user_id = v_uid;
  end if;
  if to_regclass('public.notifications') is not null then
    delete from public.notifications where user_id = v_uid;
  end if;

  -- Moderation + inbox rows touching the user.
  if to_regclass('public.reports') is not null then
    delete from public.reports
    where reporter_id = v_uid or reported_user_id = v_uid;
  end if;
  if to_regclass('public.feedback') is not null then
    delete from public.feedback where user_id = v_uid;
  end if;
  if to_regclass('public.announcements') is not null then
    delete from public.announcements where user_id = v_uid;
  end if;

  -- Storage files (avatars, covers, post images/videos) are deleted
  -- client-side via the Storage API BEFORE this RPC is called.
  -- (Supabase blocks direct DELETE on storage.objects with
  -- "Direct deletion from storage tables is not allowed", so the
  -- function must not touch storage.objects itself.)

  -- Scrub the profile row (kept so the login screen can show the
  -- "permanently deleted" notice and the old username stays reserved).
  update public.profiles
  set username = 'deleted_' || substr(v_uid::text, 1, 8),
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
  where id = v_uid;
end;
$$;

grant execute on function public.delete_my_account() to authenticated;
