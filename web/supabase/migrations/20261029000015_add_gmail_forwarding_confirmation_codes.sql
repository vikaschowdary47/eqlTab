-- Gmail asks for a confirmation code before it will auto-forward to a new address. That email lands
-- at the Space's private address, so the receiving webhook keeps just the numeric code here and the
-- Space shows it to its members. Only the code is stored: no email body, sender or link.
create table space_forwarding_codes (
  space_id uuid primary key references spaces on delete cascade,
  code text not null check (code ~ '^[0-9]{4,12}$'),
  received_at timestamptz not null default now()
);

alter table space_forwarding_codes enable row level security;
create policy "members read forwarding codes" on space_forwarding_codes for select using (is_space_member(space_id));
revoke insert, update, delete on space_forwarding_codes from anon, authenticated;

-- Called only by the inbound-email webhook with the service role. Unknown tokens do nothing.
create function record_forwarding_code(p_inbound_token text, p_code text) returns void
language plpgsql security definer set search_path = public as $$
declare v_space uuid;
begin
  if p_code is null or p_code !~ '^[0-9]{4,12}$' then return; end if;
  select id into v_space from spaces where inbound_token = p_inbound_token;
  if v_space is null then return; end if;
  insert into space_forwarding_codes (space_id, code, received_at) values (v_space, p_code, now())
  on conflict (space_id) do update set code = excluded.code, received_at = now();
end $$;

revoke execute on function record_forwarding_code from public, anon, authenticated;
grant execute on function record_forwarding_code to service_role;
