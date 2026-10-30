-- A daily job emails people whose share of a bill is coming due. This log makes sure each person gets
-- each reminder (for example "2 days before") at most once per bill, even if the job runs twice.
-- Only ids and a number are kept: no email address, name or message text.
create table due_reminder_sends (
  bill_split_id uuid not null references bill_splits on delete cascade,
  days_before int not null check (days_before between 0 and 14),
  sent_on date not null default current_date,
  primary key (bill_split_id, days_before)
);

alter table due_reminder_sends enable row level security;
revoke all on due_reminder_sends from anon, authenticated;
