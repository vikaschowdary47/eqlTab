-- The AI email reader is capped at 10 reads per Space per day and only the service role may call it.
set client_min_messages = warning;
insert into auth.users (id, email, raw_user_meta_data) values
  ('60000000-0000-0000-0000-00000000000a', 'cap@example.com', '{"display_name":"Cap"}');
select set_config('request.jwt.claim.sub', '60000000-0000-0000-0000-00000000000a', false);
set role authenticated;
create table pg_temp.ctx (k text primary key, v text);
grant all on pg_temp.ctx to authenticated;
insert into pg_temp.ctx values ('space', create_space('Cap House', 'shared_home')::text);
reset role;

do $$
declare v_token text; v_ok boolean; i int;
begin
  select inbound_token into v_token from spaces where id = (select v::uuid from pg_temp.ctx where k = 'space');
  for i in 1..10 loop
    assert begin_email_ai_read(v_token) = true, 'read ' || i || ' allowed';
  end loop;
  assert begin_email_ai_read(v_token) = false, 'the 11th read in a day is refused';
  assert begin_email_ai_read('0000000000000000ff') = false, 'unknown address is refused';
  -- A day later the Space can read again
  update email_ai_reads set created_at = now() - interval '2 days';
  assert begin_email_ai_read(v_token) = true, 'allowed again after a day';
end $$;

-- Members and anonymous users cannot call it or read the table
set role authenticated;
do $$ begin
  begin perform begin_email_ai_read('x'); assert false, 'authenticated must not execute'; exception when insufficient_privilege then null; end;
  begin perform count(*) from email_ai_reads; assert false, 'authenticated must not read'; exception when insufficient_privilege then null; end;
end $$;
reset role;
