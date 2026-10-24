-- Run once in the SQL Editor. Adds the sentence count used by the home page progress bar.
alter table passages add column if not exists sentence_count integer not null default 0;
