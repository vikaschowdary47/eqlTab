# EQLSHARE — Master Product, Design & Engineering Specification

**Version:** 0.1 | **Date:** October 23, 2026 | **Status:** Working plan / pre-validation

> **Product:** eqlShare (`eqlshare.com`)  
> **One-line pitch:** Shared bills. Fair shares. No chasing.  
> **Launch market:** United States  
> **Initial users:** Roommates and shared households, especially students and young professionals  
> **Stage:** Pre-MVP; brand/domain chosen; Apple and Google developer accounts available

## 0. Instructions to every AI agent

Treat this document as the product source of truth. Do not invent payment capabilities, pricing, customer traction, compliance approvals, or finalized brand identity beyond what is written. Build incrementally and preserve working code. Before implementing a milestone, state the files to change, database changes, assumptions, and tests. Ask about blocking product decisions; otherwise choose the simplest reversible implementation and document it. Never silently change the data model or security rules. Do not claim a feature is complete without running relevant tests.

**Priorities:** Security and correct financial arithmetic > core workflow > usability > visual polish > optional AI.

## 1. Product strategy

### Problem

In shared households, one roommate commonly pays electricity, Wi-Fi, gas, or rent and then manually calculates shares, requests reimbursement through separate apps, sends reminders, and reconciles who paid. Household membership and uneven splits complicate this. The goal is to reduce the administrative burden, not to become a bank in version one.

### Primary job to be done

“When I pay a recurring household bill, I want everyone to know exactly what they owe and whether they have settled, without me repeatedly chasing people.”

### Primary personas

- **Bill payer / household organizer:** creates household, adds bills, needs an accurate view of money owed and settlement history.
- **Roommate / member:** joins via invitation, sees only relevant shared expenses, understands each share, and records reimbursement.
- **Household with uneven occupancy:** needs custom splits and historical accuracy when people join or leave.

### Positioning

A shared-household bill operations tool, not just an expense calculator. Initial wedge: recurring utilities and household bills. Longer-term opportunities such as payments, rent, subscriptions, couples, and families are hypotheses, not MVP scope.

### North-star validation

A real household uses eqlShare for a real bill and returns for its next billing cycle. Supporting signals: invited members who join, real bills added, settlement status updates, time saved, and willingness to recommend/pay.

## 2. Product scope

### P0 — required for first closed beta

1. Email authentication, sign-in, sign-out, password recovery or magic-link flow.
2. Create a household with name and default currency USD.
3. Invite members with secure, expiring invitation links; join or decline; household roles.
4. Dashboard: bills due, unpaid amounts, who owes whom, recent activity.
5. Add a bill: title, category, total, payer, bill date, due date, optional note.
6. Equal splits with deterministic rounding; custom fixed-amount splits; total must match bill amount.
7. Bill details with individual shares, status, payer and history.
8. Mark reimbursement as reported; payer can confirm or dispute; distinguish _reported_ from _confirmed_.
9. Reminders via email or shareable reminder link; rate-limit and allow opt-out.
10. Basic recurring bill templates (monthly) without automatically fabricating a new amount; users review variable bills.
11. Responsive web interface usable on mobile; accessibility, loading, empty, error, and offline states.
12. Basic account/household settings, membership exit and export of household records.

### P1 — after first household usage

- Receipt or bill attachment in private storage.
- AI-assisted extraction of bill total, merchant, and due date, **always reviewed and confirmed by a user**.
- Unequal percentage splits and date-based occupancy splits.
- Scheduled email reminders with user controls.
- Audit log, better reports, and simple notifications.

### P2 — future research, not promised

- iOS and Android apps using Expo/React Native.
- Approved provider-based payment collection/settlement.
- Bank connections, card issuing, subscriptions, and sophisticated AI automation.

### Explicit exclusions from MVP

No real bank transfers, ACH debits, credit products, card issuance, money custody, payment verification via screenshots, lending, or claims that external transfers have been verified. No marketplace or general-purpose personal finance dashboard.

## 3. Key user journeys

### A. Create household and invite roommates

1. New user registers and verifies email.
2. User creates “Maple Apartment” household.
3. App generates single-use or controlled-use invite with expiration and revocation.
4. Invited member signs in, previews household name, and accepts.
5. Organizer sees joined/pending members.
   **Acceptance:** An unauthorized user cannot see household records; expired/revoked invites fail safely.

### B. Add and split electricity bill

1. Payer taps “Add bill,” enters $200.00 and due date.
2. Selects four participants and equal split.
3. Each share is $50.00; payer's own share is included in the allocation but is not an external reimbursement.
4. Bill appears in dashboard and member views.
5. Members report external payment; payer confirms receipt.
   **Acceptance:** Amounts reconcile exactly and confirmed status requires authorized confirmation.

### C. Custom uneven split

1. Organizer enters $137.01 bill for three members.
2. Equal split allocates 4567 cents each.
3. For custom split, user enters amounts; save is blocked until total equals 13701 cents.
4. Changing a historical bill records who changed it and when; previously confirmed settlements are not silently rewritten.

### D. Recurring bills

1. User creates monthly “Internet” template.
2. On next cycle, app creates a draft or review task.
3. User confirms amount, date, payer, and participants before publishing.
4. Members receive a clear new bill, not a duplicate charge.

### E. Roommate moves out

1. Organizer sets membership inactive effective a chosen date.
2. Existing historical bills remain intact.
3. Future bills exclude inactive members by default.
4. Outstanding balances remain visible and exportable to authorized participants.

## 4. Information architecture and screens

### Public website (`eqlshare.com`)

- Landing page: concise value proposition, three-step explanation, privacy/FAQ, early-access signup.
- Legal pages: privacy policy and terms, reviewed for actual practices before launch.
- Support/contact page.

### Application (`app.eqlshare.com`)

1. Welcome / sign in / sign up.
2. Onboarding: create household or join invitation.
3. Household dashboard (primary home).
4. Bills list with filters: all, upcoming, unpaid, settled.
5. Add/edit bill flow.
6. Bill detail with participant shares and activity.
7. Household members and invitations.
8. Settlement reporting and confirmation.
9. Recurring bill templates.
10. Settings, notification preferences, account management.

### Navigation

Mobile: bottom navigation **Home · Bills · Members · Settings**, with prominent “Add bill” action. Desktop: compact sidebar with the same destinations. Avoid more than one primary action per screen.

## 5. Design direction

**Brand personality:** Fair, calm, trustworthy, friendly, modern; not playful enough to trivialize money.  
**Visual language:** Clean fintech UI, generous spacing, simple cards, restrained color, clear typography, legible money amounts.  
**Working visual tokens (subject to design review):**

- Background: `#F8FAFC`; surface: `#FFFFFF`; primary text: `#0F172A`.
- Primary accent: `#0F766E` (teal); success: `#15803D`; warning: `#B45309`; error: `#B91C1C`.
- Font: Inter or system sans; 8px spacing scale; 12–16px card radius.
- Meet WCAG AA contrast targets; never communicate payment status through color alone.

### UI rules

- Every monetary amount shows USD and two decimal places.
- Clearly label “You owe,” “Owed to you,” “Reported paid,” and “Confirmed received.”
- Do not present a “Pay now” button if the app does not process payments; use “Record payment” or “Open payment app” where supported.
- Always show who paid upfront, who owes, due date, and whether an amount is disputed.
- Confirm destructive actions and protect against accidental double-submission.
- Design empty, loading, error, success, and permission-denied states for each major screen.
- Support small mobile screens, keyboard navigation, screen readers, and dynamic text sizes.

### Initial design deliverables

Produce a sitemap, low-fidelity flows, high-fidelity mobile screens, desktop adaptations, reusable component inventory, interaction annotations, and design tokens. Use real sample amounts and realistic long names. Do not invent bank balances or account linking.

## 6. Technology and architecture

**Recommended first build:** Responsive Next.js web app. Fast onboarding via links matters more than app-store distribution at validation stage.

- Frontend: Next.js App Router, TypeScript, Tailwind CSS, accessible UI primitives.
- Backend: Supabase Auth, PostgreSQL, private Supabase Storage where needed.
- Hosting: Vercel or equivalent; `eqlshare.com` marketing, `app.eqlshare.com` app.
- Server-side business operations: authenticated server actions/API routes or tightly scoped database functions.
- Email: reputable transactional email provider; configure verified domain, SPF/DKIM/DMARC before production sending.
- Analytics: privacy-conscious event tracking without bill amounts or personal financial details in event payloads.
- Later native clients: Expo + React Native reusing shared TypeScript validation/calculation logic and secure backend APIs.

**Repository shape (suggested):**

```
eqlshare/
  apps/web/
  packages/domain/        # split calculations, schemas, business rules
  packages/ui/            # optional shared web components
  supabase/migrations/
  docs/
  tests/
```

For the very first milestone, a simpler single Next.js repository is acceptable; do not add monorepo complexity without a reason.

## 7. Data model (initial proposal)

- `profiles`: `id` (auth user UUID PK), `display_name`, `created_at`.
- `households`: `id`, `name`, `currency`, `created_by`, `created_at`.
- `household_members`: `id`, `household_id`, `user_id`, `role` (`owner/member`), `status`, `joined_at`, `left_at`; unique active membership per household/user.
- `invitations`: `id`, `household_id`, `token_hash`, `invited_email?`, `expires_at`, `revoked_at`, `accepted_by`, `accepted_at`, `created_by`.
- `bills`: `id`, `household_id`, `title`, `category`, `amount_cents`, `payer_member_id`, `bill_date`, `due_date`, `status`, `created_by`, `created_at`, `updated_at`, `version`.
- `bill_splits`: `id`, `bill_id`, `member_id`, `amount_cents`, `created_at`; unique `(bill_id, member_id)`.
- `settlements`: `id`, `bill_split_id`, `amount_cents`, `reported_by`, `reported_at`, `confirmed_by?`, `confirmed_at?`, `status` (`reported/confirmed/disputed/reversed`), `note?`.
- `recurring_templates`: `id`, `household_id`, `title`, `frequency`, `next_due_date`, `default_payer_member_id`, `active`.
- `reminders`: `id`, `bill_split_id`, `channel`, `sent_at`, `delivery_status`.
- `audit_events`: `id`, `household_id`, `actor_user_id`, `entity_type`, `entity_id`, `action`, `created_at`, `metadata` (redacted).

**Constraints:** All amounts are integer cents and nonnegative; published bills require positive totals; each bill's splits must sum exactly to its total; participant IDs must belong to the same household. Payer share is not a reimbursement owed to themselves. Do not equate `reported` with `confirmed`. For partial payments, calculate outstanding from confirmed settlements only and show pending reports separately. Use database transactions and idempotency for write operations.

## 8. Security, privacy, and trust

- Enable and test Row Level Security on all user/household tables.
- Household members can read authorized household data; edits follow role and ownership rules.
- Check household membership server-side for every bill, split, invite, settlement, and attachment operation.
- Never expose Supabase service-role keys or provider secrets in browser code.
- Store invite tokens hashed, enforce expiration and revocation, and rate-limit acceptance and reminder endpoints.
- Private attachment buckets with short-lived signed URLs and file-type/size validation.
- Validate input server-side; protect against XSS, CSRF as applicable, replay, duplicate submission, and enumeration.
- Minimize collection of financial and personal information; implement deletion/export policy and retention controls.
- Avoid calling external payment status “verified” without provider confirmation.
- Publish truthful privacy and terms pages before external beta.
- Obtain professional legal/compliance review before introducing regulated payment flows.

## 9. Testing and acceptance criteria

### Domain unit tests

- `$200.00 / 4` → `[5000, 5000, 5000, 5000]` cents.
- `$100.00 / 3` → deterministic `[3334, 3333, 3333]` cents (consistent member ordering).
- `$137.01 / 3` → `[4567, 4567, 4567]` cents.
- Custom splits cannot save if sum differs from bill amount.
- Zero or negative bill totals rejected.
- Payer's own share does not appear as debt to themselves.
- Partial payments never exceed outstanding amount; duplicate confirmation is idempotent.

### Authorization integration tests

- Household A member cannot read/write Household B bills or storage objects.
- Nonmembers cannot accept expired or revoked invites.
- A member cannot confirm receipt of someone else's reimbursement unless explicitly authorized.
- Inactive members do not receive new splits by default.
- Removing a member does not erase historical debt or audit trail.

### End-to-end tests

- Signup → household → invite → join → create bill → report payment → confirm → dashboard updated.
- Failed invitation, lost connection, stale edit, and duplicate-click scenarios.
- Responsive layout at mobile widths and keyboard/screen-reader navigation.

## 10. Analytics and beta validation

Track only necessary product events: `signup_completed`, `household_created`, `invite_sent`, `invite_accepted`, `bill_published`, `settlement_reported`, `settlement_confirmed`, `recurring_bill_reviewed`. Avoid personal data and monetary values in analytics payloads.

**First beta targets (not claims):** 5 households, approximately 15–25 members, at least 10 real bills, and evidence of a second billing-cycle return. Interview users after first bill and after next billing cycle. Measure activation, invitation conversion, recurring usage, time saved, and willingness to pay.

## 11. Milestone plan for AI implementation

### Milestone 0 — foundation

Repo, Next.js, lint/typecheck/test setup, Supabase local/migration setup, environment templates, README, deployment skeleton. **Done when:** fresh clone runs with documented setup.

### Milestone 1 — auth and households

Auth, profiles, household creation, membership, invitations, RLS, basic onboarding. **Done when:** two real accounts securely join one household and unauthorized access tests pass.

### Milestone 2 — bills and splits

Bill CRUD, equal/custom allocation, validation, bill details, dashboard. **Done when:** cents reconcile for every tested case and another household cannot access bills.

### Milestone 3 — settlements

Reported/confirmed/disputed states, permissions, history, partial settlements if required. **Done when:** payer can confirm a reported external payment and balances update correctly.

### Milestone 4 — recurrence and reminders

Monthly templates, review-before-publish, controlled reminders, preferences. **Done when:** new cycle does not silently reuse stale bill amounts or spam users.

### Milestone 5 — beta readiness

Responsive/accessibility pass, onboarding, legal pages, analytics, backups, error monitoring, deployment, manual QA, 5-household pilot. **Done when:** an unaided household can complete the full flow.

### Milestone 6 — evaluate mobile and AI

Use pilot data to decide whether to add Expo clients and bill scanning. No automatic payment collection without provider approval.

## 12. AI design-agent prompt

> You are the lead product designer for eqlShare. Read the entire attached Master Product, Design & Engineering Specification before starting. Design a polished, accessible, mobile-first web application for shared-household recurring bills. Produce a sitemap, task flows, design tokens, component inventory, and high-fidelity screens for sign-in, onboarding, household dashboard, bills list, add bill, custom split, bill detail, settlement reporting/confirmation, member invites, recurring bills, and settings. Show realistic empty, loading, error, disputed, and permission states. Use a restrained, trustworthy fintech aesthetic and the proposed brand direction, but explore two distinct visual concepts before choosing one. Do not add banking, cards, lending, or fake payment verification. Include annotations so a coding agent can implement every interaction.

## 13. AI coding-agent prompt

> You are the principal full-stack engineer for eqlShare. Read the entire attached Master Product, Design & Engineering Specification. Implement **Milestone 0 only** first using Next.js App Router, TypeScript, Tailwind, and Supabase. Before coding, present a short implementation plan, dependencies, assumptions, and test plan. Use secure patterns, migrations, typed validation, and an environment example without secrets. Run lint, typecheck, and tests; report actual results and any failures. Do not implement later milestones, real payments, bank connections, or card features. Preserve working code. When Milestone 0 is complete, stop and ask for approval to proceed to Milestone 1.

### Follow-up coding prompt template

> Continue eqlShare using the attached Master Specification and existing repository. Implement **Milestone [N] only**. Inspect current code and migrations first. State what already works, what will change, and how regressions will be prevented. Write tests for financial calculations and access controls. Run available checks and report results. Do not invent features or alter prior milestones unnecessarily. Stop after the milestone acceptance criteria pass.

## 14. AI QA / code-review prompt

> Review the eqlShare implementation against the attached Master Specification. Prioritize broken access controls, missing RLS, cross-household data leakage, inaccurate money arithmetic, incorrect settlement statuses, duplicate submissions, insecure invitation links, and misleading UI copy. Identify concrete file/line issues, reproduction steps, severity, and minimal fixes. Do not mark tests as passing unless executed. Suggest only the highest-priority improvements needed for the current milestone.

## 15. Open product decisions (resolve during discovery)

1. Are rent payments in beta scope, or only utilities and subscriptions? **Default:** utilities and household bills first.
2. Can any member add a bill, or only organizers? **Default:** members can propose; organizers/payer can publish.
3. Who can confirm a settlement? **Default:** the person owed money or authorized payer.
4. Do reminders go to all members or only unpaid members? **Default:** only unpaid, opt-out supported.
5. What happens if someone disputes their split? **Default:** flag dispute and preserve existing history.
6. Is a web-only pilot sufficient? **Default:** yes; revisit native apps after real use.
7. Is the name legally clear? **Status:** domain purchased according to founder; trademark/app-name clearance still needed.

## 16. Definition of successful V0.1

A real household can sign up, invite roommates, publish an actual shared bill, allocate every cent fairly, see accurate balances, report external reimbursements, and have the payer confirm them—all without exposing one household's data to another. At least five pilot households are invited to test the workflow and provide feedback. No claim is made that eqlShare processes or verifies money movement.
