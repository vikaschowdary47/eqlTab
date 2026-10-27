-- "Who sends your bills?" (spec 17.2 / 21.4): members set their Space's companies; outsiders can't read or write.
set client_min_messages = warning;
insert into auth.users (id, email, raw_user_meta_data) values
  ('40000000-0000-0000-0000-00000000000a', 'own@example.com', '{"display_name":"Owner"}'),
  ('40000000-0000-0000-0000-00000000000b', 'out@example.com', '{"display_name":"Outsider"}');

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

select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-00000000000a', false);
set role authenticated;
insert into pg_temp.ctx values ('space', create_space('Maple Apartment', 'shared_home')::text);
select set_bill_sources((select v::uuid from pg_temp.ctx where k = 'space'), 'IL',
  '[{"category":"electricity","providerId":"comed","name":"ComEd","keywords":["comed"]},{"category":"gas","providerId":"peoples-gas","name":"Peoples Gas","keywords":["peoples gas","peoplesgasdelivery"]}]');
do $$ begin
  assert (select jsonb_array_length(sources) from space_bill_sources) = 2, 'member saved two companies';
end $$;
-- Saving again replaces the list
select set_bill_sources((select v::uuid from pg_temp.ctx where k = 'space'), 'IL', '[{"category":"internet","providerId":"xfinity","name":"Xfinity","keywords":["xfinity"]}]');
do $$ begin assert (select sources->0->>'name' from space_bill_sources) = 'Xfinity'; end $$;
select set_bill_sources((select v::uuid from pg_temp.ctx where k = 'space'), 'IL', '[{"category":"other","providerId":null,"name":"Public Grid Team","keywords":["support@onepublicgrid.com"]}]');
do $$ begin assert (select sources->0->>'category' from space_bill_sources) = 'other', 'senders from Gmail are allowed'; end $$;
select pg_temp.expect_error($$select set_bill_sources((select v::uuid from pg_temp.ctx where k = 'space'), 'IL', '[{"category":"water","name":"x","keywords":["x"]}]')$$, 'bad_sources');
select pg_temp.expect_error($$select set_bill_sources((select v::uuid from pg_temp.ctx where k = 'space'), 'IL', '[{"category":"gas","name":"","keywords":["x"]}]')$$, 'bad_sources');
select pg_temp.expect_error($$insert into space_bill_sources (space_id, state) values ((select v::uuid from pg_temp.ctx where k = 'space'), 'IL')$$, 'permission denied');
reset role;

select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-00000000000b', false);
set role authenticated;
do $$ begin assert (select count(*) from space_bill_sources) = 0, 'outsiders cannot read'; end $$;
select pg_temp.expect_error($$select set_bill_sources((select v::uuid from pg_temp.ctx where k = 'space'), 'IL', '[]')$$, 'forbidden');
reset role;
select 'bill sources tests: ok';
