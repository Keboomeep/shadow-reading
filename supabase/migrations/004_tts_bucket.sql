-- Run once in the SQL Editor. Public bucket for generated voice audio.
-- Anyone can read a file if they know its name; only the function writes.
insert into storage.buckets (id, name, public)
values ('tts', 'tts', true)
on conflict (id) do nothing;

drop policy if exists "tts public read" on storage.objects;
create policy "tts public read" on storage.objects for select to anon, authenticated using (bucket_id = 'tts');
