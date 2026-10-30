# eqlTab inbound email (Cloudflare)

Receives mail sent to a Space's private address (`bills+<token>@eqltab.com`) and hands it to the app.

```
bill email -> Cloudflare Email Routing (catch-all) -> this Worker -> POST /api/inbound/email -> Auto Bills review
```

The Worker only accepts `bills+<18 hex>@...`. Any other address is refused ("Address not found"), so other mail to the domain never reaches the app.

## Setup

1. **Install:** `cd cloudflare-email-worker && npm install`
2. **Point at the live site:** set `WEBHOOK_URL` in `wrangler.toml` to the deployed app (not localhost). It is `https://eqltab.com/api/inbound/email`.
3. **Log in:** `npx wrangler login`
4. **Set the shared secret:** `npx wrangler secret put WEBHOOK_SECRET` and type a long random value. The app must have the *same* value as `INBOUND_WEBHOOK_SECRET`. Never commit it or paste it into chat.
5. **Deploy:** `npm run deploy`. If it asks about a workers.dev subdomain, answer **n**. "No targets deployed" is normal: the Worker has no web address and runs only when Email Routing gives it mail.
6. **Turn on Email Routing** for the domain: Cloudflare > the domain > Email > Email Routing, and accept the MX/TXT records it offers to add. This replaces any existing MX records, so skip it if the domain receives other mail.
7. **Route the mail:** Routing rules > **Catch-all address** > action **Send to a Worker** > `eqltab-inbound-email` > **Active** > Save. (Do not use "Send to an email" or a specific-address rule; each Space has its own address.)
8. **Keep your own addresses:** add a rule per address (`support@`, `help@`, ...) with action **Send to an email** and your Gmail as the destination. A specific rule wins over the catch-all.
9. **Set these on the live site's host (Production) and redeploy:**
   - `NEXT_PUBLIC_INBOUND_EMAIL_DOMAIN=eqltab.com` (the domain you routed, with no `bills.` prefix; it is baked in at build time)
   - `INBOUND_WEBHOOK_SECRET` (same value as the Worker's `WEBHOOK_SECRET`)
   - `SUPABASE_SERVICE_ROLE_KEY`
10. **Apply the database migrations:** `cd web && supabase db push` (check with `supabase migration list`).

## Test

1. Run `npx wrangler tail` in this folder.
2. Copy a Space's address from its Auto Bills page and email or forward a bill to it.
3. The tail should show `Ok`. The bill then appears on Auto Bills for review.

## If it fails

| Tail or log says | Cause |
| --- | --- |
| Worker never runs (0 invocations) | Wrong domain in the address (for example `bills.eqltab.com`), Email Routing off, or the catch-all is not set to the Worker |
| `webhook answered 503` | The live site is missing `INBOUND_WEBHOOK_SECRET` or `SUPABASE_SERVICE_ROLE_KEY`, or was not redeployed |
| `webhook answered 401` | The secrets do not match. Run `npx wrangler secret put WEBHOOK_SECRET` again with the app's value |
| `webhook answered 404` | The live site does not have the `/api/inbound/email` route deployed yet |
| "Address not found" bounce | The recipient is not a `bills+<18 hex>@` address |

The Worker has no logs of its own unless Workers Logs is enabled; `wrangler tail` shows runs live either way.
