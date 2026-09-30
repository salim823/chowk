-- Chowk MVP schema: profiles, posts, reactions, comments, friendships, notifications, announcements, reports

-- PROFILES (linked to auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  full_name text,
  gali text,
  avatar_url text,
  is_private boolean default false,
  is_admin boolean default false,
  created_at timestamptz default now()
);

-- POSTS
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  content text,
  image_urls text[] default '{}',
  is_anonymous boolean default false,
  audience text default 'everyone' check (audience in ('everyone','friends')),
  created_at timestamptz default now()
);

-- REACTIONS (one per user per post; changing reaction = update row)
create table if not exists reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  emoji text not null,
  created_at timestamptz default now(),
  unique(post_id, user_id)
);

-- COMMENTS
create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);

-- FRIENDSHIPS
create table if not exists friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references profiles(id) on delete cascade not null,
  addressee_id uuid references profiles(id) on delete cascade not null,
  status text default 'pending' check (status in ('pending','accepted','blocked')),
  created_at timestamptz default now(),
  unique(requester_id, addressee_id)
);

-- NOTIFICATIONS
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  type text not null,
  title text not null,
  post_id uuid references posts(id) on delete cascade,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- ANNOUNCEMENTS (mohalla alerts, pinned on top)
create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  content text,
  is_pinned boolean default true,
  created_at timestamptz default now()
);

-- REPORTS
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references profiles(id) on delete cascade not null,
  post_id uuid references posts(id) on delete cascade,
  reported_user_id uuid references profiles(id) on delete cascade,
  reason text,
  created_at timestamptz default now()
);

-- STORAGE BUCKETS (public: post images + avatars)
insert into storage.buckets (id, name, public)
values ('post-images', 'post-images', true), ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- ROW LEVEL SECURITY: permissive MVP policies (authenticated users can read/write; tighten later)
alter table profiles enable row level security;
alter table posts enable row level security;
alter table reactions enable row level security;
alter table comments enable row level security;
alter table friendships enable row level security;
alter table notifications enable row level security;
alter table announcements enable row level security;
alter table reports enable row level security;

create policy "public read" on profiles for select using (true);
create policy "users manage own profile" on profiles for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "public read" on posts for select using (true);
create policy "auth write posts" on posts for insert with check (auth.uid() = user_id);
create policy "auth update own posts" on posts for update using (auth.uid() = user_id);
create policy "auth delete own posts" on posts for delete using (auth.uid() = user_id);

create policy "public read" on reactions for select using (true);
create policy "auth manage reactions" on reactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "public read" on comments for select using (true);
create policy "auth manage comments" on comments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "auth read friendships" on friendships for select using (true);
create policy "auth manage friendships" on friendships for all using (auth.uid() = requester_id or auth.uid() = addressee_id) with check (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "users read own notifications" on notifications for select using (auth.uid() = user_id);
create policy "auth create notifications" on notifications for insert with check (true);
create policy "users update own notifications" on notifications for update using (auth.uid() = user_id);

create policy "public read" on announcements for select using (true);
create policy "auth write announcements" on announcements for all using (true) with check (true);

create policy "auth create reports" on reports for insert with check (auth.uid() = reporter_id);
create policy "auth read reports" on reports for select using (true);

-- STORAGE policies (public read, authenticated upload)
create policy "public read images" on storage.objects for select using (bucket_id in ('post-images','avatars'));
create policy "auth upload images" on storage.objects for insert with check (bucket_id in ('post-images','avatars') and auth.role() = 'authenticated');
create policy "auth delete own images" on storage.objects for delete using (bucket_id in ('post-images','avatars') and auth.role() = 'authenticated');
