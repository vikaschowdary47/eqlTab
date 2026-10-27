# eqlTab web

Next.js 15 (App Router, TypeScript, Tailwind 4) + Supabase. Product source of truth: `../EQLSHARE_MASTER_BUILD_SPEC_V0.3.md`.

## Setup

1. `cp .env.example .env.local` and fill in your Supabase URL and anon key.
2. Apply the migrations to your project: `supabase link --project-ref <ref>` then `supabase db push`.
3. In Supabase Auth settings, set the Site URL to `NEXT_PUBLIC_SITE_URL` and add `<site>/auth/callback` to the redirect URLs.
4. Google sign-in: in Google Cloud, create an OAuth client (Web) with redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`, then in Supabase > Authentication > Providers enable Google with that client ID and secret. Sign-in asks only for name and email; Gmail is a separate, later permission.
5. `supabase db push` again after pulling: `20261027000010` (Google names) and `20261027000011` (AI limits) are new.
6. `npm install && npm run dev`. Sample screens with fake data: `/dev/preview?v=dashboard|receipt|settled|login` (development only).

## Checks

- `npx vitest run`: domain tests (cent-exact splits, balances, due states, statement parsing)
- `npm run lint`, `npx tsc --noEmit`, `npm run build`
- `scripts/test-db.sh`: applies every migration to a throwaway Postgres (with `supabase/tests/supabase_shim.sql` standing in for Supabase auth) and runs the authorization and Auto Bills tests. Set `PGHOST`, `PGPORT` and `PGUSER` for a local Postgres.

## Architecture

- `src/lib/domain/`: pure business rules shared by UI and server (money in integer cents, splits, balances, due states, statement extraction). No I/O.
- `supabase/migrations/`: schema, RLS (members can read their Space), and SECURITY DEFINER functions. **All writes go through these functions**, which re-validate every money invariant and permission. Clients have no insert/update/delete grants.
- `src/lib/actions.ts`: server actions that call those functions and turn database error codes into plain-English messages.
- `src/app/s/[spaceId]/…`: the app (Home, Bills, Activity, Space, Auto Bills).
- Space type (`shared_home | couple | family | group`) is a preset that changes labels and defaults only.

## AI entry (spec section 19)

- Quick Add (`src/lib/domain/quick-add.ts`): common phrasings ("Indian grocery 230 divide among all") are parsed in the browser, free and instant. Only unusual ones ("costco 184.40, Ana owes 40, rest equal") call Gemini through `quickAddAiAction`. The model returns words and amounts; `resolveQuickAdd` matches names (asks when unsure) and `splitBill` does the math.
- Receipt scan (`src/lib/domain/receipt.ts`): Gemini reads the lines; `splitReceipt` splits each item between the people picked for it, shares tax/tip/fees by what each person bought (or equally), and rounds once with largest remainder. Saving is blocked until the lines match the printed total. Saved as a normal exact-split bill with a short "who had what" note; receipt images are never stored.
- Limits: `begin_ai_request` allows 30 Quick Add and 20 receipt calls per user per hour, separate from Splitwise imports.

## Not in this build (by design)

No bank connections, payments or fund transfers. Email forwarding works only when `INBOUND_WEBHOOK_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` are set and an inbound email provider posts to `/api/inbound/email`. Until then, use PDF upload. Reminder emails aren't sent; reminders are shareable links.

## Import from Splitwise

Screenshot-first; Splitwise is never contacted. `src/lib/import/extract.ts` is the only file that knows the vision provider (Gemini, `GEMINI_MODEL`, default `gemini-3.1-flash-lite`). Pure logic (validation, merging, duplicate detection, debt simplification, review checks) lives in `src/lib/domain/import.ts`. Opening balances are bills with `source = 'import'`: no due date, no reminders, settled through the normal report/confirm flow. People who haven't joined are placeholder members (`user_id` null) with single-use claim links (`/claim/<hex>`).

Live extraction check (spends a fraction of a cent): `GEMINI_LIVE=1 node --env-file=.env node_modules/.bin/vitest run tests/gemini.live.test.ts`
