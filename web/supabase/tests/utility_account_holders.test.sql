-- "Whose name is each utility in?": members set and see holders; outsiders can't; bad input is refused.
set client_min_messages = warning;
insert into auth.users (id, email, raw_user_meta_data) values
  ('50000000-0000-0000-0000-00000000000a', 'own@example.com', '{"display_name":"Owner"}'),
  ('50000000-0000-0000-0000-00000000000b', 'out@example.com', '{"display_name":"Outsider"}');

create function pg_temp.expect_error(p_sql text, p_frag text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'EXPECTED ERROR "%" BUT SUCCEEDED: %', p_frag, p_sql;
exception when others then
  if sqlerrm like 'EXPECTED ERROR%' then raise; end if;
  if position(p_frag in sqlerrm) = 0 then raise exception 'expected "%" got "%" for %', p_frag, sqlerrm, p_sql; end if;
end $$;
create table pg_temp.ctx (k text primary key, v text);
grant all on pg_temp.ctx to authenticated;
grant execute on all functions in schema pg_temp to authenticated;

select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-00000000000a', false);
set role authenticated;
insert into pg_temp.ctx values ('space', create_space('Maple Apartment', 'shared_home')::text);
insert into pg_temp.ctx values ('me', my_member_id((select v::uuid from pg_temp.ctx where k = 'space'))::text);

-- A member can name themselves as the gas holder, with last 4 digits
select set_utility_holder((select v::uuid from pg_temp.ctx where k = 'space'), 'gas', (select v::uuid from pg_temp.ctx where k = 'me'), null, '4821');
do $$ begin
  assert (select count(*) from space_utility_holders) = 1, 'one holder saved';
  assert (select account_last4 from space_utility_holders where category = 'gas') = '4821', 'last4 saved';
end $$;

-- Changing it replaces the row and is logged
select set_utility_holder((select v::uuid from pg_temp.ctx where k = 'space'), 'gas', null, 'Landlord Sam', null);
do $$ begin
  assert (select count(*) from space_utility_holders) = 1, 'still one row for gas';
  assert (select holder_name from space_utility_holders where category = 'gas') = 'Landlord Sam', 'outside holder saved';
  assert (select holder_member_id from space_utility_holders where category = 'gas') is null, 'member cleared';
  assert (select count(*) from activity where action = 'utility_holder_set') = 2, 'both changes logged';
end $$;

-- Bad input is refused
select pg_temp.expect_error($$select set_utility_holder((select v::uuid from pg_temp.ctx where k = 'space'), 'gas', null, null, null)$$, 'bad_holder');
select pg_temp.expect_error($$select set_utility_holder((select v::uuid from pg_temp.ctx where k = 'space'), 'gas', (select v::uuid from pg_temp.ctx where k = 'me'), 'Also a name', null)$$, 'bad_holder');
select pg_temp.expect_error($$select set_utility_holder((select v::uuid from pg_temp.ctx where k = 'space'), 'gas', null, 'Sam', '12345678')$$, 'bad_last4');
select pg_temp.expect_error($$select set_utility_holder((select v::uuid from pg_temp.ctx where k = 'space'), 'rent', null, 'Sam', null)$$, 'bad_category');
select pg_temp.expect_error($$select set_utility_holder((select v::uuid from pg_temp.ctx where k = 'space'), 'gas', gen_random_uuid(), null, null)$$, 'holder_not_member');
-- Direct writes are not allowed
select pg_temp.expect_error($$insert into space_utility_holders (space_id, category, holder_name) values ((select v::uuid from pg_temp.ctx where k = 'space'), 'water', 'X')$$, 'permission denied');

-- Clearing works
select clear_utility_holder((select v::uuid from pg_temp.ctx where k = 'space'), 'gas');
do $$ begin assert (select count(*) from space_utility_holders) = 0, 'cleared'; end $$;

-- An outsider can't read or write
select set_utility_holder((select v::uuid from pg_temp.ctx where k = 'space'), 'electricity', null, 'Sam', null);
reset role;
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-00000000000b', false);
set role authenticated;
do $$ begin assert (select count(*) from space_utility_holders) = 0, 'outsider sees nothing'; end $$;
select pg_temp.expect_error($$select set_utility_holder((select v::uuid from pg_temp.ctx where k = 'space'), 'gas', null, 'Eve', null)$$, 'forbidden');
select pg_temp.expect_error($$select clear_utility_holder((select v::uuid from pg_temp.ctx where k = 'space'), 'electricity')$$, 'forbidden');
reset role;
