-- Per-user Gmail OAuth connections. Refresh tokens are encrypted by the server.
create table gmail_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  gmail_address text not null check (char_length(gmail_address) <= 320),
  refresh_token_ciphertext text not null,
  scopes text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'revoked', 'error')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, gmail_address)
);

alter table gmail_connections enable row level security;
create policy "users read their Gmail connections" on gmail_connections for select using (auth.uid() = user_id);
revoke insert, update, delete on gmail_connections from anon, authenticated;
