-- Run once in the SQL Editor. Adds cover images, book/article kind, author, and library folders.
alter table passages add column if not exists kind text not null default 'article';
alter table passages add column if not exists author text;
alter table passages add column if not exists cover text;
alter table passages add column if not exists folder text;
