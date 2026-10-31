-- Run once in the Supabase SQL Editor, as the default postgres role.
-- The transaction rolls back the entire migration if any statement fails.
begin;

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120 and title = btrim(title)),
  description text not null check (char_length(description) between 1 and 2000 and description = btrim(description)),
  author_nickname text not null check (char_length(author_nickname) between 1 and 50 and author_nickname = btrim(author_nickname)),
  created_at timestamptz not null default now()
);

create table public.votes (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references public.ideas(id) on delete cascade,
  voter_id uuid not null,
  created_at timestamptz not null default now(),
  constraint votes_idea_voter_unique unique (idea_id, voter_id)
);
-- The unique constraint also indexes idea_id for vote counting and FK lookups.
create index ideas_created_at_idx on public.ideas (created_at desc, id);

alter table public.ideas enable row level security;
alter table public.votes enable row level security;

-- Supabase may grant table access by default. Remove it explicitly.
revoke all on table public.ideas, public.votes from public, anon, authenticated;
grant select on table public.ideas to anon;
create policy ideas_public_read on public.ideas
  for select to anon using (true);
-- No direct write policies; votes have no public read policies either.

-- Only these narrowly scoped RPCs can write. They run as their owner and
-- intentionally bypass table RLS. Fix search_path and qualify all objects.
create function public.submit_idea(
  p_title text, p_description text, p_author_nickname text
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  insert into public.ideas (title, description, author_nickname)
  values (btrim(p_title), btrim(p_description), btrim(p_author_nickname))
  returning id into new_id;
  return new_id;
end;
$$;

create function public.cast_vote(p_idea_id uuid, p_voter_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  inserted_rows integer;
begin
  insert into public.votes (idea_id, voter_id)
  values (p_idea_id, p_voter_id)
  on conflict on constraint votes_idea_voter_unique do nothing;
  get diagnostics inserted_rows = row_count;
  return inserted_rows = 1;
end;
$$;

-- Expose aggregate counts, never voter identifiers or raw vote rows.
create function public.list_ideas()
returns table (
  id uuid,
  title text,
  description text,
  author_nickname text,
  created_at timestamptz,
  vote_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.title, i.description, i.author_nickname, i.created_at,
    (select count(*) from public.votes v where v.idea_id = i.id) as vote_count
  from public.ideas i
  order by i.created_at desc, i.id;
$$;

-- PostgreSQL otherwise grants function EXECUTE to PUBLIC by default.
revoke all on function public.submit_idea(text, text, text) from public, anon, authenticated;
revoke all on function public.cast_vote(uuid, uuid) from public, anon, authenticated;
revoke all on function public.list_ideas() from public, anon, authenticated;
grant usage on schema public to anon;
grant execute on function public.submit_idea(text, text, text) to anon;
grant execute on function public.cast_vote(uuid, uuid) to anon;
grant execute on function public.list_ideas() to anon;

commit;
