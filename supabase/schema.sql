-- Shadow Reading, v1 tables. Paste into Supabase: SQL Editor, New query, Run.
-- One user, no login yet. The policies below let the anon key read and write
-- everything. Anyone holding the project URL and anon key could do the same.
-- Tighten this when auth is added.

create table if not exists passages (
  id text primary key,
  title text not null,
  text text not null,
  chapters jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- Small key/value store: which passage is current, and the settings.
create table if not exists app_state (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists progress (
  passage_id text primary key references passages(id) on delete cascade,
  sentence_index integer not null default 0,
  mode text not null default 'flow',
  updated_at timestamptz not null default now()
);

create table if not exists sessions (
  id text primary key,
  passage_id text not null,
  passage_title text not null,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  mode text not null,
  minutes numeric not null default 0,
  back_taps integer not null default 0,
  forward_taps integer not null default 0,
  restarts integer not null default 0
);

alter table passages enable row level security;
alter table app_state enable row level security;
alter table progress enable row level security;
alter table sessions enable row level security;

drop policy if exists "anon all" on passages;
drop policy if exists "anon all" on app_state;
drop policy if exists "anon all" on progress;
drop policy if exists "anon all" on sessions;

create policy "anon all" on passages for all to anon using (true) with check (true);
create policy "anon all" on app_state for all to anon using (true) with check (true);
create policy "anon all" on progress for all to anon using (true) with check (true);
create policy "anon all" on sessions for all to anon using (true) with check (true);

-- Added 2026-10-17 for the library home page. Safe to run again.
alter table passages add column if not exists sentence_count integer not null default 0;
-- Run once in the SQL Editor. Adds cover images, book/article kind, author, and library folders.
alter table passages add column if not exists kind text not null default 'article';
alter table passages add column if not exists author text;
alter table passages add column if not exists cover text;
alter table passages add column if not exists folder text;
-- Run once in the SQL Editor. Public bucket for generated voice audio.
-- Anyone can read a file if they know its name; only the function writes.
insert into storage.buckets (id, name, public)
values ('tts', 'tts', true)
on conflict (id) do nothing;

drop policy if exists "tts public read" on storage.objects;
create policy "tts public read" on storage.objects for select to anon, authenticated using (bucket_id = 'tts');
