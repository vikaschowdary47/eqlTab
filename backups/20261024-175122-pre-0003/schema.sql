


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."bill_source" AS ENUM (
    'manual',
    'upload',
    'email'
);


ALTER TYPE "public"."bill_source" OWNER TO "postgres";


CREATE TYPE "public"."bill_status" AS ENUM (
    'published',
    'void'
);


ALTER TYPE "public"."bill_status" OWNER TO "postgres";


CREATE TYPE "public"."member_role" AS ENUM (
    'owner',
    'member'
);


ALTER TYPE "public"."member_role" OWNER TO "postgres";


CREATE TYPE "public"."member_status" AS ENUM (
    'active',
    'inactive'
);


ALTER TYPE "public"."member_status" OWNER TO "postgres";


CREATE TYPE "public"."settlement_status" AS ENUM (
    'reported',
    'confirmed',
    'disputed',
    'reversed'
);


ALTER TYPE "public"."settlement_status" OWNER TO "postgres";


CREATE TYPE "public"."space_type" AS ENUM (
    'shared_home',
    'couple',
    'family',
    'group'
);


ALTER TYPE "public"."space_type" OWNER TO "postgres";


CREATE TYPE "public"."split_method" AS ENUM (
    'equal',
    'exact',
    'percent'
);


ALTER TYPE "public"."split_method" OWNER TO "postgres";


CREATE TYPE "public"."statement_source" AS ENUM (
    'upload',
    'email'
);


ALTER TYPE "public"."statement_source" OWNER TO "postgres";


CREATE TYPE "public"."statement_status" AS ENUM (
    'ready',
    'needs_review',
    'needs_statement',
    'duplicate',
    'failed',
    'published',
    'rejected'
);


ALTER TYPE "public"."statement_status" OWNER TO "postgres";


CREATE TYPE "public"."utility_status" AS ENUM (
    'not_applicable',
    'unpaid',
    'payment_reported',
    'provider_verified'
);


ALTER TYPE "public"."utility_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."_ingest_statement"("p_space" "uuid", "p_actor" "uuid", "p_source" "public"."statement_source", "p_file_path" "text", "p_file_name" "text", "p_sender" "text", "p_kind" "text", "p_provider" "text", "p_amount_cents" bigint, "p_due_date" "date", "p_period_start" "date", "p_period_end" "date", "p_account_last4" "text", "p_statement_ref" "text", "p_statement_key" "text", "p_reasons" "text"[], "p_parser_version" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_prev statements; v_status statement_status; v_reasons text[] := coalesce(p_reasons, '{}'); v_rev uuid; v_id uuid;
begin
  if p_kind = 'unreadable' then
    v_status := 'failed';
  elsif p_kind = 'notice_only' then
    v_status := 'needs_statement';
  else
    if p_statement_key is not null then
      select * into v_prev from statements
       where space_id = p_space and statement_key = p_statement_key and status in ('published', 'ready', 'needs_review')
       order by received_at desc limit 1;
    end if;
    if v_prev.id is not null and v_prev.amount_cents is not distinct from p_amount_cents and v_prev.due_date is not distinct from p_due_date then
      v_status := 'duplicate'; v_rev := v_prev.id;
    elsif v_prev.id is not null then
      v_status := 'needs_review'; v_rev := v_prev.id;
      v_reasons := array_append(v_reasons, 'Revised statement: the amount or due date changed since the last copy');
    elsif array_length(v_reasons, 1) > 0 then
      v_status := 'needs_review';
    else
      v_status := 'ready';
    end if;
  end if;

  insert into statements (space_id, source, file_path, file_name, sender, kind, provider, amount_cents, due_date, period_start, period_end,
                          account_last4, statement_ref, statement_key, reasons, parser_version, status, revision_of, created_by)
  values (p_space, p_source, p_file_path, p_file_name, p_sender, p_kind, p_provider, p_amount_cents, p_due_date, p_period_start, p_period_end,
          p_account_last4, p_statement_ref, p_statement_key, v_reasons, p_parser_version, v_status, v_rev, p_actor)
  returning id into v_id;

  insert into activity (space_id, actor_user_id, entity_type, entity_id, action, metadata)
  values (p_space, p_actor, 'statement', v_id, 'statement_received', jsonb_build_object('provider', p_provider, 'status', v_status, 'source', p_source));
  return v_id;
end $$;


ALTER FUNCTION "public"."_ingest_statement"("p_space" "uuid", "p_actor" "uuid", "p_source" "public"."statement_source", "p_file_path" "text", "p_file_name" "text", "p_sender" "text", "p_kind" "text", "p_provider" "text", "p_amount_cents" bigint, "p_due_date" "date", "p_period_start" "date", "p_period_end" "date", "p_account_last4" "text", "p_statement_ref" "text", "p_statement_key" "text", "p_reasons" "text"[], "p_parser_version" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."accept_invitation"("p_token" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v space_invitations;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into v from space_invitations where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') for update;
  if v.id is null or v.revoked_at is not null or v.expires_at < now() or v.use_count >= v.max_uses then
    raise exception 'invite_invalid';
  end if;
  if exists (select 1 from space_members where space_id = v.space_id and user_id = auth.uid() and status = 'active') then
    return v.space_id;
  end if;
  insert into space_members (space_id, user_id, role) values (v.space_id, auth.uid(), 'member');
  insert into notification_prefs (user_id, space_id) values (auth.uid(), v.space_id) on conflict do nothing;
  update space_invitations set use_count = use_count + 1 where id = v.id;
  perform log_activity(v.space_id, 'member', null, 'member_joined');
  return v.space_id;
end $$;


ALTER FUNCTION "public"."accept_invitation"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."confirm_settlement"("p_settlement" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare s settlements; b bills;
begin
  select * into s from settlements where id = p_settlement for update;
  select b2.* into b from bills b2 join bill_splits sp on sp.bill_id = b2.id where sp.id = s.bill_split_id;
  if s.id is null or member_user(b.payer_member_id) is distinct from auth.uid() then raise exception 'forbidden'; end if;
  if s.status = 'confirmed' then return; end if;
  if s.status <> 'reported' then raise exception 'not_reported'; end if;
  update settlements set status = 'confirmed', confirmed_by = auth.uid(), confirmed_at = now() where id = p_settlement;
  perform log_activity(b.space_id, 'settlement', p_settlement, 'payment_confirmed', jsonb_build_object('bill_id', b.id, 'title', b.title, 'amount_cents', s.amount_cents));
end $$;


ALTER FUNCTION "public"."confirm_settlement"("p_settlement" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_bill"("p_space" "uuid", "p_title" "text", "p_category" "text", "p_amount_cents" bigint, "p_payer_member" "uuid", "p_bill_date" "date", "p_due_date" "date", "p_note" "text", "p_split_method" "public"."split_method", "p_shares" "jsonb", "p_client_request_id" "uuid", "p_period_start" "date" DEFAULT NULL::"date", "p_period_end" "date" DEFAULT NULL::"date", "p_source" "public"."bill_source" DEFAULT 'manual'::"public"."bill_source", "p_statement" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_bill uuid; v_sum bigint; v_count int; v_me uuid := my_member_id(p_space); v_type space_type;
begin
  if v_me is null then raise exception 'forbidden'; end if;
  select id into v_bill from bills where client_request_id = p_client_request_id;
  if v_bill is not null then return v_bill; end if; -- idempotent retry / double click

  -- members can add bills they paid; owners can add bills for anyone
  if p_payer_member <> v_me and not is_space_owner(p_space) then raise exception 'only_owner_or_payer'; end if;
  if not exists (select 1 from space_members where id = p_payer_member and space_id = p_space and status = 'active') then
    raise exception 'payer_not_member';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then raise exception 'amount_positive'; end if;
  if jsonb_typeof(p_shares) <> 'array' or jsonb_array_length(p_shares) = 0 then raise exception 'no_participants'; end if;

  select coalesce(sum((x->>'amount_cents')::bigint), 0), count(*) into v_sum, v_count from jsonb_array_elements(p_shares) x;
  if v_sum <> p_amount_cents then raise exception 'splits_must_equal_total'; end if;
  if exists (select 1 from jsonb_array_elements(p_shares) x where (x->>'amount_cents')::bigint < 0) then raise exception 'negative_share'; end if;
  if (select count(distinct x->>'member_id') from jsonb_array_elements(p_shares) x) <> v_count then raise exception 'duplicate_participant'; end if;
  if exists (select 1 from jsonb_array_elements(p_shares) x where not exists (
      select 1 from space_members m where m.id = (x->>'member_id')::uuid and m.space_id = p_space and m.status = 'active')) then
    raise exception 'participant_not_member';
  end if;

  select type into v_type from spaces where id = p_space;
  insert into bills (space_id, title, category, amount_cents, payer_member_id, bill_date, due_date, period_start, period_end,
                     split_method, source, statement_id, note, client_request_id, created_by, utility_status)
  values (p_space, trim(p_title), p_category, p_amount_cents, p_payer_member, p_bill_date, p_due_date, p_period_start, p_period_end,
          p_split_method, p_source, p_statement, nullif(trim(p_note), ''), p_client_request_id, auth.uid(),
          case when p_category in ('electricity','gas','water','internet','phone','rent') then 'unpaid'::utility_status else 'not_applicable' end)
  returning id into v_bill;

  insert into bill_splits (bill_id, member_id, amount_cents)
  select v_bill, (x->>'member_id')::uuid, (x->>'amount_cents')::bigint from jsonb_array_elements(p_shares) x;

  perform log_activity(p_space, 'bill', v_bill, 'bill_created', jsonb_build_object('title', trim(p_title), 'source', p_source));
  return v_bill;
end $$;


ALTER FUNCTION "public"."create_bill"("p_space" "uuid", "p_title" "text", "p_category" "text", "p_amount_cents" bigint, "p_payer_member" "uuid", "p_bill_date" "date", "p_due_date" "date", "p_note" "text", "p_split_method" "public"."split_method", "p_shares" "jsonb", "p_client_request_id" "uuid", "p_period_start" "date", "p_period_end" "date", "p_source" "public"."bill_source", "p_statement" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_invitation"("p_space" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  if not is_space_owner(p_space) then raise exception 'forbidden'; end if;
  v_token := translate(v_token, '+/=', '-_');
  insert into space_invitations (space_id, token_hash, expires_at, created_by)
  values (p_space, encode(extensions.digest(v_token, 'sha256'), 'hex'), now() + interval '7 days', auth.uid());
  perform log_activity(p_space, 'invitation', null, 'invite_created');
  return v_token;
end $$;


ALTER FUNCTION "public"."create_invitation"("p_space" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_space"("p_name" "text", "p_type" "public"."space_type") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_space uuid; v_member uuid; v_split split_method;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  v_split := case when p_type = 'family' then 'exact'::split_method else 'equal'::split_method end;
  insert into spaces (name, type, created_by, default_split) values (trim(p_name), p_type, auth.uid(), v_split) returning id into v_space;
  insert into space_members (space_id, user_id, role) values (v_space, auth.uid(), 'owner') returning id into v_member;
  insert into notification_prefs (user_id, space_id) values (auth.uid(), v_space);
  perform log_activity(v_space, 'space', v_space, 'space_created', jsonb_build_object('type', p_type));
  return v_space;
end $$;


ALTER FUNCTION "public"."create_space"("p_name" "text", "p_type" "public"."space_type") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."deactivate_member"("p_member" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare m space_members;
begin
  select * into m from space_members where id = p_member;
  if m.id is null or m.status <> 'active' then raise exception 'not_found'; end if;
  if m.user_id <> auth.uid() and not is_space_owner(m.space_id) then raise exception 'forbidden'; end if;
  if m.role = 'owner' and (select count(*) from space_members where space_id = m.space_id and role = 'owner' and status = 'active') = 1
     and (select count(*) from space_members where space_id = m.space_id and status = 'active') > 1 then
    raise exception 'last_owner';
  end if;
  update space_members set status = 'inactive', left_at = now() where id = p_member;
  perform log_activity(m.space_id, 'member', p_member, case when m.user_id = auth.uid() then 'member_left' else 'member_removed' end);
end $$;


ALTER FUNCTION "public"."deactivate_member"("p_member" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dispute_settlement"("p_settlement" "uuid", "p_note" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare s settlements; b bills;
begin
  select * into s from settlements where id = p_settlement for update;
  select b2.* into b from bills b2 join bill_splits sp on sp.bill_id = b2.id where sp.id = s.bill_split_id;
  if s.id is null or member_user(b.payer_member_id) is distinct from auth.uid() then raise exception 'forbidden'; end if;
  if s.status <> 'reported' then raise exception 'not_reported'; end if;
  update settlements set status = 'disputed', note = coalesce(nullif(trim(p_note), ''), note) where id = p_settlement;
  perform log_activity(b.space_id, 'settlement', p_settlement, 'payment_disputed', jsonb_build_object('bill_id', b.id, 'title', b.title));
end $$;


ALTER FUNCTION "public"."dispute_settlement"("p_settlement" "uuid", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."dispute_split"("p_split" "uuid", "p_note" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare sp bill_splits; b bills;
begin
  select * into sp from bill_splits where id = p_split;
  select * into b from bills where id = sp.bill_id;
  if sp.id is null or member_user(sp.member_id) is distinct from auth.uid() then raise exception 'forbidden'; end if;
  update bill_splits set disputed_at = now(), dispute_note = nullif(trim(p_note), '') where id = p_split;
  perform log_activity(b.space_id, 'bill', b.id, 'split_disputed', jsonb_build_object('title', b.title));
end $$;


ALTER FUNCTION "public"."dispute_split"("p_split" "uuid", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into profiles (id, display_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'), ''), split_part(new.email, '@', 1)));
  return new;
end $$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ingest_emailed_statement"("p_inbound_token" "text", "p_sender" "text", "p_file_path" "text", "p_file_name" "text", "p_kind" "text", "p_provider" "text", "p_amount_cents" bigint, "p_due_date" "date", "p_period_start" "date", "p_period_end" "date", "p_account_last4" "text", "p_statement_ref" "text", "p_statement_key" "text", "p_reasons" "text"[], "p_parser_version" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_space uuid;
begin
  select id into v_space from spaces where inbound_token = p_inbound_token;
  if v_space is null then raise exception 'unknown_address'; end if;
  return _ingest_statement(v_space, null, 'email', p_file_path, p_file_name, p_sender, p_kind, p_provider, p_amount_cents, p_due_date,
    p_period_start, p_period_end, p_account_last4, p_statement_ref, p_statement_key, p_reasons, p_parser_version);
end $$;


ALTER FUNCTION "public"."ingest_emailed_statement"("p_inbound_token" "text", "p_sender" "text", "p_file_path" "text", "p_file_name" "text", "p_kind" "text", "p_provider" "text", "p_amount_cents" bigint, "p_due_date" "date", "p_period_start" "date", "p_period_end" "date", "p_account_last4" "text", "p_statement_ref" "text", "p_statement_key" "text", "p_reasons" "text"[], "p_parser_version" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ingest_uploaded_statement"("p_space" "uuid", "p_file_path" "text", "p_file_name" "text", "p_kind" "text", "p_provider" "text", "p_amount_cents" bigint, "p_due_date" "date", "p_period_start" "date", "p_period_end" "date", "p_account_last4" "text", "p_statement_ref" "text", "p_statement_key" "text", "p_reasons" "text"[], "p_parser_version" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not is_space_member(p_space) then raise exception 'forbidden'; end if;
  return _ingest_statement(p_space, auth.uid(), 'upload', p_file_path, p_file_name, null, p_kind, p_provider, p_amount_cents, p_due_date,
    p_period_start, p_period_end, p_account_last4, p_statement_ref, p_statement_key, p_reasons, p_parser_version);
end $$;


ALTER FUNCTION "public"."ingest_uploaded_statement"("p_space" "uuid", "p_file_path" "text", "p_file_name" "text", "p_kind" "text", "p_provider" "text", "p_amount_cents" bigint, "p_due_date" "date", "p_period_start" "date", "p_period_end" "date", "p_account_last4" "text", "p_statement_ref" "text", "p_statement_key" "text", "p_reasons" "text"[], "p_parser_version" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_space_member"("p_space" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (select 1 from space_members where space_id = p_space and user_id = auth.uid() and status = 'active')
$$;


ALTER FUNCTION "public"."is_space_member"("p_space" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_space_owner"("p_space" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (select 1 from space_members where space_id = p_space and user_id = auth.uid() and status = 'active' and role = 'owner')
$$;


ALTER FUNCTION "public"."is_space_owner"("p_space" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_activity"("p_space" "uuid", "p_type" "text", "p_id" "uuid", "p_action" "text", "p_meta" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  insert into activity (space_id, actor_user_id, entity_type, entity_id, action, metadata) values (p_space, auth.uid(), p_type, p_id, p_action, p_meta)
$$;


ALTER FUNCTION "public"."log_activity"("p_space" "uuid", "p_type" "text", "p_id" "uuid", "p_action" "text", "p_meta" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."member_user"("p_member" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select user_id from space_members where id = p_member
$$;


ALTER FUNCTION "public"."member_user"("p_member" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."my_member_id"("p_space" "uuid") RETURNS "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select id from space_members where space_id = p_space and user_id = auth.uid() and status = 'active'
$$;


ALTER FUNCTION "public"."my_member_id"("p_space" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."preview_invitation"("p_token" "text") RETURNS TABLE("space_name" "text", "space_type" "public"."space_type", "inviter" "text", "valid" boolean, "already_member" boolean)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v space_invitations;
begin
  select * into v from space_invitations where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  if v.id is null or v.revoked_at is not null or v.expires_at < now() or v.use_count >= v.max_uses then
    return query select null::text, null::space_type, null::text, false, false; return;
  end if;
  return query select s.name, s.type, p.display_name, true,
    exists (select 1 from space_members m where m.space_id = s.id and m.user_id = auth.uid() and m.status = 'active')
  from spaces s join profiles p on p.id = v.created_by where s.id = v.space_id;
end $$;


ALTER FUNCTION "public"."preview_invitation"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."publish_statement"("p_statement" "uuid", "p_title" "text", "p_category" "text", "p_amount_cents" bigint, "p_payer_member" "uuid", "p_due_date" "date", "p_period_start" "date", "p_period_end" "date", "p_split_method" "public"."split_method", "p_shares" "jsonb", "p_client_request_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare st statements; v_bill uuid; v_orig bills;
begin
  select * into st from statements where id = p_statement for update;
  if st.id is null or not is_space_member(st.space_id) then raise exception 'forbidden'; end if;
  if st.status = 'published' then return st.bill_id; end if;
  if st.status not in ('ready', 'needs_review', 'needs_statement') then raise exception 'not_publishable'; end if;
  if p_due_date is null then raise exception 'due_date_required'; end if;

  if st.revision_of is not null then
    select b.* into v_orig from bills b join statements s on s.bill_id = b.id where s.id = st.revision_of and b.status = 'published';
  end if;

  if v_orig.id is not null then
    -- update_bill enforces payer/owner, stale versions and the no-settlements rule for amount changes
    perform update_bill(v_orig.id, v_orig.version, p_title, p_category, p_due_date,
      coalesce(v_orig.note, '') , p_amount_cents, p_split_method, p_shares);
    update bills set statement_id = st.id, period_start = p_period_start, period_end = p_period_end where id = v_orig.id;
    v_bill := v_orig.id;
  else
    v_bill := create_bill(st.space_id, p_title, p_category, p_amount_cents, p_payer_member, current_date, p_due_date, null,
      p_split_method, p_shares, p_client_request_id, p_period_start, p_period_end,
      case st.source when 'email' then 'email'::bill_source else 'upload'::bill_source end, st.id);
  end if;

  update statements set status = 'published', bill_id = v_bill, decided_by = auth.uid(), decided_at = now(),
    amount_cents = p_amount_cents, due_date = p_due_date where id = p_statement;
  perform log_activity(st.space_id, 'statement', st.id, 'statement_published', jsonb_build_object('bill_id', v_bill, 'provider', st.provider));
  return v_bill;
end $$;


ALTER FUNCTION "public"."publish_statement"("p_statement" "uuid", "p_title" "text", "p_category" "text", "p_amount_cents" bigint, "p_payer_member" "uuid", "p_due_date" "date", "p_period_start" "date", "p_period_end" "date", "p_split_method" "public"."split_method", "p_shares" "jsonb", "p_client_request_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reject_statement"("p_statement" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare st statements;
begin
  select * into st from statements where id = p_statement for update;
  if st.id is null or not is_space_member(st.space_id) then raise exception 'forbidden'; end if;
  if st.status = 'published' then raise exception 'already_published'; end if;
  update statements set status = 'rejected', decided_by = auth.uid(), decided_at = now() where id = p_statement;
  perform log_activity(st.space_id, 'statement', st.id, 'statement_dismissed', jsonb_build_object('provider', st.provider));
end $$;


ALTER FUNCTION "public"."reject_statement"("p_statement" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."report_settlement"("p_split" "uuid", "p_amount_cents" bigint, "p_method" "text", "p_note" "text", "p_client_request_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare sp bill_splits; b bills; v_id uuid; v_confirmed bigint; v_pending bigint;
begin
  select id into v_id from settlements where client_request_id = p_client_request_id;
  if v_id is not null then return v_id; end if;
  select * into sp from bill_splits where id = p_split for update;
  select * into b from bills where id = sp.bill_id;
  -- former members may still settle their own historical shares
  if sp.id is null or member_user(sp.member_id) is distinct from auth.uid() then raise exception 'forbidden'; end if;
  if b.status = 'void' then raise exception 'bill_void'; end if;
  if sp.member_id = b.payer_member_id then raise exception 'payer_own_share'; end if;
  select coalesce(sum(amount_cents) filter (where status = 'confirmed'), 0), coalesce(sum(amount_cents) filter (where status = 'reported'), 0)
    into v_confirmed, v_pending from settlements where bill_split_id = p_split;
  if p_amount_cents <= 0 or p_amount_cents > sp.amount_cents - v_confirmed - v_pending then raise exception 'amount_exceeds_outstanding'; end if;
  insert into settlements (bill_split_id, amount_cents, method, note, reported_by, client_request_id)
  values (p_split, p_amount_cents, nullif(trim(p_method), ''), nullif(trim(p_note), ''), auth.uid(), p_client_request_id) returning id into v_id;
  perform log_activity(b.space_id, 'settlement', v_id, 'payment_reported', jsonb_build_object('bill_id', b.id, 'title', b.title, 'amount_cents', p_amount_cents));
  return v_id;
end $$;


ALTER FUNCTION "public"."report_settlement"("p_split" "uuid", "p_amount_cents" bigint, "p_method" "text", "p_note" "text", "p_client_request_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."report_utility_paid"("p_bill" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare b bills;
begin
  select * into b from bills where id = p_bill;
  if b.id is null or member_user(b.payer_member_id) is distinct from auth.uid() then raise exception 'forbidden'; end if;
  if b.utility_status = 'not_applicable' then raise exception 'not_utility'; end if;
  update bills set utility_status = 'payment_reported', updated_at = now() where id = p_bill;
  perform log_activity(b.space_id, 'bill', p_bill, 'utility_payment_reported', jsonb_build_object('title', b.title));
end $$;


ALTER FUNCTION "public"."report_utility_paid"("p_bill" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_split_dispute"("p_split" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare sp bill_splits; b bills; v_me uuid;
begin
  select * into sp from bill_splits where id = p_split;
  select * into b from bills where id = sp.bill_id;
  v_me := my_member_id(b.space_id);
  if sp.id is null or v_me is null or (v_me not in (sp.member_id, b.payer_member_id) and not is_space_owner(b.space_id)) then raise exception 'forbidden'; end if;
  update bill_splits set disputed_at = null where id = p_split;
  perform log_activity(b.space_id, 'bill', b.id, 'split_dispute_resolved', jsonb_build_object('title', b.title));
end $$;


ALTER FUNCTION "public"."resolve_split_dispute"("p_split" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revoke_invitation"("p_invitation" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_space uuid;
begin
  select space_id into v_space from space_invitations where id = p_invitation;
  if v_space is null or not is_space_owner(v_space) then raise exception 'forbidden'; end if;
  update space_invitations set revoked_at = now() where id = p_invitation and revoked_at is null;
  perform log_activity(v_space, 'invitation', p_invitation, 'invite_revoked');
end $$;


ALTER FUNCTION "public"."revoke_invitation"("p_invitation" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."send_reminder"("p_split" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare sp bill_splits; b bills; v_user uuid;
begin
  select * into sp from bill_splits where id = p_split;
  select * into b from bills where id = sp.bill_id;
  if sp.id is null or member_user(b.payer_member_id) is distinct from auth.uid() then raise exception 'forbidden'; end if;
  select user_id into v_user from space_members where id = sp.member_id;
  if exists (select 1 from notification_prefs where user_id = v_user and space_id = b.space_id and reminders_opt_out) then raise exception 'opted_out'; end if;
  if exists (select 1 from reminders where bill_split_id = p_split and sent_at > now() - interval '24 hours') then raise exception 'rate_limited'; end if;
  insert into reminders (bill_split_id, sent_by) values (p_split, auth.uid());
  perform log_activity(b.space_id, 'bill', b.id, 'reminder_sent', jsonb_build_object('title', b.title));
end $$;


ALTER FUNCTION "public"."send_reminder"("p_split" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_member_role"("p_member" "uuid", "p_role" "public"."member_role") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare m space_members;
begin
  select * into m from space_members where id = p_member and status = 'active';
  if m.id is null or not is_space_owner(m.space_id) then raise exception 'forbidden'; end if;
  if m.user_id = auth.uid() and p_role = 'member' then raise exception 'cannot_demote_self'; end if;
  update space_members set role = p_role where id = p_member;
  perform log_activity(m.space_id, 'member', p_member, 'role_changed', jsonb_build_object('role', p_role));
end $$;


ALTER FUNCTION "public"."set_member_role"("p_member" "uuid", "p_role" "public"."member_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_bill"("p_bill" "uuid", "p_version" integer, "p_title" "text", "p_category" "text", "p_due_date" "date", "p_note" "text", "p_amount_cents" bigint DEFAULT NULL::bigint, "p_split_method" "public"."split_method" DEFAULT NULL::"public"."split_method", "p_shares" "jsonb" DEFAULT NULL::"jsonb") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare b bills; v_sum bigint; v_me uuid;
begin
  select * into b from bills where id = p_bill for update;
  if b.id is null then raise exception 'not_found'; end if;
  v_me := my_member_id(b.space_id);
  if v_me is null or (b.payer_member_id is distinct from v_me and not is_space_owner(b.space_id)) then raise exception 'forbidden'; end if;
  if b.version <> p_version then raise exception 'stale_edit'; end if;
  if b.status = 'void' then raise exception 'bill_void'; end if;

  if p_amount_cents is not null then
    if exists (select 1 from settlements s join bill_splits sp on sp.id = s.bill_split_id where sp.bill_id = p_bill and s.status in ('reported','confirmed')) then
      raise exception 'has_settlements';
    end if;
    if p_amount_cents <= 0 then raise exception 'amount_positive'; end if;
    select coalesce(sum((x->>'amount_cents')::bigint), 0) into v_sum from jsonb_array_elements(p_shares) x;
    if v_sum <> p_amount_cents then raise exception 'splits_must_equal_total'; end if;
    if exists (select 1 from jsonb_array_elements(p_shares) x where (x->>'amount_cents')::bigint < 0 or not exists (
        select 1 from space_members m where m.id = (x->>'member_id')::uuid and m.space_id = b.space_id)) then
      raise exception 'participant_not_member';
    end if;
    delete from bill_splits where bill_id = p_bill;
    insert into bill_splits (bill_id, member_id, amount_cents)
    select p_bill, (x->>'member_id')::uuid, (x->>'amount_cents')::bigint from jsonb_array_elements(p_shares) x;
    update bills set amount_cents = p_amount_cents, split_method = p_split_method where id = p_bill;
  end if;

  update bills set title = trim(p_title), category = p_category, due_date = p_due_date, note = nullif(trim(p_note), ''),
    updated_at = now(), version = version + 1 where id = p_bill;
  perform log_activity(b.space_id, 'bill', p_bill, 'bill_edited', jsonb_build_object(
    'amount_from', b.amount_cents, 'amount_to', coalesce(p_amount_cents, b.amount_cents),
    'due_from', b.due_date, 'due_to', p_due_date));
end $$;


ALTER FUNCTION "public"."update_bill"("p_bill" "uuid", "p_version" integer, "p_title" "text", "p_category" "text", "p_due_date" "date", "p_note" "text", "p_amount_cents" bigint, "p_split_method" "public"."split_method", "p_shares" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_display_name"("p_name" "text") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  update profiles set display_name = trim(p_name) where id = auth.uid()
$$;


ALTER FUNCTION "public"."update_display_name"("p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_notification_prefs"("p_space" "uuid", "p_bill_arrival" boolean, "p_days" integer[], "p_opt_out" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not is_space_member(p_space) then raise exception 'forbidden'; end if;
  if exists (select 1 from unnest(p_days) d where d < 0 or d > 14) then raise exception 'bad_days'; end if;
  insert into notification_prefs (user_id, space_id, bill_arrival, reminder_days, reminders_opt_out)
  values (auth.uid(), p_space, p_bill_arrival, p_days, p_opt_out)
  on conflict (user_id, space_id) do update set bill_arrival = excluded.bill_arrival, reminder_days = excluded.reminder_days, reminders_opt_out = excluded.reminders_opt_out;
end $$;


ALTER FUNCTION "public"."update_notification_prefs"("p_space" "uuid", "p_bill_arrival" boolean, "p_days" integer[], "p_opt_out" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_space"("p_space" "uuid", "p_name" "text", "p_type" "public"."space_type", "p_default_split" "public"."split_method") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_old spaces;
begin
  if not is_space_owner(p_space) then raise exception 'forbidden'; end if;
  select * into v_old from spaces where id = p_space;
  update spaces set name = trim(p_name), type = p_type, default_split = p_default_split, updated_at = now() where id = p_space;
  perform log_activity(p_space, 'space', p_space, 'space_updated',
    jsonb_build_object('name_changed', v_old.name <> trim(p_name), 'type_from', v_old.type, 'type_to', p_type));
end $$;


ALTER FUNCTION "public"."update_space"("p_space" "uuid", "p_name" "text", "p_type" "public"."space_type", "p_default_split" "public"."split_method") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."void_bill"("p_bill" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare b bills; v_me uuid;
begin
  select * into b from bills where id = p_bill for update;
  if b.id is null then raise exception 'not_found'; end if;
  v_me := my_member_id(b.space_id);
  if v_me is null or (b.payer_member_id is distinct from v_me and not is_space_owner(b.space_id)) then raise exception 'forbidden'; end if;
  if exists (select 1 from settlements s join bill_splits sp on sp.id = s.bill_split_id where sp.bill_id = p_bill and s.status = 'confirmed') then
    raise exception 'has_confirmed_settlements';
  end if;
  update bills set status = 'void', updated_at = now(), version = version + 1 where id = p_bill;
  update settlements set status = 'reversed' where bill_split_id in (select id from bill_splits where bill_id = p_bill) and status = 'reported';
  perform log_activity(b.space_id, 'bill', p_bill, 'bill_voided', jsonb_build_object('title', b.title));
end $$;


ALTER FUNCTION "public"."void_bill"("p_bill" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."was_space_member"("p_space" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  -- former members keep read access to history (spec: outstanding balances remain visible to authorized participants)
  select exists (select 1 from space_members where space_id = p_space and user_id = auth.uid())
$$;


ALTER FUNCTION "public"."was_space_member"("p_space" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activity" (
    "id" bigint NOT NULL,
    "space_id" "uuid" NOT NULL,
    "actor_user_id" "uuid",
    "entity_type" "text" NOT NULL,
    "entity_id" "uuid",
    "action" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."activity" OWNER TO "postgres";


ALTER TABLE "public"."activity" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."activity_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."bill_splits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bill_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "amount_cents" bigint NOT NULL,
    "disputed_at" timestamp with time zone,
    "dispute_note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "bill_splits_amount_cents_check" CHECK (("amount_cents" >= 0)),
    CONSTRAINT "bill_splits_dispute_note_check" CHECK (("char_length"("dispute_note") <= 500))
);


ALTER TABLE "public"."bill_splits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bills" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "space_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "category" "text" DEFAULT 'other'::"text" NOT NULL,
    "amount_cents" bigint NOT NULL,
    "payer_member_id" "uuid" NOT NULL,
    "bill_date" "date" NOT NULL,
    "due_date" "date",
    "period_start" "date",
    "period_end" "date",
    "split_method" "public"."split_method" NOT NULL,
    "source" "public"."bill_source" DEFAULT 'manual'::"public"."bill_source" NOT NULL,
    "statement_id" "uuid",
    "utility_status" "public"."utility_status" DEFAULT 'not_applicable'::"public"."utility_status" NOT NULL,
    "status" "public"."bill_status" DEFAULT 'published'::"public"."bill_status" NOT NULL,
    "note" "text",
    "client_request_id" "uuid",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "version" integer DEFAULT 1 NOT NULL,
    CONSTRAINT "bills_amount_cents_check" CHECK (("amount_cents" > 0)),
    CONSTRAINT "bills_category_check" CHECK (("category" = ANY (ARRAY['electricity'::"text", 'gas'::"text", 'water'::"text", 'internet'::"text", 'rent'::"text", 'phone'::"text", 'groceries'::"text", 'travel'::"text", 'dining'::"text", 'other'::"text"]))),
    CONSTRAINT "bills_note_check" CHECK (("char_length"("note") <= 500)),
    CONSTRAINT "bills_title_check" CHECK ((("char_length"(TRIM(BOTH FROM "title")) >= 1) AND ("char_length"(TRIM(BOTH FROM "title")) <= 80)))
);


ALTER TABLE "public"."bills" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_prefs" (
    "user_id" "uuid" NOT NULL,
    "space_id" "uuid" NOT NULL,
    "bill_arrival" boolean DEFAULT true NOT NULL,
    "reminder_days" integer[] DEFAULT '{5,2,1}'::integer[] NOT NULL,
    "reminders_opt_out" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."notification_prefs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "display_name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_display_name_check" CHECK ((("char_length"("display_name") >= 1) AND ("char_length"("display_name") <= 80)))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reminders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bill_split_id" "uuid" NOT NULL,
    "channel" "text" DEFAULT 'link'::"text" NOT NULL,
    "sent_by" "uuid" NOT NULL,
    "sent_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "reminders_channel_check" CHECK (("channel" = ANY (ARRAY['link'::"text", 'email'::"text"])))
);


ALTER TABLE "public"."reminders" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."settlements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "bill_split_id" "uuid" NOT NULL,
    "amount_cents" bigint NOT NULL,
    "method" "text",
    "note" "text",
    "status" "public"."settlement_status" DEFAULT 'reported'::"public"."settlement_status" NOT NULL,
    "reported_by" "uuid" NOT NULL,
    "reported_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "confirmed_by" "uuid",
    "confirmed_at" timestamp with time zone,
    "client_request_id" "uuid",
    CONSTRAINT "settlements_amount_cents_check" CHECK (("amount_cents" > 0)),
    CONSTRAINT "settlements_method_check" CHECK (("char_length"("method") <= 40)),
    CONSTRAINT "settlements_note_check" CHECK (("char_length"("note") <= 500))
);


ALTER TABLE "public"."settlements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."space_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "space_id" "uuid" NOT NULL,
    "token_hash" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "revoked_at" timestamp with time zone,
    "max_uses" integer DEFAULT 10 NOT NULL,
    "use_count" integer DEFAULT 0 NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "space_invitations_max_uses_check" CHECK ((("max_uses" >= 1) AND ("max_uses" <= 50)))
);


ALTER TABLE "public"."space_invitations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."space_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "space_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "public"."member_role" DEFAULT 'member'::"public"."member_role" NOT NULL,
    "status" "public"."member_status" DEFAULT 'active'::"public"."member_status" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "left_at" timestamp with time zone
);


ALTER TABLE "public"."space_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."spaces" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "public"."space_type" DEFAULT 'shared_home'::"public"."space_type" NOT NULL,
    "currency" "text" DEFAULT 'USD'::"text" NOT NULL,
    "default_split" "public"."split_method" DEFAULT 'equal'::"public"."split_method" NOT NULL,
    "inbound_token" "text" DEFAULT "encode"("extensions"."gen_random_bytes"(9), 'hex'::"text") NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "spaces_currency_check" CHECK (("currency" = 'USD'::"text")),
    CONSTRAINT "spaces_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 1) AND ("char_length"(TRIM(BOTH FROM "name")) <= 60)))
);


ALTER TABLE "public"."spaces" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."statements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "space_id" "uuid" NOT NULL,
    "source" "public"."statement_source" NOT NULL,
    "file_path" "text",
    "file_name" "text",
    "sender" "text",
    "kind" "text" DEFAULT 'statement'::"text" NOT NULL,
    "provider" "text",
    "amount_cents" bigint,
    "due_date" "date",
    "period_start" "date",
    "period_end" "date",
    "account_last4" "text",
    "statement_ref" "text",
    "statement_key" "text",
    "reasons" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "parser_version" "text" NOT NULL,
    "status" "public"."statement_status" NOT NULL,
    "revision_of" "uuid",
    "bill_id" "uuid",
    "created_by" "uuid",
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "decided_by" "uuid",
    "decided_at" timestamp with time zone,
    CONSTRAINT "statements_account_last4_check" CHECK (("account_last4" ~ '^\d{1,4}$'::"text")),
    CONSTRAINT "statements_amount_cents_check" CHECK (("amount_cents" >= 0)),
    CONSTRAINT "statements_file_name_check" CHECK (("char_length"("file_name") <= 200)),
    CONSTRAINT "statements_kind_check" CHECK (("kind" = ANY (ARRAY['statement'::"text", 'notice_only'::"text", 'unreadable'::"text"]))),
    CONSTRAINT "statements_sender_check" CHECK (("char_length"("sender") <= 200))
);


ALTER TABLE "public"."statements" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activity"
    ADD CONSTRAINT "activity_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bill_splits"
    ADD CONSTRAINT "bill_splits_bill_id_member_id_key" UNIQUE ("bill_id", "member_id");



ALTER TABLE ONLY "public"."bill_splits"
    ADD CONSTRAINT "bill_splits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."bills"
    ADD CONSTRAINT "bills_client_request_id_key" UNIQUE ("client_request_id");



ALTER TABLE ONLY "public"."bills"
    ADD CONSTRAINT "bills_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_prefs"
    ADD CONSTRAINT "notification_prefs_pkey" PRIMARY KEY ("user_id", "space_id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reminders"
    ADD CONSTRAINT "reminders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settlements"
    ADD CONSTRAINT "settlements_client_request_id_key" UNIQUE ("client_request_id");



ALTER TABLE ONLY "public"."settlements"
    ADD CONSTRAINT "settlements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."space_invitations"
    ADD CONSTRAINT "space_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."space_invitations"
    ADD CONSTRAINT "space_invitations_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."space_members"
    ADD CONSTRAINT "space_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."spaces"
    ADD CONSTRAINT "spaces_inbound_token_key" UNIQUE ("inbound_token");



ALTER TABLE ONLY "public"."spaces"
    ADD CONSTRAINT "spaces_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."statements"
    ADD CONSTRAINT "statements_pkey" PRIMARY KEY ("id");



CREATE INDEX "activity_space" ON "public"."activity" USING "btree" ("space_id", "created_at" DESC);



CREATE INDEX "bills_space" ON "public"."bills" USING "btree" ("space_id", "due_date");



CREATE UNIQUE INDEX "space_members_one_active" ON "public"."space_members" USING "btree" ("space_id", "user_id") WHERE ("status" = 'active'::"public"."member_status");



CREATE INDEX "space_members_user" ON "public"."space_members" USING "btree" ("user_id");



CREATE INDEX "statements_key" ON "public"."statements" USING "btree" ("space_id", "statement_key");



CREATE INDEX "statements_space" ON "public"."statements" USING "btree" ("space_id", "received_at" DESC);



ALTER TABLE ONLY "public"."activity"
    ADD CONSTRAINT "activity_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."activity"
    ADD CONSTRAINT "activity_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bill_splits"
    ADD CONSTRAINT "bill_splits_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bill_splits"
    ADD CONSTRAINT "bill_splits_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."space_members"("id");



ALTER TABLE ONLY "public"."bills"
    ADD CONSTRAINT "bills_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."bills"
    ADD CONSTRAINT "bills_payer_member_id_fkey" FOREIGN KEY ("payer_member_id") REFERENCES "public"."space_members"("id");



ALTER TABLE ONLY "public"."bills"
    ADD CONSTRAINT "bills_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."bills"
    ADD CONSTRAINT "bills_statement_fk" FOREIGN KEY ("statement_id") REFERENCES "public"."statements"("id");



ALTER TABLE ONLY "public"."notification_prefs"
    ADD CONSTRAINT "notification_prefs_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_prefs"
    ADD CONSTRAINT "notification_prefs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reminders"
    ADD CONSTRAINT "reminders_bill_split_id_fkey" FOREIGN KEY ("bill_split_id") REFERENCES "public"."bill_splits"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reminders"
    ADD CONSTRAINT "reminders_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."settlements"
    ADD CONSTRAINT "settlements_bill_split_id_fkey" FOREIGN KEY ("bill_split_id") REFERENCES "public"."bill_splits"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."settlements"
    ADD CONSTRAINT "settlements_confirmed_by_fkey" FOREIGN KEY ("confirmed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."settlements"
    ADD CONSTRAINT "settlements_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."space_invitations"
    ADD CONSTRAINT "space_invitations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."space_invitations"
    ADD CONSTRAINT "space_invitations_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."space_members"
    ADD CONSTRAINT "space_members_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."space_members"
    ADD CONSTRAINT "space_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."spaces"
    ADD CONSTRAINT "spaces_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."statements"
    ADD CONSTRAINT "statements_bill_id_fkey" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id");



ALTER TABLE ONLY "public"."statements"
    ADD CONSTRAINT "statements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."statements"
    ADD CONSTRAINT "statements_decided_by_fkey" FOREIGN KEY ("decided_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."statements"
    ADD CONSTRAINT "statements_revision_of_fkey" FOREIGN KEY ("revision_of") REFERENCES "public"."statements"("id");



ALTER TABLE ONLY "public"."statements"
    ADD CONSTRAINT "statements_space_id_fkey" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE CASCADE;



ALTER TABLE "public"."activity" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bill_splits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."bills" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "members read activity" ON "public"."activity" FOR SELECT USING ("public"."was_space_member"("space_id"));



CREATE POLICY "members read bills" ON "public"."bills" FOR SELECT USING ("public"."was_space_member"("space_id"));



CREATE POLICY "members read members" ON "public"."space_members" FOR SELECT USING ("public"."was_space_member"("space_id"));



CREATE POLICY "members read reminders" ON "public"."reminders" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."bill_splits" "s"
     JOIN "public"."bills" "b" ON (("b"."id" = "s"."bill_id")))
  WHERE (("s"."id" = "reminders"."bill_split_id") AND "public"."was_space_member"("b"."space_id")))));



CREATE POLICY "members read settlements" ON "public"."settlements" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."bill_splits" "s"
     JOIN "public"."bills" "b" ON (("b"."id" = "s"."bill_id")))
  WHERE (("s"."id" = "settlements"."bill_split_id") AND "public"."was_space_member"("b"."space_id")))));



CREATE POLICY "members read space" ON "public"."spaces" FOR SELECT USING ("public"."was_space_member"("id"));



CREATE POLICY "members read splits" ON "public"."bill_splits" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."bills" "b"
  WHERE (("b"."id" = "bill_splits"."bill_id") AND "public"."was_space_member"("b"."space_id")))));



CREATE POLICY "members read statements" ON "public"."statements" FOR SELECT USING ("public"."was_space_member"("space_id"));



ALTER TABLE "public"."notification_prefs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "own prefs" ON "public"."notification_prefs" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "own profile or co-member" ON "public"."profiles" FOR SELECT USING ((("id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM ("public"."space_members" "a"
     JOIN "public"."space_members" "b" ON (("a"."space_id" = "b"."space_id")))
  WHERE (("a"."user_id" = "auth"."uid"()) AND ("b"."user_id" = "profiles"."id"))))));



CREATE POLICY "owners read invitations" ON "public"."space_invitations" FOR SELECT USING ("public"."is_space_owner"("space_id"));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reminders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."settlements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."space_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."space_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."spaces" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."statements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "update own profile" ON "public"."profiles" FOR UPDATE USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































REVOKE ALL ON FUNCTION "public"."_ingest_statement"("p_space" "uuid", "p_actor" "uuid", "p_source" "public"."statement_source", "p_file_path" "text", "p_file_name" "text", "p_sender" "text", "p_kind" "text", "p_provider" "text", "p_amount_cents" bigint, "p_due_date" "date", "p_period_start" "date", "p_period_end" "date", "p_account_last4" "text", "p_statement_ref" "text", "p_statement_key" "text", "p_reasons" "text"[], "p_parser_version" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."_ingest_statement"("p_space" "uuid", "p_actor" "uuid", "p_source" "public"."statement_source", "p_file_path" "text", "p_file_name" "text", "p_sender" "text", "p_kind" "text", "p_provider" "text", "p_amount_cents" bigint, "p_due_date" "date", "p_period_start" "date", "p_period_end" "date", "p_account_last4" "text", "p_statement_ref" "text", "p_statement_key" "text", "p_reasons" "text"[], "p_parser_version" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."accept_invitation"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."accept_invitation"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."confirm_settlement"("p_settlement" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."confirm_settlement"("p_settlement" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_bill"("p_space" "uuid", "p_title" "text", "p_category" "text", "p_amount_cents" bigint, "p_payer_member" "uuid", "p_bill_date" "date", "p_due_date" "date", "p_note" "text", "p_split_method" "public"."split_method", "p_shares" "jsonb", "p_client_request_id" "uuid", "p_period_start" "date", "p_period_end" "date", "p_source" "public"."bill_source", "p_statement" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_bill"("p_space" "uuid", "p_title" "text", "p_category" "text", "p_amount_cents" bigint, "p_payer_member" "uuid", "p_bill_date" "date", "p_due_date" "date", "p_note" "text", "p_split_method" "public"."split_method", "p_shares" "jsonb", "p_client_request_id" "uuid", "p_period_start" "date", "p_period_end" "date", "p_source" "public"."bill_source", "p_statement" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_invitation"("p_space" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_invitation"("p_space" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_space"("p_name" "text", "p_type" "public"."space_type") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_space"("p_name" "text", "p_type" "public"."space_type") TO "service_role";



GRANT ALL ON FUNCTION "public"."deactivate_member"("p_member" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."deactivate_member"("p_member" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."dispute_settlement"("p_settlement" "uuid", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."dispute_settlement"("p_settlement" "uuid", "p_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."dispute_split"("p_split" "uuid", "p_note" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."dispute_split"("p_split" "uuid", "p_note" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."ingest_emailed_statement"("p_inbound_token" "text", "p_sender" "text", "p_file_path" "text", "p_file_name" "text", "p_kind" "text", "p_provider" "text", "p_amount_cents" bigint, "p_due_date" "date", "p_period_start" "date", "p_period_end" "date", "p_account_last4" "text", "p_statement_ref" "text", "p_statement_key" "text", "p_reasons" "text"[], "p_parser_version" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."ingest_emailed_statement"("p_inbound_token" "text", "p_sender" "text", "p_file_path" "text", "p_file_name" "text", "p_kind" "text", "p_provider" "text", "p_amount_cents" bigint, "p_due_date" "date", "p_period_start" "date", "p_period_end" "date", "p_account_last4" "text", "p_statement_ref" "text", "p_statement_key" "text", "p_reasons" "text"[], "p_parser_version" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."ingest_uploaded_statement"("p_space" "uuid", "p_file_path" "text", "p_file_name" "text", "p_kind" "text", "p_provider" "text", "p_amount_cents" bigint, "p_due_date" "date", "p_period_start" "date", "p_period_end" "date", "p_account_last4" "text", "p_statement_ref" "text", "p_statement_key" "text", "p_reasons" "text"[], "p_parser_version" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ingest_uploaded_statement"("p_space" "uuid", "p_file_path" "text", "p_file_name" "text", "p_kind" "text", "p_provider" "text", "p_amount_cents" bigint, "p_due_date" "date", "p_period_start" "date", "p_period_end" "date", "p_account_last4" "text", "p_statement_ref" "text", "p_statement_key" "text", "p_reasons" "text"[], "p_parser_version" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_space_member"("p_space" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_space_member"("p_space" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_space_owner"("p_space" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_space_owner"("p_space" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."log_activity"("p_space" "uuid", "p_type" "text", "p_id" "uuid", "p_action" "text", "p_meta" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."log_activity"("p_space" "uuid", "p_type" "text", "p_id" "uuid", "p_action" "text", "p_meta" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."member_user"("p_member" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."member_user"("p_member" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."my_member_id"("p_space" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."my_member_id"("p_space" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."preview_invitation"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."preview_invitation"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."publish_statement"("p_statement" "uuid", "p_title" "text", "p_category" "text", "p_amount_cents" bigint, "p_payer_member" "uuid", "p_due_date" "date", "p_period_start" "date", "p_period_end" "date", "p_split_method" "public"."split_method", "p_shares" "jsonb", "p_client_request_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."publish_statement"("p_statement" "uuid", "p_title" "text", "p_category" "text", "p_amount_cents" bigint, "p_payer_member" "uuid", "p_due_date" "date", "p_period_start" "date", "p_period_end" "date", "p_split_method" "public"."split_method", "p_shares" "jsonb", "p_client_request_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."reject_statement"("p_statement" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."reject_statement"("p_statement" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."report_settlement"("p_split" "uuid", "p_amount_cents" bigint, "p_method" "text", "p_note" "text", "p_client_request_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."report_settlement"("p_split" "uuid", "p_amount_cents" bigint, "p_method" "text", "p_note" "text", "p_client_request_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."report_utility_paid"("p_bill" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."report_utility_paid"("p_bill" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_split_dispute"("p_split" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_split_dispute"("p_split" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."revoke_invitation"("p_invitation" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revoke_invitation"("p_invitation" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."send_reminder"("p_split" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."send_reminder"("p_split" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_member_role"("p_member" "uuid", "p_role" "public"."member_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_member_role"("p_member" "uuid", "p_role" "public"."member_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_bill"("p_bill" "uuid", "p_version" integer, "p_title" "text", "p_category" "text", "p_due_date" "date", "p_note" "text", "p_amount_cents" bigint, "p_split_method" "public"."split_method", "p_shares" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_bill"("p_bill" "uuid", "p_version" integer, "p_title" "text", "p_category" "text", "p_due_date" "date", "p_note" "text", "p_amount_cents" bigint, "p_split_method" "public"."split_method", "p_shares" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_display_name"("p_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_display_name"("p_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_notification_prefs"("p_space" "uuid", "p_bill_arrival" boolean, "p_days" integer[], "p_opt_out" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_notification_prefs"("p_space" "uuid", "p_bill_arrival" boolean, "p_days" integer[], "p_opt_out" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_space"("p_space" "uuid", "p_name" "text", "p_type" "public"."space_type", "p_default_split" "public"."split_method") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_space"("p_space" "uuid", "p_name" "text", "p_type" "public"."space_type", "p_default_split" "public"."split_method") TO "service_role";



GRANT ALL ON FUNCTION "public"."void_bill"("p_bill" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."void_bill"("p_bill" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."was_space_member"("p_space" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."was_space_member"("p_space" "uuid") TO "service_role";


















GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."activity" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."activity" TO "authenticated";
GRANT ALL ON TABLE "public"."activity" TO "service_role";



GRANT ALL ON SEQUENCE "public"."activity_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."activity_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."activity_id_seq" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."bill_splits" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."bill_splits" TO "authenticated";
GRANT ALL ON TABLE "public"."bill_splits" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."bills" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."bills" TO "authenticated";
GRANT ALL ON TABLE "public"."bills" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."notification_prefs" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."notification_prefs" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_prefs" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reminders" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."reminders" TO "authenticated";
GRANT ALL ON TABLE "public"."reminders" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."settlements" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."settlements" TO "authenticated";
GRANT ALL ON TABLE "public"."settlements" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."space_invitations" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."space_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."space_invitations" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."space_members" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."space_members" TO "authenticated";
GRANT ALL ON TABLE "public"."space_members" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."spaces" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."spaces" TO "authenticated";
GRANT ALL ON TABLE "public"."spaces" TO "service_role";



GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."statements" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."statements" TO "authenticated";
GRANT ALL ON TABLE "public"."statements" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































