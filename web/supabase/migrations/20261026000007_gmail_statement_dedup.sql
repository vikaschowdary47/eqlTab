-- Gmail scans use statement_ref for lookup, but older rows may contain a bill's
-- statement number there. Keep this index non-unique; the sync route performs
-- identity-aware deduplication before inserting.
create index statements_email_message_lookup
  on statements (space_id, statement_ref)
  where source = 'email' and statement_ref is not null;
