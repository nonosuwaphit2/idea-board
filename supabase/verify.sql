-- Run separately AFTER the migration. Everything here is rolled back.
begin;
set local role anon;

do $$
declare
  test_idea uuid;
  test_voter uuid := gen_random_uuid();
  total_votes bigint;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.ideas'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.votes'::regclass) then
    raise exception 'RLS is not enabled';
  end if;

  test_idea := public.submit_idea('Schema check', 'Temporary verification idea', 'Setup check');
  if public.cast_vote(test_idea, test_voter) is distinct from true then
    raise exception 'First vote failed';
  end if;
  if public.cast_vote(test_idea, test_voter) is distinct from false then
    raise exception 'Duplicate vote was accepted';
  end if;
  select vote_count into total_votes from public.list_ideas() where id = test_idea;
  if total_votes is distinct from 1::bigint then
    raise exception 'Expected exactly one vote, got %', total_votes;
  end if;

  if has_table_privilege(current_user, 'public.votes', 'SELECT')
     or has_table_privilege(current_user, 'public.votes', 'INSERT')
     or has_table_privilege(current_user, 'public.ideas', 'INSERT')
     or has_table_privilege(current_user, 'public.ideas', 'UPDATE')
     or has_table_privilege(current_user, 'public.ideas', 'DELETE')
     or has_table_privilege(current_user, 'public.votes', 'UPDATE')
     or has_table_privilege(current_user, 'public.votes', 'DELETE') then
    raise exception 'Unexpected direct table privileges';
  end if;
  raise notice 'PASS: RLS enabled, idea submission, vote counting, duplicate prevention, and restricted table access';
end;
$$;

rollback;
