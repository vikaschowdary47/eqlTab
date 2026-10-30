-- "Find my bills in Gmail": a Space can also keep senders it ticked from its own inbox
-- (water, trash, a billing service like Public Grid or Conservice) as category 'other'.
create or replace function set_bill_sources(p_space uuid, p_state text, p_sources jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not is_space_member(p_space) then raise exception 'forbidden'; end if;
  if p_state is null or char_length(p_state) not between 2 and 5 then raise exception 'bad_state'; end if;
  if jsonb_typeof(p_sources) <> 'array' or jsonb_array_length(p_sources) > 12 then raise exception 'bad_sources'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_sources) e
    where jsonb_typeof(e) <> 'object'
       or coalesce(e->>'category', '') not in ('electricity', 'gas', 'internet', 'other')
       or char_length(coalesce(e->>'name', '')) not between 1 and 60
       or jsonb_typeof(e->'keywords') <> 'array'
       or jsonb_array_length(e->'keywords') not between 1 and 6
  ) then raise exception 'bad_sources'; end if;

  insert into space_bill_sources (space_id, state, sources, updated_by, updated_at)
  values (p_space, p_state, p_sources, auth.uid(), now())
  on conflict (space_id) do update set state = excluded.state, sources = excluded.sources, updated_by = excluded.updated_by, updated_at = now();
  perform log_activity(p_space, 'space', p_space, 'bill_sources_updated', jsonb_build_object('count', jsonb_array_length(p_sources)));
end $$;

revoke execute on function set_bill_sources from anon;
