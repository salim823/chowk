-- ============================================================================
-- Chowk: 1-on-1 in-app messaging (Messenger-style, text only)
-- RUN THIS in Supabase SQL editor (once). Safe to re-run: every statement is
-- idempotent (IF NOT EXISTS / CREATE OR REPLACE / DROP IF EXISTS).
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Tables
-- --------------------------------------------------------------------------
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  last_message_at timestamptz default now()
);

create table if not exists public.conversation_participants (
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamptz default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  body text not null check (char_length(body) > 0 and char_length(body) <= 2000),
  created_at timestamptz default now(),
  read_at timestamptz
);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);
create index if not exists messages_unread_idx
  on public.messages (conversation_id, sender_id)
  where read_at is null;
create index if not exists conversation_participants_user_idx
  on public.conversation_participants (user_id);

-- --------------------------------------------------------------------------
-- 2. Helper: is the caller a participant of this conversation?
-- SECURITY DEFINER avoids RLS recursion when policies query the same table.
-- --------------------------------------------------------------------------
create or replace function public.is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation_id
      and user_id = auth.uid()
  );
$$;

-- --------------------------------------------------------------------------
-- 3. Keep conversations.last_message_at fresh on every new message.
-- --------------------------------------------------------------------------
create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation_on_message();

-- --------------------------------------------------------------------------
-- 4. get_or_create_conversation: find or create the 1-on-1 conversation.
-- Refuses when either side blocked the other, or when messaging yourself.
-- --------------------------------------------------------------------------
create or replace function public.get_or_create_conversation(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  conv_id uuid;
begin
  if me is null then
    raise exception 'Not authenticated';
  end if;
  if other_user_id = me then
    raise exception 'Cannot message yourself';
  end if;
  if not exists (select 1 from public.profiles where id = other_user_id) then
    raise exception 'User not found';
  end if;
  if public.blocked_between(me, other_user_id) then
    raise exception 'Messaging is not available with this user';
  end if;

  -- Existing 1-on-1: exactly these two participants, no third party.
  select cp1.conversation_id into conv_id
  from public.conversation_participants cp1
  join public.conversation_participants cp2
    on cp2.conversation_id = cp1.conversation_id
  where cp1.user_id = me
    and cp2.user_id = other_user_id
    and not exists (
      select 1 from public.conversation_participants cp3
      where cp3.conversation_id = cp1.conversation_id
        and cp3.user_id not in (me, other_user_id)
    )
  limit 1;

  if conv_id is null then
    insert into public.conversations default values
    returning id into conv_id;
    insert into public.conversation_participants (conversation_id, user_id)
    values (conv_id, me), (conv_id, other_user_id);
  end if;

  return conv_id;
end;
$$;

-- --------------------------------------------------------------------------
-- 5. RLS
-- --------------------------------------------------------------------------
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

-- Conversations: participants can read their own. Rows are only created by
-- get_or_create_conversation() (SECURITY DEFINER), so no direct INSERT policy.
drop policy if exists "chowk conversations select own" on public.conversations;
create policy "chowk conversations select own"
  on public.conversations for select
  to authenticated
  using (public.is_conversation_participant(id));

-- Participants: you can see the participant rows of conversations you are in
-- (needed to resolve the "other" person). Rows created by the RPC only.
drop policy if exists "chowk participants select own convos" on public.conversation_participants;
create policy "chowk participants select own convos"
  on public.conversation_participants for select
  to authenticated
  using (public.is_conversation_participant(conversation_id));

-- Messages: participants read; participants send as themselves; recipients
-- may only mark messages read (enforced by trigger below).
drop policy if exists "chowk messages select own" on public.messages;
create policy "chowk messages select own"
  on public.messages for select
  to authenticated
  using (public.is_conversation_participant(conversation_id));

drop policy if exists "chowk messages insert own" on public.messages;
create policy "chowk messages insert own"
  on public.messages for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_conversation_participant(conversation_id)
  );

drop policy if exists "chowk messages mark read" on public.messages;
create policy "chowk messages mark read"
  on public.messages for update
  to authenticated
  using (
    public.is_conversation_participant(conversation_id)
    and sender_id <> auth.uid()
  )
  with check (
    public.is_conversation_participant(conversation_id)
    and sender_id <> auth.uid()
  );

-- Only read_at may change on update (body / sender / conversation immutable).
create or replace function public.enforce_message_read_at_only()
returns trigger
language plpgsql
as $$
begin
  if new.id <> old.id
     or new.conversation_id <> old.conversation_id
     or new.sender_id <> old.sender_id
     or new.body <> old.body
     or new.created_at <> old.created_at then
    raise exception 'Only read_at may be updated on messages';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_read_at_only on public.messages;
create trigger messages_read_at_only
  before update on public.messages
  for each row execute function public.enforce_message_read_at_only();

-- No direct deletes from the app.
-- (Admins moderate via the existing admin tooling; nothing to add here.)

-- --------------------------------------------------------------------------
-- 6. Grants + realtime
-- --------------------------------------------------------------------------
grant select on public.conversations to authenticated;
grant select on public.conversation_participants to authenticated;
grant select, insert, update on public.messages to authenticated;
grant execute on function public.is_conversation_participant(uuid) to authenticated;
grant execute on function public.get_or_create_conversation(uuid) to authenticated;

-- Realtime for live chat (idempotent: only add when missing).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'conversations'
  ) then
    alter publication supabase_realtime add table public.conversations;
  end if;
end $$;
