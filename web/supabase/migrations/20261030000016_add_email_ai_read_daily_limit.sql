-- When the rule-based parser cannot read an emailed bill, the inbound webhook may ask the AI model to
-- read it. This caps those calls per Space per day so a flood of mail to one private address cannot
-- run up the AI bill. Only counts are kept: no email text, sender or model output.
create table email_ai_reads (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references spaces on delete cascade,
  created_at timestamptz not null default now()
);
create index email_ai_reads_space_recent on email_ai_reads (space_id, created_at desc);

alter table email_ai_reads enable row level security;
revoke all on email_ai_reads from anon, authenticated;

-- Called only by the inbound-email webhook with the service role. True means "go ahead and read it".
create function begin_email_ai_read(p_inbound_token text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_space uuid;
begin
  select id into v_space from spaces where inbound_token = p_inbound_token;
  if v_space is null then return false; end if;
  if (select count(*) from email_ai_reads where space_id = v_space and created_at > now() - interval '1 day') >= 10 then
    return false;
  end if;
  insert into email_ai_reads (space_id) values (v_space);
  delete from email_ai_reads where space_id = v_space and created_at < now() - interval '7 days';
  return true;
end $$;

revoke execute on function begin_email_ai_read from public, anon, authenticated;
grant execute on function begin_email_ai_read to service_role;
