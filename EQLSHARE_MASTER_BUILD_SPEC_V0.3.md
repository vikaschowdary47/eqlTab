# EQLSHARE — Master Product, Design & Engineering Specification

**Version:** 0.3 | **Date:** October 24, 2026 | **Status:** Working plan / pre-validation

> **Product:** eqlShare (`eqlshare.com`)  
> **One-line pitch:** Shared expenses and bills, organized automatically. Everyone knows what is due.  
> **Launch market:** United States  
> **Initial users:** Shared households, especially students and young professionals; architecture supports couples, families, and groups  
> **Stage:** Pre-MVP; brand/domain chosen; Apple and Google developer accounts available

## 0. Instructions to every AI agent

Treat this document as the product source of truth. Do not invent payment capabilities, pricing, customer traction, compliance approvals, or finalized brand identity beyond what is written. Build incrementally and preserve working code. Before implementing a milestone, state the files to change, database changes, assumptions, and tests. Ask about blocking product decisions; otherwise choose the simplest reversible implementation and document it. Never silently change the data model or security rules. Do not claim a feature is complete without running relevant tests.

**Priorities:** Security and correct financial arithmetic > core workflow > usability > visual polish > optional AI.

## 1. Product strategy

### Problem

In shared households, one roommate commonly pays electricity, Wi-Fi, gas, or rent and then manually calculates shares, requests reimbursement through separate apps, sends reminders, and reconciles who paid. Household membership and uneven splits complicate this. The goal is to reduce the administrative burden, not to become a bank in version one.

### Primary job to be done

“When a utility bill arrives in one roommate's inbox, I want the entire household to know the correct amount, due date, and individual shares automatically—before it becomes overdue.”

Secondary job: track reimbursements without repeatedly chasing people. **Auto Bills is the proposed flagship differentiator**, while splitting and settlements are foundational.

### Primary personas

- **Bill payer / household organizer:** creates household, adds bills, needs an accurate view of money owed and settlement history.
- **Roommate / member:** joins via invitation, sees only relevant shared expenses, understands each share, and records reimbursement.
- **Household with uneven occupancy:** needs custom splits and historical accuracy when people join or leave.

### Positioning

A shared expense and bill-management platform for anyone who shares financial responsibilities. **Launch wedge:** recurring utility bills for shared households. **Core model:** a customizable Space (Shared Home, Couple, Family, or Group), not a roommate-only household. Other Space types use the same core engine with tailored defaults; their full specialized workflows need validation. Payments and B2B reimbursements remain separate future hypotheses.

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

### P0 pilot extension — Auto Bills proof of value

- Household-specific inbound email address and forwarding setup; allow manual PDF upload fallback.
- Parse supported bill emails and attached PDFs for provider, amount due, due date, billing period and account identifier (masked).
- Require confirmation for uncertain extraction; link to original statement and show confidence/last fetched time.
- Deduplicate by provider/account/billing period/statement ID; never create repeated charges.
- Auto-apply saved household splitting rules to confirmed bill data.
- Notify all authorized household members on arrival; schedule due-date alerts (for example 5, 2 and 1 days prior), with preference controls and appropriate escalation for overdue bills.
- Distinguish **bill received**, **utility payment reported**, **utility payment verified by provider**, and **roommate reimbursement reported/confirmed**.
- Alert on missing or stale expected bills, parsing failures, bounced forwarding and uncertain due dates; never assume silence means paid.
- Test with consented ComEd and Southern Connecticut Gas examples; provider connectivity must be verified, not presumed.
- **Scope boundary:** No Gmail inbox scraping, stored utility passwords, or automatic bank transfers in this milestone.

### P1 — after first household usage

- Receipt or bill attachment in private storage.
- AI-assisted extraction of bill total, merchant, and due date, **always reviewed and confirmed by a user**.
- Unequal percentage splits and date-based occupancy splits.
- Scheduled email reminders with user controls.
- Audit log, better reports, and simple notifications.

### P1/P2 — optional provider connections and payment research

- Evaluate Gmail OAuth/API and MCP prototypes, but prefer forwarded billing emails for early production due to Gmail permissions, verification and privacy obligations.
- Investigate authorized utility data platforms such as UtilityAPI or Arcadia; provider coverage and due-date fields are not universal. ComEd and Southern Connecticut Gas support require independent confirmation.
- Explore a direct bill-pay integration through regulated partners only after validating demand, funding flows, payer liability, KYC/AML, settlement, refunds and failure handling.
- Initial safe path: open official provider payment portal; utility account holder pays there; eqlShare tracks status without falsely claiming settlement.

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

---

## 17. Addendum — product discoveries and business strategy (October 24, 2026)

This addendum captures decisions and ideas discussed after the initial specification. **All prices, traction figures, provider availability and expansion plans are hypotheses unless validated.** Where older sections differ, this addendum governs product direction; implementation still proceeds milestone by milestone.

### 17.1 Problem refinement and positioning

The core failure occurs **before** a split: a utility statement lands in one person's inbox or portal, nobody else knows its amount or due date, and the responsible roommate may not read it until late or disconnection notices arrive. The household has no shared source of truth. eqlShare should automatically capture supported statements, identify amount and due date, publish the bill to authorized household members, calculate shares, and remind everyone before deadlines.

Proposed positioning: **“eqlShare automatically collects household bills, splits them fairly, and makes sure everyone knows what's due.”** Do not claim that reminders guarantee payment or prevent disconnection.

Splitwise is both an established competitor and a possible complementary workflow. Initial adoption **must not require abandoning Splitwise or sharing bank credentials**. Offer free import/export and copyable expense details; do not promise direct Splitwise synchronization without authorization and a permitted integration. Users may continue settling through existing tools.

### 17.2 Auto Bills end-to-end workflow

1. Household organizer connects a supported billing source by forwarding billing emails to a unique household inbound address, or uploads a statement. Later, supported OAuth or utility data connections may be offered.
2. Ingestion validates sender, source and file types; scans attachments, applies size limits, and securely stores only needed data.
3. Parser extracts provider, statement identifier, billing period, total amount due, due date, and original document where available. Record provenance, confidence, parsing version and timestamp.
4. Deduplication checks account/provider/period/statement identity. A revised statement is treated as a revision, not a second charge.
5. If information is ambiguous, absent, contradictory, or unexpectedly large, queue for human review. Never invent a due date or silently publish an unverified total.
6. Once confirmed under household settings, apply equal or custom split rules with integer-cent reconciliation. Notify household members of the amount, due date and individual shares.
7. Send configurable notifications on bill arrival and before due date (proposed 5/2/1-day cadence); stop or adjust reminders based on **known** status, not unsupported assumptions. Rate-limit and respect user preferences.
8. Show the source, last successful retrieval, extraction confidence where relevant, due date, and separate statuses for utility bill payment and reimbursements.
9. If an expected bill does not arrive, alert the household organizer that retrieval may have failed. Missing data must never be displayed as “no payment due.”

**Email limitations:** A “statement ready, sign in” email may lack the amount, due date and PDF. Email forwarding alone cannot guarantee statement retrieval; use authorized provider access or request a manual upload. Forwarding setup must be clearly explained and revocable.

**Gmail MCP vs Gmail API:** An MCP server is useful for developer prototyping but does not remove OAuth scope, consent, restricted-data or security obligations for a customer-facing product. Gmail API may have low direct usage charges but public read-access integrations can require verification and security assessment. For initial beta, use narrowly scoped inbound email forwarding, with a dedicated receiving service and minimal data retention.

### 17.3 Payment architecture: two distinct jobs

**Initial:** One named utility account holder pays the provider through its official portal or AutoPay. Other members reimburse the account holder outside eqlShare. eqlShare tracks reported and confirmed reimbursements, and records utility payment status separately. “Open provider payment page” is not an in-app payment.

**Future, partner-dependent:** Each roommate contributes their share and an authorized bill-pay program routes funds to the provider. This requires a suitable regulated financial/bill-payment partner, permission to serve consumer households, reliable utility coverage, funding and settlement handling, identity/compliance processes, refunds, disputes, failed contributions, and clear liability if a bill goes unpaid. No funds held or moved in MVP.

Do not treat a user-reported payment, a submitted transaction, a payment confirmation email, and provider-confirmed settlement as identical.

### 17.4 Pricing, willingness to pay and unit economics

Proposed freemium: manual expenses, household membership, splitting, basic reminders, and basic migration remain free. Test **eqlShare Plus at $4.99 per household per month** for automated bill ingestion and advanced household bill workflows. This is an experiment, **not** validated pricing. Do not gate the core ability to import from Splitwise.

Validate with 15–20 qualified households and a working demonstration, then offer a real paid pilot. Record actual payments separately from waitlist clicks, verbal interest and free usage. Example decision heuristic: several paying pilot households are a promising signal; zero paid commitments requires revisiting the target user, offer or price before expanding engineering.

Track gross subscription revenue, payment processing fees, inbound email and AI parsing costs, provider data fees, notifications, support, customer acquisition and churn. Avoid claiming profitability from hypothetical revenue. Alternative B2B payers are a separate discovery hypothesis, not an established solution.

### 17.5 Competitive trust and adoption insights

One early interviewee stated a strong preference for staying with Splitwise and reluctance to trust an unfamiliar app with bank details. This is **qualitative feedback from one person**, not proof of broad market sentiment. It suggests a lower-trust adoption path: no bank account required, no funds custody, no forced migration, clear consent for email/utility data, transparent original statements, revocable connections, secure handling and useful automation before asking for financial permissions.

Competitive differentiation is **not** “free Splitwise.” The product hypothesis is end-to-end recurring household bill awareness and coordination. Bill extraction/reminders are replicable features; defensibility, if achieved, would depend on reliability, supported integrations, distribution, trust, repeated usage and eventual approved payment workflows.

### 17.6 Splitwise migration

Provide a user-controlled import from supported Splitwise CSV exports where available, plus manual opening balances. Preview imported people, groups, dates, amounts and settlements; map participants to household members; detect duplicates; preserve provenance; support rollback. Avoid double-counting historical transactions and opening balances. Other expense apps' exports may be supported later after format research. Do not claim authorized commercial Splitwise API access.

### 17.7 eqlShare-branded bill-only prepaid cards — future exploration

Concept: physical eqlShare-branded prepaid cards distributed through retailers such as Walmart. A customer buys value with an accepted tender type, redeems it into a program balance and uses it **only for eligible bill payments**, not unrestricted person-to-person transfers. This is a future commercial and regulated program, **not an MVP feature**. Restrictions on spending do not automatically remove money-transmission, prepaid access, KYC/AML, consumer protection or state-law obligations. Requires issuer/program manager, retail distribution, authorized bill-payment rails, fraud controls, redemption and refund policy, and verified economics. No retailer agreement is assumed.

### 17.8 International grocery-store digital receipts — future exploration

After achieving meaningful adoption among international communities, explore partnerships with international grocery stores. At checkout, a customer could provide a verified account-linked phone number or scan a one-time QR code to deliver a digital receipt into eqlShare. Customers could review spending and split individual grocery items among roommates. Design opt-in consent, phone-number verification, anti-misdelivery safeguards, merchant POS integration, retention and deletion. Merchant fees or engagement revenue are possibilities, not commitments. **Do not include in the initial household MVP.**

### 17.9 eqlShare for Business — employee reimbursement automation

**New adjacent market hypothesis:** Employees pay eligible work-related expenses personally and seek reimbursement from employers. eqlShare could automatically ingest recurring internet, mobile phone, software subscription or other eligible bills, apply employer policies, prepare claims, route them for manager approval, and export approved reimbursements to existing payroll/accounting/expense systems.

Illustrative workflow: employee's $90 monthly home-internet bill arrives; employer policy reimburses up to $60; eqlShare proposes a $60 claim, with the employee approving what evidence is shared; manager approves; the employer's existing reimbursement system executes payment. **eqlShare does not move money in the initial B2B pilot.**

Business-specific requirements, if validated:

- Separate company tenancy, employee membership, manager/finance roles and strict tenant isolation.
- Employer policy engine: eligible categories, per-period caps, proration, required evidence, duplicate prevention, approval chains and exception handling.
- Employee-controlled consent and disclosure: only share the minimum necessary personal bill data; redact personal identifiers and unrelated charges where possible.
- Reimbursement claim lifecycle: draft → employee submitted → manager approved/rejected → exported → externally paid/confirmed.
- Immutable audit trails, policy versioning, payroll/accounting export, secure retention and access review.
- Pricing experiment could be per active employee or company subscription; any $5–$10/employee example is hypothetical.
- Competitors include Expensify, SAP Concur, Ramp and BILL; do not claim this workflow is unique without targeted competitive research.

**Go-to-market discipline:** Interview at least five small businesses that already reimburse recurring employee expenses. Determine whether the workflow is painful and whether a budget owner would pay. Build no full enterprise reimbursement platform until demand is validated. Reuse ingestion/parsing infrastructure but keep household and business products, data, permissions and positioning distinct.

### 17.10 Updated milestones and go/no-go gates

**Immediate prototype:** Demonstrate one consented real ComEd or SCG billing email being received, parsed, matched to the correct household, split accurately and surfaced with due-date reminders. If the email has no amount or date, demonstrate a safe “needs statement” fallback rather than fabricated automation.

**Validation:** Interview bill-responsible roommates, test whether they would use the workflow without banking permissions, and seek real paid pilot households. Measure repeat billing-cycle usage, time saved, missed-bill alerts and paid conversion. Collect negative feedback, including unwillingness to pay.

**After validation:** Compare authorized utility-data partners and assess coverage/cost; test Gmail OAuth only if warranted; explore optional payment integrations through regulated partners.

**Separate discovery tracks, not current build commitments:** B2B reimbursement automation; grocery receipt integrations; prepaid cards.

### 17.11 YC application framing

Proposed concise pitch: “eqlShare automatically collects supported household bills, identifies amounts and due dates, splits expenses fairly, and reminds everyone in the household. We are starting with international students in shared housing, where bills are often scattered across one person's email and several payment apps.”

Proposed monetization: “Free basic household expense management with a paid household subscription for reliable recurring-bill automation, initially testing $4.99/month. Longer-term payment and B2B services are unvalidated expansion opportunities.”

**Application integrity:** Describe only actually working capabilities as built. Separate user interviews, pilot interest, paid customers, active households, and revenue. Do not assert YC selection likelihood, utility-provider support, payment licenses or signed merchant partnerships without evidence.

---

## 18. Spaces: universal onboarding and end-to-end UI specification (October 24, 2026)

**Decision:** Do not limit the app to roommates. A **Space** is the top-level consumer container for a group of people sharing expenses or bills. Existing `households` terminology in earlier sections is legacy implementation language; new user-facing screens use **Space**, **Members**, and **Bills**. Existing databases must be migrated carefully rather than renamed destructively.

### 18.1 Exact onboarding screen copy

**Eyebrow:** `EQLSHARE · GET STARTED`  
**Heading:** `What are you sharing?`  
**Supporting copy:** `Choose a Space type. You can customize it later.`

Four selectable cards, in this order:

1. **Shared Home** — `Roommates, students, shared apartments`
2. **Couple** — `Manage expenses with your partner`
3. **Family** — `Household bills and family expenses`
4. **Group** — `Friends, trips, events, and shared costs`

**Primary button:** `Continue with Shared Home` (dynamic: replace label with selected type). Default selection: Shared Home; user can change it. Provide a clear `Join an existing Space` path. Do not show a business workspace here.

### 18.2 Space types are presets, not hard-coded financial rules

- **Shared Home:** recurring utilities and bill reminders prominent; suggest equal splits; customizable membership.
- **Couple:** suggest equal or custom-percentage splits; no assumption of shared bank accounts or income access.
- **Family:** recurring bills and flexible split responsibility; no automatic parental authority over adult members.
- **Group:** event/trip expenses and one-off settlements prominent; recurring Auto Bills optional.
- All types support the same core entities: members, expenses/bills, splits, activity, settlements, settings and exports.
- Space type can be edited in Settings; changing type adjusts suggested labels and defaults **only**, never rewrites historical expenses, permissions, or balances.
- A user can belong to multiple Spaces and switch between them. Space owner can invite, remove, or manage members according to permission rules; members can leave without deleting historical financial records.

### 18.3 Full consumer UI flow (mobile-first, desktop responsive)

**0. Public entry:** Landing page → Get started / Sign in → authentication → return to invitation if opened via invite link. Show concise privacy assurances; do not imply bank access.

**1. First-time setup:** `What are you sharing?` → Space type card → `Name your Space` (suggest editable examples such as `Maple Apartment`, `Our Home`, `Family Expenses`, `Weekend Trip`) → currency (USD default for US launch) → `Invite people` (share link, copy, email; allow Skip) → `How do you want to add your first bill?` (Manual, Upload PDF, Forward bill email) → review extracted/manual details → split preview → confirm → first dashboard. Users may skip first bill and reach a useful empty dashboard.

**2. Returning user:** Sign in → Space switcher if multiple → dashboard with `Your share due`, `Upcoming bills`, `Needs attention`, `Recent activity`, and a clear `Add` action. Never conflate household total with individual outstanding amount.

**3. Add manual expense:** Add → `Expense or bill` → title/category, amount, payer, date, optional due date, participants → equal / exact amount / percentage split → live cents-balanced preview → save → notify relevant members → detail screen. Support errors, partial input preservation and edit history.

**4. Auto Bills:** Bills → `Set up Auto Bills` → choose forwarding email or upload (provider connections only if truly supported) → show unique inbound address and setup instructions → receive email/PDF → extraction review with source, amount, due date, period and confidence → approve/edit or reject → apply split → bill detail and reminders. If email only says “bill ready,” display `Statement details needed` and request PDF/manual entry. If expected bill missing, show `We haven't received this month's bill` rather than `Paid`.

**5. Bill detail:** Provider/title → total, due date, source and billing period → who is responsible for paying utility → per-member shares and statuses → `Open provider payment site` only with verified official link, otherwise `View statement` → `Record reimbursement` / `Confirm received` where permitted → activity and edit/dispute controls. Distinguish utility-paid status from reimbursements; user-reported is not provider-verified.

**6. Member journey:** Invite link → sign up/sign in → view Space name and inviter → accept → dashboard filtered to member-relevant obligations → receive bill alert → view own share and due date → pay outside app → report paid → payer confirms → balance updates. Pending confirmation is visible.

**7. Manage Space:** Members → invite/remove/roles; Split defaults → equal/custom; Bill sources → forwarding and uploads; Notifications → channels and reminder cadence; Space settings → name/type/currency (currency changes must not retroactively convert historical amounts); Export / leave Space / deletion flows with safeguards.

**8. Edge states:** No Space, no bills, no connected source, invite expired, duplicate statement, uncertain extraction, missing due date, revised statement, overdue bill, partial reimbursement, disagreement, member leaves, offline/retry, notification failure, permission denied. Provide actionable next step for each.

**9. Responsive navigation:** Mobile bottom tabs `Home · Bills · Activity · Space` with prominent Add action; desktop left sidebar same sections plus Space switcher. Settings live under Space/account menu. Keep all primary workflows accessible with keyboard and screen readers.

### 18.4 Information architecture / data changes

- Preferred canonical entity: `spaces(id, name, type, currency, created_by, created_at, updated_at)` with `type` enum `shared_home | couple | family | group`; type is editable.
- Prefer `space_members`, `space_invitations`, `space_bills` (or shared `bills.space_id`), `space_split_defaults`, `space_bill_sources`, `space_reminders`, `space_audit_events`. Preserve financial constraints and RLS isolation from earlier specification.
- If an existing codebase already has `households` and `household_id`, **do not blindly rename**. Provide a backward-compatible migration plan, adapt the UI labels first, and add `type` safely; migrate physical table names only when necessary and tested.
- Authorization must be scoped by `space_id`; one user can have distinct roles across different Spaces. Invite acceptance must not leak data across Spaces.
- Default rules are stored per Space and used for **new** bills only; existing bills remain immutable unless deliberately edited with audit events.
- Do not create separate financial engines for each type. Business workspaces require a distinct tenant and policy/approval model later.

### 18.5 Design direction and sample UI copy

**Brand:** calm, modern, credible fintech; white/near-white backgrounds, restrained teal accent (`#0F766E`), generous spacing, accessible contrast, strong amount hierarchy. Avoid gamification and clutter. Use realistic names and USD amounts as **illustrative demo data**.

- Dashboard greeting: `Good morning` / `Maple Apartment` / `Your share due: $90.15` / `2 bills need attention`.
- Bill card: `Electricity · ComEd` / `Total $184.40` / `Your share $46.10` / `Due Oct 29` / `Awaiting payment`.
- Extraction review: `We found a new bill` / `Check the details before sharing` / `Amount $184.40` / `Due Oct 29` / `Source: forwarded email` / `Confirm bill`.
- Missing data: `We received a bill notification, but not the amount or due date. Upload the statement to continue.`
- Status vocabulary: `Upcoming`, `Due soon`, `Overdue`, `Payment reported`, `Confirmed received`, `Utility payment unverified`, `Needs review`.

### 18.6 Acceptance criteria and implementation order

1. All four Space cards appear with exact copy, selected state, and dynamic CTA; `Join an existing Space` works.
2. Creating each Space type persists type and name, creates owner membership, and routes to onboarding or dashboard.
3. User can join or switch among multiple Spaces without seeing another Space's private records.
4. Space type can be changed without mutating previous splits, payments, or balances.
5. Manual bill entry, exact-cent splitting, member invitation and settlement status work for every type.
6. Shared Home prioritizes Auto Bills; Group prioritizes one-off expenses; Couple/Family use appropriate default labels. These are UI presets, not feature restrictions.
7. Auto Bills must visibly distinguish unparsed, review-needed, published, missing and duplicate statements; no invented amount or date.
8. Test loading, empty, validation, error, and accessible mobile/desktop states; test RLS and invite authorization.

**Build sequence:** Phase A: universal Spaces and onboarding; Phase B: core expenses and dashboard; Phase C: Auto Bills and reminders for shared homes; Phase D: measure retention and paid pilots; Phase E: deepen other Space presets only with evidence. B2B reimbursement stays a separate discovery track.
