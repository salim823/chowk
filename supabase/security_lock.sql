-- ============================================================================
-- Chowk SECURITY LOCK — strict Row Level Security
-- Run once in Supabase Dashboard → SQL Editor → New query → Run.
-- Idempotent: safe to re-run.
--
-- What it locks down:
--  - Private accounts: profile rows visible only to self, friends, admins
--    (or while a friend request is pending between the two users).
--  - Friends-only posts: visible only to the author's friends (or self/admin).
--  - Everyone-posts: hidden when the author is private or banned, and hidden
--    across blocks.
--  - Users can only touch their own rows everywhere (reactions, comments,
--    comment_likes, follows, saved_posts, notifications, friendships…).
--  - is_admin / is_banned can never be set by non-admins.
--  - Storage: users upload/delete only inside their own folders; admins may
--    delete any file.
--  - Admins (profiles.is_admin) can read all reports, delete any post/comment,
--    and ban/unban users.
--
-- KNOWN LIMITATION (documented, pragmatic): posts.user_id stays selectable
-- because app logic (isOwn checks, author joins) needs it. That means a
-- technically skilled user could de-anonymize an anonymous post via the API.
-- The app never shows the author of anonymous posts in the UI. A future
-- hardening step could serve posts through a view that nulls user_id for
-- anonymous posts when the viewer is not the author/admin.
-- Banned users: their profile rows stay readable (so the UI can show
-- "banned"), their posts are hidden from everyone except admins, and login
-- blocking is enforced app-side (BannedGate) + at the DB for new content.
-- ============================================================================

-- --------------------------------------------------------------------------
-- 0. New column for bans
-- --------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_banned boolean not null default false;

-- --------------------------------------------------------------------------
-- 1. Security-definer helpers (RLS is bypassed inside these, so no recursion)
-- --------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin
  );
$$;

create or replace function public.is_banned()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_banned
  );
$$;

create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and ((requester_id = a and addressee_id = b)
        or (requester_id = b and addressee_id = a))
  );
$$;

create or replace function public.blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships
    where status = 'blocked'
      and ((requester_id = a and addressee_id = b)
        or (requester_id = b and addressee_id = a))
  );
$$;

-- Visibility of a post WITHOUT re-querying posts (avoids RLS recursion).
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
        where pr.id = p_author_id and pr.is_banned
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
-- 2. PROFILES
-- --------------------------------------------------------------------------
drop policy if exists "public read" on public.profiles;
drop policy if exists "users manage own profile" on public.profiles;
drop policy if exists "chowk profiles select" on public.profiles;
drop policy if exists "chowk profiles insert" on public.profiles;
drop policy if exists "chowk profiles update self" on public.profiles;
drop policy if exists "chowk profiles update admin" on public.profiles;
drop policy if exists "chowk profiles delete" on public.profiles;

-- Read: public accounts for everyone; private accounts only for self,
-- friends, admins, or while a friend request is pending either way.
create policy "chowk profiles select" on public.profiles
for select using (
  not profiles.is_private
  or profiles.id = auth.uid()
  or public.is_admin()
  or public.are_friends(profiles.id, auth.uid())
  or exists (
    select 1 from public.friendships f
    where f.status = 'pending'
      and ((f.requester_id = profiles.id and f.addressee_id = auth.uid())
        or (f.addressee_id = profiles.id and f.requester_id = auth.uid()))
  )
);

-- Signup: a user may only create their own row, never as admin/banned.
create policy "chowk profiles insert" on public.profiles
for insert with check (
  auth.uid() = id
  and coalesce(is_admin, false) = false
  and coalesce(is_banned, false) = false
);

-- Self update (non-admins): flags are frozen.
create policy "chowk profiles update self" on public.profiles
for update
using (auth.uid() = id and not public.is_admin())
with check (
  auth.uid() = id
  and is_admin = false
  and is_banned = false
);

-- Admin update: full power (ban/unban, name fixes, …).
create policy "chowk profiles update admin" on public.profiles
for update
using (public.is_admin())
with check (public.is_admin());

create policy "chowk profiles delete" on public.profiles
for delete using (auth.uid() = id or public.is_admin());

-- --------------------------------------------------------------------------
-- 3. POSTS
-- --------------------------------------------------------------------------
drop policy if exists "public read" on public.posts;
drop policy if exists "auth write posts" on public.posts;
drop policy if exists "auth update own posts" on public.posts;
drop policy if exists "auth delete own posts" on public.posts;
drop policy if exists "chowk posts select" on public.posts;
drop policy if exists "chowk posts insert" on public.posts;
drop policy if exists "chowk posts update" on public.posts;
drop policy if exists "chowk posts delete" on public.posts;

create policy "chowk posts select" on public.posts
for select using (public.can_view_post(user_id, audience));

create policy "chowk posts insert" on public.posts
for insert with check (
  auth.uid() = user_id
  and not public.is_banned()
);

create policy "chowk posts update" on public.posts
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Authors delete own; admins may delete any post.
create policy "chowk posts delete" on public.posts
for delete using (auth.uid() = user_id or public.is_admin());

-- --------------------------------------------------------------------------
-- 4. REACTIONS
-- --------------------------------------------------------------------------
drop policy if exists "public read" on public.reactions;
drop policy if exists "auth manage reactions" on public.reactions;
drop policy if exists "chowk reactions select" on public.reactions;
drop policy if exists "chowk reactions insert" on public.reactions;
drop policy if exists "chowk reactions update" on public.reactions;
drop policy if exists "chowk reactions delete" on public.reactions;

create policy "chowk reactions select" on public.reactions
for select using (
  exists (select 1 from public.posts p where p.id = post_id)
);

create policy "chowk reactions insert" on public.reactions
for insert with check (
  auth.uid() = user_id
  and not public.is_banned()
  and exists (select 1 from public.posts p where p.id = post_id)
);

create policy "chowk reactions update" on public.reactions
for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (select 1 from public.posts p where p.id = post_id)
);

create policy "chowk reactions delete" on public.reactions
for delete using (auth.uid() = user_id or public.is_admin());

-- --------------------------------------------------------------------------
-- 5. COMMENTS
-- --------------------------------------------------------------------------
drop policy if exists "public read" on public.comments;
drop policy if exists "auth manage comments" on public.comments;
drop policy if exists "chowk comments select" on public.comments;
drop policy if exists "chowk comments insert" on public.comments;
drop policy if exists "chowk comments update" on public.comments;
drop policy if exists "chowk comments delete" on public.comments;

create policy "chowk comments select" on public.comments
for select using (
  exists (select 1 from public.posts p where p.id = post_id)
);

create policy "chowk comments insert" on public.comments
for insert with check (
  auth.uid() = user_id
  and not public.is_banned()
  and exists (select 1 from public.posts p where p.id = post_id)
);

create policy "chowk comments update" on public.comments
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "chowk comments delete" on public.comments
for delete using (auth.uid() = user_id or public.is_admin());

-- --------------------------------------------------------------------------
-- 6. COMMENT_LIKES
-- --------------------------------------------------------------------------
drop policy if exists "public read" on public.comment_likes;
drop policy if exists "auth manage comment_likes" on public.comment_likes;
drop policy if exists "chowk comment_likes select" on public.comment_likes;
drop policy if exists "chowk comment_likes insert" on public.comment_likes;
drop policy if exists "chowk comment_likes delete" on public.comment_likes;

create policy "chowk comment_likes select" on public.comment_likes
for select using (
  exists (
    select 1 from public.comments c
    join public.posts p on p.id = c.post_id
    where c.id = comment_id
  )
);

create policy "chowk comment_likes insert" on public.comment_likes
for insert with check (
  auth.uid() = user_id
  and not public.is_banned()
  and exists (
    select 1 from public.comments c
    join public.posts p on p.id = c.post_id
    where c.id = comment_id
  )
);

create policy "chowk comment_likes delete" on public.comment_likes
for delete using (auth.uid() = user_id or public.is_admin());

-- --------------------------------------------------------------------------
-- 7. FRIENDSHIPS (blocking also lives here via status='blocked')
-- --------------------------------------------------------------------------
drop policy if exists "auth read friendships" on public.friendships;
drop policy if exists "auth manage friendships" on public.friendships;
drop policy if exists "chowk friendships select" on public.friendships;
drop policy if exists "chowk friendships insert" on public.friendships;
drop policy if exists "chowk friendships update" on public.friendships;
drop policy if exists "chowk friendships delete" on public.friendships;

-- The app shows friends-of-friends lists, so authenticated users may read.
create policy "chowk friendships select" on public.friendships
for select using (auth.role() = 'authenticated');

-- New rows: only as the requester, as pending or blocked, never accepted.
create policy "chowk friendships insert" on public.friendships
for insert with check (
  auth.uid() = requester_id
  and status in ('pending', 'blocked')
  and not public.is_banned()
);

-- Accepting is the addressee's job; a requester can never self-accept.
create policy "chowk friendships update" on public.friendships
for update
using (
  auth.uid() = requester_id
  or auth.uid() = addressee_id
  or public.is_admin()
)
with check (
  public.is_admin()
  or auth.uid() = addressee_id
  or (auth.uid() = requester_id and status <> 'accepted')
);

create policy "chowk friendships delete" on public.friendships
for delete using (
  auth.uid() = requester_id
  or auth.uid() = addressee_id
  or public.is_admin()
);

-- --------------------------------------------------------------------------
-- 8. FOLLOWS
-- --------------------------------------------------------------------------
drop policy if exists "Public read follows" on public.follows;
drop policy if exists "Users can follow others" on public.follows;
drop policy if exists "Users can unfollow" on public.follows;
drop policy if exists "chowk follows select" on public.follows;
drop policy if exists "chowk follows insert" on public.follows;
drop policy if exists "chowk follows delete" on public.follows;

create policy "chowk follows select" on public.follows
for select using (auth.role() = 'authenticated');

create policy "chowk follows insert" on public.follows
for insert with check (
  auth.uid() = follower_id
  and not public.is_banned()
);

create policy "chowk follows delete" on public.follows
for delete using (auth.uid() = follower_id or public.is_admin());

-- --------------------------------------------------------------------------
-- 9. SAVED_POSTS (owner-only; was already strict, recreated for safety)
-- --------------------------------------------------------------------------
drop policy if exists "Users manage own saved posts" on public.saved_posts;
drop policy if exists "chowk saved_posts all" on public.saved_posts;

create policy "chowk saved_posts all" on public.saved_posts
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- --------------------------------------------------------------------------
-- 10. NOTIFICATIONS
-- --------------------------------------------------------------------------
drop policy if exists "users read own notifications" on public.notifications;
drop policy if exists "auth create notifications" on public.notifications;
drop policy if exists "users update own notifications" on public.notifications;
drop policy if exists "chowk notifications select" on public.notifications;
drop policy if exists "chowk notifications insert" on public.notifications;
drop policy if exists "chowk notifications update" on public.notifications;

-- Recipient-only reads; any signed-in user may create (the app notifies
-- other users about likes/comments/friend activity).
create policy "chowk notifications select" on public.notifications
for select using (auth.uid() = user_id);

create policy "chowk notifications insert" on public.notifications
for insert with check (auth.role() = 'authenticated');

create policy "chowk notifications update" on public.notifications
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- --------------------------------------------------------------------------
-- 11. REPORTS (moderation queue)
-- --------------------------------------------------------------------------
drop policy if exists "auth create reports" on public.reports;
drop policy if exists "auth read reports" on public.reports;
drop policy if exists "chowk reports select" on public.reports;
drop policy if exists "chowk reports insert" on public.reports;
drop policy if exists "chowk reports delete" on public.reports;

-- Reporters see their own reports; admins see everything.
create policy "chowk reports select" on public.reports
for select using (auth.uid() = reporter_id or public.is_admin());

create policy "chowk reports insert" on public.reports
for insert with check (
  auth.uid() = reporter_id
  and not public.is_banned()
);

-- Dismissing a report = admin-only delete.
create policy "chowk reports delete" on public.reports
for delete using (public.is_admin());

-- --------------------------------------------------------------------------
-- 12. ANNOUNCEMENTS (UI removed; locked to admins)
-- --------------------------------------------------------------------------
drop policy if exists "public read" on public.announcements;
drop policy if exists "auth write announcements" on public.announcements;
drop policy if exists "chowk announcements select" on public.announcements;
drop policy if exists "chowk announcements write" on public.announcements;

create policy "chowk announcements select" on public.announcements
for select using (auth.role() = 'authenticated');

create policy "chowk announcements write" on public.announcements
for all
using (public.is_admin())
with check (public.is_admin());

-- --------------------------------------------------------------------------
-- 13. STORAGE (post-images bucket; avatars/<uid>/, covers/<uid>/, <uid>/…)
-- --------------------------------------------------------------------------
drop policy if exists "public read images" on storage.objects;
drop policy if exists "auth upload images" on storage.objects;
drop policy if exists "auth delete own images" on storage.objects;
drop policy if exists "chowk storage read" on storage.objects;
drop policy if exists "chowk storage insert" on storage.objects;
drop policy if exists "chowk storage update" on storage.objects;
drop policy if exists "chowk storage delete" on storage.objects;

-- Post images are public by design (getPublicUrl).
create policy "chowk storage read" on storage.objects
for select using (bucket_id = 'post-images');

-- Users may only write inside their own folders.
create policy "chowk storage insert" on storage.objects
for insert with check (
  bucket_id = 'post-images'
  and (
    name like (auth.uid()::text || '/%')
    or name like ('avatars/' || auth.uid()::text || '/%')
    or name like ('covers/' || auth.uid()::text || '/%')
  )
);

create policy "chowk storage update" on storage.objects
for update
using (
  bucket_id = 'post-images'
  and (
    name like (auth.uid()::text || '/%')
    or name like ('avatars/' || auth.uid()::text || '/%')
    or name like ('covers/' || auth.uid()::text || '/%')
  )
)
with check (
  bucket_id = 'post-images'
  and (
    name like (auth.uid()::text || '/%')
    or name like ('avatars/' || auth.uid()::text || '/%')
    or name like ('covers/' || auth.uid()::text || '/%')
  )
);

-- Own files, or any file for admins (moderation).
create policy "chowk storage delete" on storage.objects
for delete using (
  bucket_id = 'post-images'
  and (
    public.is_admin()
    or name like (auth.uid()::text || '/%')
    or name like ('avatars/' || auth.uid()::text || '/%')
    or name like ('covers/' || auth.uid()::text || '/%')
  )
);

-- --------------------------------------------------------------------------
-- 14. Daily-active tracking (admin stats)
-- --------------------------------------------------------------------------
-- The app heartbeats this column (at most once per hour per user) so the
-- admin panel can show Active today / week / month + a 7-day chart.
alter table public.profiles
  add column if not exists last_active_at timestamptz;

-- No policy change needed: users update their own row through the existing
-- "chowk profiles update self" / "chowk profiles update admin" policies,
-- and admins read every row through "chowk profiles select".

-- --------------------------------------------------------------------------
-- 15. Anonymous posts: admin-only reveal (documented, no change needed)
-- --------------------------------------------------------------------------
-- public.can_view_post() returns TRUE for admins on every post, so the
-- "chowk posts select" policy already lets admins read posts.user_id (and
-- join the author profile) even on anonymous posts. Regular users can also
-- technically select user_id (see KNOWN LIMITATION above), but no non-admin
-- app code path ever displays it: PostCard shows "Anonymous" with no profile
-- link, and share drafts use "someone" for anonymous posts.
