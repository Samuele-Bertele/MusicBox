-- =============================================================================
-- musicbox — PostgreSQL schema for Supabase (free tier)
--
-- Run this once in the Supabase SQL editor. Every table is owned by a single
-- user and protected by Row Level Security: even with the public anon key, a
-- session can only ever read and write its own rows.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- profiles --
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Listener',
  created_at   timestamptz not null default now()
);

-- Catalogue metadata cache. Only fields the provider allows us to store.
create table if not exists public.tracks (
  user_id    uuid not null references auth.users (id) on delete cascade,
  id         text not null,
  payload    jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

-- --------------------------------------------------------------- playlists --
create table if not exists public.playlists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 80),
  description text not null default '' check (char_length(description) <= 300),
  cover       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.playlist_tracks (
  playlist_id uuid not null references public.playlists (id) on delete cascade,
  track_id    text not null,
  user_id     uuid not null references auth.users (id) on delete cascade,
  position    integer not null default 0,
  added_at    timestamptz not null default now(),
  primary key (playlist_id, track_id),
  foreign key (user_id, track_id) references public.tracks (user_id, id) on delete cascade
);

-- ------------------------------------------------------- likes and follows --
create table if not exists public.liked_tracks (
  user_id  uuid not null references auth.users (id) on delete cascade,
  track_id text not null,
  liked_at timestamptz not null default now(),
  primary key (user_id, track_id),
  foreign key (user_id, track_id) references public.tracks (user_id, id) on delete cascade
);

create table if not exists public.followed_artists (
  user_id     uuid not null references auth.users (id) on delete cascade,
  artist_id   text not null,
  payload     jsonb not null,
  followed_at timestamptz not null default now(),
  primary key (user_id, artist_id)
);

create table if not exists public.saved_albums (
  user_id  uuid not null references auth.users (id) on delete cascade,
  album_id text not null,
  payload  jsonb not null,
  saved_at timestamptz not null default now(),
  primary key (user_id, album_id)
);

-- ----------------------------------------------------------------- history --
create table if not exists public.listening_history (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  track_id         text not null,
  event_type       text not null check (event_type in ('play_started','p25','p50','p75','completed','skipped')),
  listened_seconds integer not null default 0 check (listened_seconds >= 0),
  percent          integer not null default 0 check (percent between 0 and 100),
  created_at       timestamptz not null default now(),
  foreign key (user_id, track_id) references public.tracks (user_id, id) on delete cascade
);

create table if not exists public.search_history (
  user_id     uuid not null references auth.users (id) on delete cascade,
  query       text not null check (char_length(query) between 1 and 80),
  searched_at timestamptz not null default now(),
  primary key (user_id, query)
);

create table if not exists public.user_settings (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  settings   jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------- indexes --
create index if not exists playlists_user_updated_idx        on public.playlists (user_id, updated_at desc);
create index if not exists playlist_tracks_playlist_pos_idx  on public.playlist_tracks (playlist_id, position);
create index if not exists liked_tracks_user_time_idx        on public.liked_tracks (user_id, liked_at desc);
create index if not exists followed_artists_user_time_idx    on public.followed_artists (user_id, followed_at desc);
create index if not exists saved_albums_user_time_idx        on public.saved_albums (user_id, saved_at desc);
create index if not exists history_user_time_idx             on public.listening_history (user_id, created_at desc);
create index if not exists history_user_track_idx            on public.listening_history (user_id, track_id);
create index if not exists search_history_user_time_idx      on public.search_history (user_id, searched_at desc);

-- ------------------------------------------------------------------- RLS ----
alter table public.profiles          enable row level security;
alter table public.tracks            enable row level security;
alter table public.playlists         enable row level security;
alter table public.playlist_tracks   enable row level security;
alter table public.liked_tracks      enable row level security;
alter table public.followed_artists  enable row level security;
alter table public.saved_albums      enable row level security;
alter table public.listening_history enable row level security;
alter table public.search_history    enable row level security;
alter table public.user_settings     enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

do $$
declare t text;
begin
  foreach t in array array[
    'tracks','playlists','playlist_tracks','liked_tracks','followed_artists',
    'saved_albums','listening_history','search_history','user_settings'
  ] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
      t
    );
  end loop;
end $$;

-- --------------------------------------------------------------- triggers ---
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1), 'Listener'))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keeps the free tier comfortable: trims a user's history to the newest 20k rows.
create or replace function public.trim_listening_history()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.listening_history h
  where h.id in (
    select id from (
      select id, row_number() over (partition by user_id order by created_at desc) as rn
      from public.listening_history
    ) ranked
    where ranked.rn > 20000
  );
$$;
