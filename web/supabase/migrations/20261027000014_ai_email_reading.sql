-- AI reading of bill emails during a Gmail scan. Its own hourly budget, separate from
-- Quick Add, receipts and Splitwise imports.
alter table extraction_requests drop constraint if exists extraction_requests_kind_check;
alter table extraction_requests add constraint extraction_requests_kind_check
  check (kind in ('import', 'quick_add', 'receipt', 'email'));

create or replace function begin_ai_request(p_kind text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_limit int;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  v_limit := case p_kind when 'quick_add' then 30 when 'receipt' then 20 when 'email' then 60 else null end;
  if v_limit is null then raise exception 'bad_kind'; end if;
  if (select count(*) from extraction_requests where user_id = auth.uid() and kind = p_kind and created_at > now() - interval '1 hour') >= v_limit then
    raise exception 'rate_limited';
  end if;
  insert into extraction_requests (user_id, image_count, kind) values (auth.uid(), 1, p_kind) returning id into v_id;
  return v_id;
end $$;

revoke execute on function begin_ai_request from anon;
