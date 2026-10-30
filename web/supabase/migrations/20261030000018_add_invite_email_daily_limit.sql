-- Members can ask eqlTab to email a personal invite link for them. This caps how many each person can send
-- per day so the feature cannot be used to spam. Only a count is kept: no address, name or message.
create table invite_email_sends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  created_at timestamptz not null default now()
);
create index invite_email_sends_recent on invite_email_sends (user_id, created_at desc);

alter table invite_email_sends enable row level security;
revoke all on invite_email_sends from anon, authenticated;

-- True means "go ahead and send one". Ten a day per person.
create function begin_invite_email() returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  if (select count(*) from invite_email_sends where user_id = auth.uid() and created_at > now() - interval '1 day') >= 10 then
    return false;
  end if;
  insert into invite_email_sends (user_id) values (auth.uid());
  delete from invite_email_sends where user_id = auth.uid() and created_at < now() - interval '7 days';
  return true;
end $$;

revoke execute on function begin_invite_email from public, anon;
grant execute on function begin_invite_email to authenticated;
