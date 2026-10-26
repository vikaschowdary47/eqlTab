-- Permanently remove an unconfirmed imported statement. Published bills are protected.
create function delete_statement(p_statement uuid) returns void
language plpgsql security definer set search_path = public as $$
declare st statements;
begin
  select * into st from statements where id = p_statement for update;
  if st.id is null then raise exception 'not_found'; end if;
  if not was_space_member(st.space_id) then raise exception 'forbidden'; end if;
  if st.status = 'published' or st.bill_id is not null then raise exception 'statement_published'; end if;
  delete from statements where id = p_statement;
end $$;

revoke execute on function delete_statement from public, anon;
grant execute on function delete_statement to authenticated;
