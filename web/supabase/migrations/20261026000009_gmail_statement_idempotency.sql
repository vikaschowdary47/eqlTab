-- A Gmail message is an idempotent import. Keep one reviewable copy per Space
-- and message, while preserving any statement that has already become a bill.
with ranked as (
  select
    id,
    row_number() over (
      partition by space_id, statement_ref
      order by received_at desc, id desc
    ) as duplicate_rank
  from statements
  where source = 'email'
    and statement_ref is not null
    and status <> 'published'
    and bill_id is null
)
delete from statements s
using ranked r
where s.id = r.id
  and r.duplicate_rank > 1;

create unique index if not exists statements_email_message_unpublished_once
  on statements (space_id, statement_ref)
  where source = 'email'
    and statement_ref is not null
    and status <> 'published';
