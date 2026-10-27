-- Quick Add / receipt AI limits and Google profile names (spec sections 19 and 21).
set client_min_messages = warning;

insert into auth.users (id, email, raw_user_meta_data) values
  ('30000000-0000-0000-0000-00000000000a', 'g@example.com', '{"full_name":"Grace Hopper","name":"Grace"}'),
  ('30000000-0000-0000-0000-00000000000b', 'n@example.com', '{"name":"Ned"}'),
  ('30000000-0000-0000-0000-00000000000c', 'plain@example.com', '{}');

do $$ begin
  assert (select display_name from profiles where id = '30000000-0000-0000-0000-00000000000a') = 'Grace Hopper', 'Google full_name is used';
  assert (select display_name from profiles where id = '30000000-0000-0000-0000-00000000000b') = 'Ned', 'Google name is the fallback';
  assert (select display_name from profiles where id = '30000000-0000-0000-0000-00000000000c') = 'plain', 'email prefix is the last resort';
end $$;

create function pg_temp.expect_error(p_sql text, p_frag text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'EXPECTED ERROR "%" BUT SUCCEEDED: %', p_frag, p_sql;
exception when others then
  if sqlerrm like 'EXPECTED ERROR%' then raise; end if;
  if position(p_frag in sqlerrm) = 0 then raise exception 'expected "%" got "%" for %', p_frag, sqlerrm, p_sql; end if;
end $$;
grant execute on all functions in schema pg_temp to authenticated;

select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-00000000000a', false);
set role authenticated;
select pg_temp.expect_error($$select begin_ai_request('anything')$$, 'bad_kind');
select begin_ai_request('quick_add') from generate_series(1, 30);
select pg_temp.expect_error($$select begin_ai_request('quick_add')$$, 'rate_limited');
-- Separate budgets: receipts and Splitwise imports are unaffected.
select begin_ai_request('receipt');
select begin_ai_request('email');
select begin_extraction(2);
reset role;

do $$ begin
  assert (select count(*) from extraction_requests where user_id = '30000000-0000-0000-0000-00000000000a' and kind = 'quick_add') = 30;
  assert (select count(*) from extraction_requests where user_id = '30000000-0000-0000-0000-00000000000a' and kind = 'import') = 1;
  assert (select count(*) from extraction_requests where user_id = '30000000-0000-0000-0000-00000000000a' and kind = 'email') = 1, 'bill emails have their own budget';
end $$;

select set_config('request.jwt.claim.sub', '', false);
set role anon;
select pg_temp.expect_error($$select begin_ai_request('quick_add')$$, 'not_authenticated');
reset role;
select 'ai request tests: ok';
