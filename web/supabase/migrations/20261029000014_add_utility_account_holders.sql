-- "Whose name is each utility in?" Every member of a Space can see who holds each account, so
-- everyone knows who to ask and who gets reimbursed. The holder is either a member of the Space or
-- a plain name for someone outside it (a landlord, a former roommate). Only the last 4 digits of
-- an account number are ever stored. Not a payment feature: it records, it never moves money.
create table space_utility_holders (
  space_id uuid not null references spaces on delete cascade,
  category text not null check (category in ('electricity', 'gas', 'internet', 'water', 'trash')),
  holder_member_id uuid references space_members on delete set null,
  holder_name text check (holder_name is null or char_length(holder_name) between 1 and 60),
  account_last4 text check (account_last4 is null or account_last4 ~ '^[0-9]{4}$'),
  updated_by uuid references auth.users on delete set null,
  updated_at timestamptz not null default now(),
  primary key (space_id, category),
  -- exactly one way of naming the holder
  check ((holder_member_id is not null) <> (holder_name is not null))
);

alter table space_utility_holders enable row level security;
create policy "members read utility holders" on space_utility_holders for select using (is_space_member(space_id));
revoke insert, update, delete on space_utility_holders from anon, authenticated;

create function set_utility_holder(p_space uuid, p_category text, p_member uuid, p_name text, p_last4 text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_name text := nullif(btrim(coalesce(p_name, '')), '');
  v_last4 text := nullif(btrim(coalesce(p_last4, '')), '');
  v_before jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not is_space_member(p_space) then raise exception 'forbidden'; end if;
  if p_category not in ('electricity', 'gas', 'internet', 'water', 'trash') then raise exception 'bad_category'; end if;
  if (p_member is null) = (v_name is null) then raise exception 'bad_holder'; end if;
  if v_name is not null and char_length(v_name) > 60 then raise exception 'bad_holder'; end if;
  if v_last4 is not null and v_last4 !~ '^[0-9]{4}$' then raise exception 'bad_last4'; end if;
  if p_member is not null and not exists (select 1 from space_members where id = p_member and space_id = p_space and status = 'active') then
    raise exception 'holder_not_member';
  end if;

  select jsonb_build_object('member', holder_member_id, 'name', holder_name) into v_before
    from space_utility_holders where space_id = p_space and category = p_category;

  insert into space_utility_holders (space_id, category, holder_member_id, holder_name, account_last4, updated_by, updated_at)
  values (p_space, p_category, p_member, v_name, v_last4, auth.uid(), now())
  on conflict (space_id, category) do update
    set holder_member_id = excluded.holder_member_id, holder_name = excluded.holder_name,
        account_last4 = excluded.account_last4, updated_by = excluded.updated_by, updated_at = now();

  perform log_activity(p_space, 'space', p_space, 'utility_holder_set',
    jsonb_build_object('category', p_category, 'before', v_before, 'member', p_member, 'name', v_name));
end $$;

create function clear_utility_holder(p_space uuid, p_category text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not is_space_member(p_space) then raise exception 'forbidden'; end if;
  delete from space_utility_holders where space_id = p_space and category = p_category;
  perform log_activity(p_space, 'space', p_space, 'utility_holder_cleared', jsonb_build_object('category', p_category));
end $$;

revoke execute on function set_utility_holder, clear_utility_holder from public, anon;
grant execute on function set_utility_holder, clear_utility_holder to authenticated;
