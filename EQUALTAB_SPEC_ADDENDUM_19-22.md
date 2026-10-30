## 19. AI Quick Add and itemized receipt splitting (October 26, 2026)

> Addendum to the Master Specification (v0.3). Product name in the live demo is **Equal Tab / eqlTab** (`eqltab.com`); earlier sections say Eqlshare. Same product.
> **Status:** Proposed feature. Before building, inspect the existing code — a Gemini API integration may already exist; reuse it rather than adding a second AI path.

### 19.1 Principle: AI drafts, the domain engine calculates, the user confirms

- The AI model only **extracts structure** (title, amount, people, items, prices). It never performs the final split arithmetic.
- All money math runs in `packages/domain` (or the equivalent module) using integer cents, the same functions tested in §9.
- Nothing created by AI is saved or published without a confirmation screen. No silent writes.
- If the model is unsure, it asks one short question or leaves the field blank for the user — it never guesses an amount, a person, or a due date.

### 19.1a Hard rule: the math is invisible, the UI is simple

If a user is confused for even a moment, they will switch apps. Simplicity is a requirement, not polish — a feature that works but confuses people is not done.

- **The user only touches exceptions.** Everything starts shared by everyone. The user only acts on the few items that are different.
- **One screen to assign items.** No multi-step wizard, no separate tax screen, no settings to configure first.
- **No math on screen by default.** Show each person's final amount, not formulas, percentages, or "proportional tax" explanations. A small "How was this calculated?" link can reveal the breakdown for anyone who wants it.
- **Plain words only.** "Only Raj", "Everyone", "Raj's total $76.25" — never "allocation", "remainder", "pro-rata", or "participants".
- **Tap targets, not forms.** Assigning is tapping people and items. No typing amounts unless fixing a misread price.
- **Tap budget:** the common case (receipt with 1–3 personal items, rest shared) must take **under 10 taps** from "Scan receipt" to "Save". Quick Add common case: type one line, tap Save — **1 tap**.
- **Errors say what to do.** "1 item has no one assigned — tap it to pick who" instead of "Validation failed".
- **Usability test before shipping:** hand it to 3 roommates who have never seen the app, give them a real receipt, say nothing. If any of them gets stuck or asks a question, simplify and retest.

---

### 19.2 Feature A — Quick Add (type a bill in plain language)

**What it does:** A single text box (and later voice) where a user types something like:

| User types | Draft created |
|---|---|
| `Indian grocery 230 divide among all` | Title "Indian grocery", category Groceries, $230.00, paid by me, all active members, equal split |
| `wifi 65 split with Raj and Priya` | $65.00, paid by me, me + Raj + Priya, equal |
| `Raj paid 120 for dinner, split 3 ways with me and Ana` | $120.00, payer Raj, Raj + me + Ana, equal |
| `costco 184.40, Ana owes 40, rest equal` | $184.40, Ana fixed $40.00, remainder split equally among the rest |
| `uber 30` | $30.00, paid by me — asks: "Split with whom?" |

**Defaults (when not stated):** payer = current user; participants = all active members of the current Space; split = equal; date = today; currency = Space currency.

**Flow:**
1. User taps **Add** → **Quick Add** text field (placeholder: `e.g. Indian grocery 230 split with everyone`).
2. Server sends the text + list of the Space's member display names (no emails, no balances) to the model with a strict JSON schema output.
3. Server validates the JSON (schema + amount > 0 + every named person matches exactly one active member).
4. Show a **draft card**: title, amount, payer, participants, split type, per-person shares computed by the domain engine.
5. User taps **Save** or **Edit** (opens the normal Add Bill form pre-filled).

**Name matching rules:**
- Match case-insensitively against display names and nicknames; if a name matches zero or multiple members, highlight it and ask the user to pick.
- "all / everyone / everybody / divide among all" → all active members.
- "me / I" → current user.
- Never create new members from Quick Add.

**Structured output (model → server):**
```json
{
  "title": "Indian grocery",
  "category": "groceries",
  "amount": "230.00",
  "payer": "me",
  "participants": "all",
  "split": { "type": "equal" },
  "fixed_shares": [],
  "date": null,
  "needs_clarification": null
}
```
Amounts arrive as decimal strings and are converted to cents server-side (`"230.00"` → `23000`). Reject anything with more than two decimals.

---

### 19.3 Feature B — Receipt scan with item-by-item assignment

**What it does:** User uploads a photo or screenshot of a receipt. The AI reads every line item, then the user decides **who shares each item** with checkboxes. Items bought for one person go only to that person; everything else is shared.

**Flow:**
1. **Add → Scan receipt** (camera or photo library / screenshot).
2. Image stored in **private storage**; sent to the model server-side only.
3. Model returns: store name, date, line items (`label`, `quantity`, `price`), discounts (negative lines), subtotal, tax, fees/tip, total.
4. **Reconciliation check:** `sum(items) + discounts + tax + fees` must equal `total` (to the cent). If not, show a yellow banner: *"Items don't add up to the receipt total ($X difference). Check the highlighted lines."* User can edit any line or add a missing one. Save is blocked until it reconciles.
5. **Assign screen** (the core of this feature):
   - Every item is listed with its price and a row of member avatars/checkboxes. **Default: all members checked** (shared by everyone).
   - Tap an item → toggle who shares it. Uncheck everyone except Raj → that item is Raj's alone.
   - **Assign mode (faster):** tap a person at the top ("Raj"), then tap the items that are only his. Those items become Raj-only; everything untouched stays shared by all.
   - Quick actions: **Select all**, **Clear**, **Only me**, **Shared by all**.
   - An item with zero people checked is flagged and blocks Save.
6. **Tax, tip and fees** are split in proportion to each person's item subtotal (default). Option: split them equally.
7. **Live summary** at the bottom: each person's total, updating as boxes are ticked, plus "Total assigned $230.00 of $230.00 ✓".
8. **Save** → one bill with per-member splits (same `bill_splits` as any other bill), plus the item detail stored for transparency.

**Worked example (the one you described):**
- Receipt total $230.00, four roommates, no tax.
- Two items only for Raj: Mango pickle $18.00 + Paneer $7.00 = $25.00 → Raj only.
- Remaining items $205.00 → shared by all four → $51.25 each.
- Result: Raj **$76.25**, the other three **$51.25** each. Check: 76.25 + 3 × 51.25 = 230.00 ✓

**Rounding rule:** Compute each person's exact fractional share across all items, tax and fees, then round **once** at the end using largest-remainder allocation so the shares sum exactly to the total. (Rounding per item would always push extra pennies to the same person.)

**Member view:** Members can open the bill and see which items were assigned to them, so the split is explainable — not just a number.

---

### 19.4 Data model additions

- `bill_items`: `id`, `bill_id`, `label`, `quantity`, `amount_cents` (can be negative for discounts), `kind` (`item | discount | tax | fee | tip`), `position`, `source` (`ai | manual`), `created_at`.
- `bill_item_assignments`: `bill_item_id`, `member_id`; unique pair.
- `ai_extractions`: `id`, `space_id`, `bill_id?`, `input_type` (`text | image`), `model`, `prompt_version`, `raw_output` (redacted JSON), `status` (`draft | confirmed | discarded | failed`), `created_by`, `created_at`.
- **Constraint:** `bill_splits` remain the single source of truth for what each person owes. Item data explains the splits; it never overrides them. Splits must still sum exactly to the bill total.
- Editing items or assignments after save recalculates splits only through the normal edit path, with an audit event. Confirmed settlements are not silently rewritten (§3C).

### 19.5 Security, privacy and cost

- All AI calls happen server-side; the Gemini API key never reaches the browser or app.
- Send only what's needed: the text or image, and member display names. No emails, balances, or other Spaces' data.
- Receipt images go in a private bucket with short-lived signed URLs; offer deletion after the bill is saved.
- Check Gemini's data-use terms for the API tier used and state the truth in the privacy policy (whether inputs may be used for training or reviewed).
- Rate-limit per user and per Space (e.g. 30 AI requests/day on free) to cap API cost; log token/image usage per request for the unit economics in §17.4.
- Treat model output as untrusted input: validate against the schema, never execute it, escape all labels in the UI (a receipt line could contain text like "ignore previous instructions").
- Analytics events: `quick_add_used`, `quick_add_confirmed`, `receipt_scanned`, `receipt_reconciled`, `receipt_split_saved` — no amounts, item names, or images.

### 19.6 Tests

**Domain unit tests**
- `"Indian grocery 230 divide among all"` with 4 members → `[5750, 5750, 5750, 5750]`.
- Receipt example above → Raj `7625`, others `5125` each; sum `23000`.
- Proportional tax: items A `6000`, B `4000`, tax `800` → A `480`, B `320` tax.
- Shared $10.00 across 3 people on each of 3 items → final shares sum to `3000`, and the extra cents are not all given to the same person.
- Discount line reduces only the shares of the people assigned to it.
- Item with zero assignees → save rejected.
- Items not reconciling with total → save rejected.

**AI/parsing tests (fixtures, mocked model)**
- Ambiguous name ("split with Sam" when two Sams exist) → clarification, not a guess.
- Missing amount ("groceries split with all") → asks for amount.
- Malformed or extra-decimal JSON → rejected safely.
- Name not in Space → highlighted, no new member created.
- Prompt-injection text inside a receipt line → stored as plain label, no behavior change.

**Authorization**
- A user cannot scan into, or assign items to members of, a Space they don't belong to.
- Receipt images from Space A are not readable by Space B members.

### 19.7 Scope and order

- **Quick Add:** build after Milestone 2 (bills and equal/custom splits must exist). Small, high-delight feature; good for the demo and YC video.
- **Receipt itemization:** build after Quick Add. It's P1 "AI-assisted extraction" (§2) extended to line items — always user-reviewed.
- **Not in scope yet:** voice input, auto-detecting who bought what from purchase history, splitting from bank/card transactions.
- **Where it pays off:** directly supports the "Indian grocery run" use case for international-student households (§17.11), which Splitwise handles only as a single lump sum unless items are entered by hand. Verify Splitwise's current receipt-scanning feature set before claiming this as a differentiator.

## 20. App-wide simplicity rules (October 26, 2026)

> Addendum to the Master Specification. Applies to **every** feature, not only AI entry (§19.1a). Where earlier sections describe a more complex flow, this section governs the UI; the underlying data rules and security from §7–§8 still apply.

### 20.1 Rules for every screen

- **One job per screen, one obvious button.** If a screen needs explaining, redesign the screen.
- **Smart defaults; the user only changes exceptions.** Equal split, everyone included, paid by me, today's date.
- **Plain words.** "Space", "Bill", "You owe", "Owed to you", "Paid". Never "allocation", "settlement", "participants", "reconcile" in the UI.
- **No math on screen** unless the user taps "How was this calculated?".
- **Errors say what to do next**, in one sentence.
- **Tap budgets are acceptance criteria.** If a flow goes over budget, it is not done.
- **Usability check before any feature ships:** 3 people who have never seen the app complete the flow without help or questions.

---

### 20.2 Space switcher (top bar)

The current Space must always be obvious, so nobody adds a bill to the wrong group.

- **Location:** top bar of every main screen (mobile and desktop).
- **Look:** a highlighted pill showing the Space name, its type icon, and a ▾ chevron — e.g. `🏠 Maple Apartment ▾`. Uses the teal accent background (light tint) so it stands out from the rest of the header. Highlighting uses shape + icon + text, not color alone (accessibility rule from §5).
- **Tap:** opens a bottom sheet (mobile) / dropdown (desktop) listing the user's Spaces, each with its name, member avatars, and the user's net balance (`You owe $46.10` / `Settled up`). Current Space has a checkmark.
- **Bottom of the list:** `+ New Space` and `Join with a link`.
- **After switching:** the whole screen updates and the pill shows the new name; a brief toast `Switched to Weekend Trip`.
- **Safety:** the Add Bill, Quick Add and Scan Receipt screens show `Adding to: Maple Apartment` at the top, tappable to change.
- **If the user has only one Space:** still show the pill (so they learn where it is), but the sheet just shows that Space plus `+ New Space`.
- **Tap budget:** switch Space = **2 taps**.

---

### 20.3 Inviting people

Goal: the invite should feel like sending a link in WhatsApp, because that's what it is.

**Inviter flow**
1. `Invite` button on the Space screen and in the empty dashboard.
2. Opens one screen with:
   - **Share invite link** (primary) → native share sheet (WhatsApp, iMessage, Instagram, etc.).
   - **Copy link**.
   - **Show QR code** — for roommates in the same room.
   - Email invite is optional and secondary; never required.
3. Pending invites show as `Waiting for Raj…` style rows only if invited by name/email; link invites show `3 people joined from your link`.
- **Tap budget:** **2 taps** (Invite → Share).

**Invitee flow**
1. Opens the link → page says `Arjun invited you to Maple Apartment` with member avatars. No app download required.
2. `Join` → sign in with Google / Apple / email magic link (no password to create).
3. Lands directly in the Space dashboard, already showing what they owe (if anything).
- **Budget:** **3 screens max** from tapping the link to seeing the dashboard.

**Behind the scenes (unchanged from §8):** expiring, revocable, hashed tokens; rate limits; invitee sees only the Space name and inviter before joining. Owner can reset the link with one tap if it was shared too widely.

---

### 20.4 Importing from Splitwise

Goal: move a group over in about a minute, without the user having to understand CSVs or reconciliation.

**Default path — "Bring my balances" (simplest, recommended)**
1. `Import from Splitwise` on the onboarding screen and in Space settings.
2. Short 3-step visual guide with screenshots showing how to export the group from Splitwise. (Verify Splitwise's current export steps and file format before building; don't promise a direct Splitwise connection.)
3. User uploads the file.
4. **Match people:** app auto-matches Splitwise names to Space members. Unmatched names show as `Who is "Raj K"?` with a member picker or `Invite them`.
5. **Preview in plain words:** `Raj owes you $34.00 · You owe Ana $12.50 · Priya is settled up` → `Looks right` button.
6. Done — opening balances are created; the Space starts fresh from here.
- **Tap budget:** about **6 taps** after the file is uploaded.

**Optional path — "Bring full history"**
- Hidden behind a small `Import all past expenses instead` link on the preview screen.
- Shows `42 expenses from Jan–Oct 2026` with a scrollable list, then imports them read-only and labeled `Imported from Splitwise`.
- Never import both full history and opening balances for the same period (prevents double counting — §17.6).

**Safety (from §17.6, unchanged):** preview before anything is saved, duplicate detection if the same file is uploaded twice, provenance on every imported record, and a one-tap `Undo import` for 7 days.

**Plain-language messages**
- File not recognized: `This doesn't look like a Splitwise export. Here's how to get the right file.`
- Balances don't add up: `Some amounts didn't match. Check these 2 people before importing.`

---

### 20.5 Acceptance criteria

1. Space pill is visible on every main screen, highlighted, and shows the current Space name; switching takes 2 taps.
2. Add/Quick Add/Scan screens show which Space the bill goes to.
3. Inviter can share a link in 2 taps; invitee reaches the dashboard in 3 screens or fewer, no password required.
4. Splitwise balances import completes in about 6 taps after upload, with plain-language preview and undo.
5. Every flow above passes the 3-new-users test without questions.

## 21. Two-sided balances, Google sign-in, and same-account Gmail (October 26, 2026)

> Addendum to the Master Specification. Follows §20 simplicity rules.

### 21.1 Dashboard shows both sides: what you owe and what you're owed

The dashboard hero shows **two equally prominent amounts**, side by side (stacked on very narrow screens):

| You owe | You're owed |
|---|---|
| **$46.10** | **$128.50** |
| to 2 people | from 3 people |

- Tap either card → a simple list of people with amounts:
  - You're owed: `Raj — $52.00 · Ana — $40.25 · Priya — $36.25`, each with a **Remind** button (rate-limited, §2 P0 #9).
  - You owe: `Arjun — $46.10`, with **Record payment**.
- Below the two cards, one plain-language line: `Overall, you'll get back $82.40` (or `Overall, you owe $12.00` / `You're all settled up 🎉`).
- Both numbers use the same size and weight — being owed money matters as much as owing it. Owed = positive accent, owe = neutral/warning tone, always with text labels, never color alone (§5).
- Amounts come from **confirmed** settlements only; pending reports show as a small note: `$20.00 reported paid, waiting for you to confirm`.
- The same two-sided view appears on each person's row in the Members screen and in the Space switcher (§20.2).

### 21.2 Google sign-in

- **Sign-in options:** `Continue with Google` (primary), `Continue with Apple` (required later for the iOS app if any third-party sign-in is offered), and email magic link as fallback. No passwords.
- Implement via Supabase Auth's Google provider.
- **Sign-in asks only for basic profile and email.** Gmail access is **never** requested at sign-in — users should not see a scary permission screen just to join their roommates.
- The invite flow (§20.3) uses the same buttons: tap link → `Continue with Google` → in the Space.

### 21.3 Gmail connection must use the same Google account

**Decision:** The Gmail account connected for Auto Bills must be the **same Google account the user signed in with**. One user = one email. A different Gmail account is not supported for now; this avoids handling multiple identities, extra permissions, and confusing ownership of bill data.

**Flow**
1. User taps `Connect Gmail` in Bill sources.
2. Screen explains, in plain words: `We'll only look for bills from the providers you choose (like ComEd). Use the same Google account you signed in with: arjun@gmail.com.`
3. Start Google OAuth with **incremental authorization** for the Gmail scope only, passing `login_hint=<user's account email>` so Google preselects the right account.
4. **Server-side check after consent:** read the email from the returned ID token / userinfo and compare with the signed-in user's verified email (and, for Google sign-ins, the Google account `sub` ID — more reliable than email).
   - **Match** → store the refresh token encrypted, server-side only; show `Gmail connected · arjun@gmail.com`.
   - **Mismatch** → immediately **revoke** the new token, store nothing, and show: `That's a different Google account (other@gmail.com). Please connect arjun@gmail.com — the one you signed in with.` with a `Try again` button.
5. Connected-account row always shows which email is connected, last sync time, and `Disconnect` (revokes the token and deletes stored credentials).

**Users who signed up with email magic link**
- If their account email is a Gmail/Google address → they can connect Gmail only for that same address.
- If their account email is not a Google account → `Connect Gmail` is replaced with: `Gmail connection works when you sign in with Google. You can still forward bills or upload them.` Do not offer account linking yet.

**Tests**
- Signed in as A, consent with Google account A → connected.
- Signed in as A, consent with Google account B → token revoked, nothing stored, clear error shown.
- Same email but different Google `sub` (e.g. recreated account) → treated as mismatch.
- Disconnect → token revoked at Google and deleted from the database.
- Gmail tokens never reach the browser; another Space member can never trigger a read of someone else's Gmail.

### 21.4 Before going public with Gmail access

- Reading Gmail is a **restricted scope**. Before letting public users connect, Google requires app verification and an annual third-party security assessment, with real cost and lead time. Up to 100 test users can be added while the app is in "testing" mode, which is enough for the pilot.
- Request the narrowest scope that works, read only messages matching known bill senders, and keep only extracted bill fields — not the emails themselves (§17.2).
- Forwarding and PDF upload remain available so households aren't blocked by Gmail approval (§2 Auto Bills).
- Verify current Google requirements, costs and test-user limits before relying on these numbers.

## 22. Personal expense tracking (October 26, 2026)

> Addendum to the Master Specification. **Changes scope:** §2's exclusion of a "general-purpose personal finance dashboard" is narrowed — simple, manual personal expense tracking is now in scope. Still excluded: bank/card linking, budgets with investments, net worth, credit scores, or anything requiring financial credentials.
> Purpose: give people a reason to open the app every day, not only when a shared bill arrives. Follows §20 simplicity rules.

### 22.1 Model: a private "Personal" Space

- Every user automatically gets one **Personal** Space at signup. Only they can see it; it cannot be shared, have members, or be deleted (it can be hidden).
- It appears first in the Space switcher (§20.2): `👤 Personal`.
- Same engine as other Spaces: bills/expenses, categories, Quick Add, receipt scan — just with one member and no splits or settlements.
- Data model: `spaces.type` gains `personal`; constraint: exactly one personal Space per user, exactly one member, invites blocked. RLS: only the owner can read or write.

### 22.2 Your share of shared bills counts automatically

This is what makes it different from a standalone tracker:

- When a shared bill is published in any Space, **your share** (not the full total) shows in your personal spending, labeled with its source: `Electricity · ComEd — $46.10 · from Maple Apartment`.
- This is a **read-only view**, not a copy — no duplicate records, and edits happen in the original Space.
- Only your share counts, even if you paid the full bill upfront (the rest is money you're owed, shown on the dashboard, §21.1).
- Toggle in settings: `Include my share of shared bills` (default on).
- Other members of a shared Space never see your personal expenses.

### 22.3 Adding personal expenses

- **Quick Add** (§19.2): `coffee 5.50` while in Personal → saved as a personal expense, 1 tap. If in a shared Space, the draft shows `Adding to: Maple Apartment` with a one-tap switch to `Personal`.
- **Receipt scan** (§19.3): in Personal, items aren't assigned to people — the scan just records total and category. In a shared Space, items you assign only to yourself can optionally also be tagged personal.
- **Manual:** amount, title, category, date — nothing else required.
- Tap budget: **≤3 taps** for a manual personal expense.

### 22.4 Personal screen (simple)

- Hero: `This month you spent $642.30` (personal + your shares), with a small `$80 less than last month` line.
- One simple chart: spending by category for the month (bars or ring; tap a category → list of expenses).
- List of recent expenses, each marked `Personal` or with its Space name.
- No budgets, goals, or charts beyond this in v1. Add a single optional monthly budget only if pilot users ask.

### 22.5 Privacy and analytics

- Personal expenses are private to the user: never visible to Space members, never in analytics payloads (§10), included in the user's own data export.
- Leaving a shared Space keeps your historical shares in your personal history.

### 22.6 Tests

- Personal Space created once per user at signup; cannot be invited into or shared.
- Member of a shared Space cannot read another member's personal expenses.
- $200 bill split 4 ways appears as $50.00 in each member's personal spending, not $200.00, including for the payer.
- Editing the shared bill updates the personal view; no duplicate rows exist.
- Disabling `Include my share of shared bills` removes them from totals without touching shared data.

### 22.7 Priority

Build after core shared bills (Milestone 2) and Quick Add. The Personal Space is mostly reuse of existing pieces, so cost is low; the auto-included shares are the main new logic.
