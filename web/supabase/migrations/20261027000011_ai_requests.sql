-- Quick Add and receipt scanning (spec section 19) call the vision/text model too.
-- Each kind gets its own hourly limit so typing bills never eats into Splitwise imports.
alter table extraction_requests add column kind text not null default 'import'
  check (kind in ('import', 'quick_add', 'receipt'));

create or replace function begin_extraction(p_image_count int) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_image_count not between 1 and 20 then raise exception 'bad_image_count'; end if;
  if (select count(*) from extraction_requests where user_id = auth.uid() and kind = 'import' and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'rate_limited';
  end if;
  insert into extraction_requests (user_id, image_count, kind) values (auth.uid(), p_image_count, 'import') returning id into v_id;
  return v_id;
end $$;

create function begin_ai_request(p_kind text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_limit int;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  v_limit := case p_kind when 'quick_add' then 30 when 'receipt' then 20 else null end;
  if v_limit is null then raise exception 'bad_kind'; end if;
  if (select count(*) from extraction_requests where user_id = auth.uid() and kind = p_kind and created_at > now() - interval '1 hour') >= v_limit then
    raise exception 'rate_limited';
  end if;
  insert into extraction_requests (user_id, image_count, kind) values (auth.uid(), 1, p_kind) returning id into v_id;
  return v_id;
end $$;

revoke execute on function begin_ai_request from anon;
