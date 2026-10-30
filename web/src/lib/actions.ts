"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { supabaseServer } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { splitBill, type ShareInput, type SplitMethod } from "@/lib/domain/split";
import { emailReminder, notifyNewBill } from "@/lib/notify";
import { emailEnabled, sendEmail } from "@/lib/email";
import { inviteEmail } from "@/lib/domain/email-templates";
import { createHash } from "node:crypto";
import { SPACE_TYPES } from "@/lib/domain/spaces";
import { extractStatement, statementFromVision, statementKey, type Extraction } from "@/lib/domain/statement";
import { extractQuickAdd, extractReceipt, extractStatementFromImage, sniffImageType } from "@/lib/import/extract";
import { draftFromModel, type QuickDraft } from "@/lib/domain/quick-add";
import { receiptFromModel, type Receipt } from "@/lib/domain/receipt";
import { getSpaceContext, getUser } from "@/lib/data";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { gmailAccessToken, listBillLikeHeaders } from "@/lib/gmail-api";
import { DISCOVERY_QUERY, OTHER_STATE, STATES, groupBillSenders, parseSources, type BillSource, type DiscoveredSender } from "@/lib/domain/providers";

export type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const MESSAGES: Record<string, string> = {
  forbidden: "You don't have permission to do that in this Space.",
  bad_holder: "Pick a person in this Space, or type a name, but not both.",
  bad_last4: "Account digits should be exactly 4 numbers.",
  bad_category: "That kind of bill isn't supported here.",
  holder_not_member: "That person isn't an active member of this Space.",
  not_authenticated: "Please sign in again.",
  only_owner_or_payer: "Only the person who paid, or the Space owner, can add this bill.",
  payer_not_member: "The person who paid isn't an active member of this Space.",
  amount_positive: "The amount must be more than $0.00.",
  no_participants: "Choose at least one person to split with.",
  splits_must_equal_total: "The shares don't add up to the total.",
  negative_share: "Shares can't be negative.",
  duplicate_participant: "Each person can appear only once.",
  participant_not_member: "Someone in this split is no longer an active member.",
  stale_edit: "Someone else changed this bill while you were editing. Reload to see the latest version.",
  has_settlements: "A payment has already been recorded, so the amount and shares can't change. Edit the description, or void and re-create the bill.",
  has_confirmed_settlements: "This bill has confirmed payments, so it can't be voided.",
  bill_void: "This bill was voided.",
  payer_own_share: "That's your own share of a bill you paid. There's nothing to reimburse.",
  amount_exceeds_outstanding: "That's more than what's still owed on this share.",
  not_reported: "That payment is no longer waiting for confirmation.",
  rate_limited: "A reminder was already sent in the last 24 hours.",
  opted_out: "This person has turned off reminders.",
  invite_invalid: "This invite link has expired or was revoked. Ask the Space owner for a new one.",
  last_owner: "Make someone else an owner before you leave.",
  cannot_demote_self: "You can't remove your own owner role.",
  not_utility: "This expense doesn't track a provider payment.",
  due_date_required: "Add a due date before sharing this bill.",
  not_publishable: "This statement can't be published. It may be a duplicate or already handled.",
  statement_published: "This statement belongs to a published bill and can't be deleted. Void the bill instead.",
  already_published: "This statement is already a bill.",
  revision_has_settlements: "Payments were recorded on the original bill, so update it by hand.",
  not_found: "We couldn't find that.",
  me_required: "Choose which person is you in every group.",
  bad_amount: "Every balance must be more than $0.00.",
  self_debt: "Someone can't owe themselves.",
  unknown_person: "A balance refers to someone who isn't in the group.",
  bad_space_name: "Give each new Space a name.",
  no_groups: "Choose at least one group to import.",
  group_too_large: "That group is too large to import at once.",
  placeholder_not_joined: "They haven't joined yet. Send them an invite instead.",
  no_reminders_for_opening_balance: "Opening balances don't send reminders.",
  not_a_placeholder: "This person has already joined.",
  claim_invalid: "This invite link has expired, was already used, or was revoked. Ask for a new one.",
  already_member: "You're already in every Space this invite is for, so there's nothing new to join.",
  claim_own_invite: "This is an invite you created. Send it to the person it's for.",
  duplicate_balance: "A person appears twice in the same Space. Merge them first.",
  empty_space: "A Space has no balances. Remove it or add a balance.",
  bad_people: "Something went wrong. Please try again.",
  bad_member: "Something went wrong. Please try again.",
  bad_person_name: "Add a name (up to 80 characters).",
  undo_blocked: "This import can't be undone because something has happened since: a payment, a new bill, a dispute or someone joining.",
  import_source_reserved: "Something went wrong. Please try again.",
};

function friendly(err: { message?: string } | null): string {
  const msg = err?.message ?? "";
  const key = Object.keys(MESSAGES).find((k) => msg.includes(k));
  if (key) return MESSAGES[key];
  if (/fetch failed|network/i.test(msg)) return "We couldn't reach the server. Check your connection and try again. Nothing was saved twice.";
  return "Something went wrong. Please try again.";
}

const uuid = z.string().uuid();

// ---------- auth ----------
export async function signInAction(_: unknown, form: FormData): Promise<Result> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const next = safeNext(form.get("next"));
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, error: error.message.includes("Email not confirmed") ? "Confirm your email first. Check your inbox for the link." : "That email and password don't match." };
  redirect(next);
}

/** "Continue with Google" (section 21.2). Asks Google for name and email only, never Gmail. */
export async function signInWithGoogleAction(form: FormData): Promise<void> {
  const next = safeNext(form.get("next"));
  // Come back to the site the button was pressed on (preview, production or localhost),
  // so a missing or stale NEXT_PUBLIC_SITE_URL can't send people somewhere else.
  const origin = (await headers()).get("origin");
  const base = origin && /^https?:\/\/[^/]+$/.test(origin) ? origin : env.siteUrl();
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${base}/auth/callback?next=${encodeURIComponent(next)}`, scopes: "openid email profile", queryParams: { prompt: "select_account" } },
  });
  if (error || !data.url) redirect(`/login?error=google&next=${encodeURIComponent(next)}`);
  redirect(data.url);
}

export async function signUpAction(_: unknown, form: FormData): Promise<Result<{ email: string }>> {
  const parsed = z.object({
    name: z.string().trim().min(1, "Enter your name").max(80),
    email: z.string().trim().email("Enter a valid email"),
    password: z.string().min(8, "Use at least 8 characters"),
  }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const next = safeNext(form.get("next"));
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { display_name: parsed.data.name }, emailRedirectTo: `${env.siteUrl()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) return { ok: false, error: error.message };
  if (data.session) redirect(next);
  return { ok: true, data: { email: parsed.data.email } };
}

export async function sendResetAction(_: unknown, form: FormData): Promise<Result> {
  const email = String(form.get("email") ?? "").trim();
  const supabase = await supabaseServer();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${env.siteUrl()}/auth/callback?next=/reset-password` });
  // Same response whether or not the account exists (no enumeration)
  return { ok: true, data: undefined };
}

export async function updatePasswordAction(_: unknown, form: FormData): Promise<Result> {
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return { ok: false, error: "Use at least 8 characters" };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: "This reset link has expired. Request a new one." };
  redirect("/home");
}

export async function signOutAction() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}

function safeNext(v: FormDataEntryValue | null): string {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/home";
}

// ---------- spaces ----------
export async function rememberSpace(spaceId: string) {
  (await cookies()).set("eql_space", spaceId, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true });
}

export async function createSpaceAction(input: { name: string; type: string }): Promise<Result<{ id: string }>> {
  const p = z.object({ name: z.string().trim().min(1, "Give your Space a name").max(60), type: z.enum(SPACE_TYPES) }).safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("create_space", { p_name: p.data.name, p_type: p.data.type });
  if (error) return { ok: false, error: friendly(error) };
  await rememberSpace(data as string);
  return { ok: true, data: { id: data as string } };
}

export async function updateSpaceAction(spaceId: string, input: { name: string; type: string; defaultSplit: string }): Promise<Result> {
  const p = z.object({ name: z.string().trim().min(1).max(60), type: z.enum(SPACE_TYPES), defaultSplit: z.enum(["equal", "exact", "percent"]) }).safeParse(input);
  if (!p.success || !uuid.safeParse(spaceId).success) return { ok: false, error: "Check the Space name and type." };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("update_space", { p_space: spaceId, p_name: p.data.name, p_type: p.data.type, p_default_split: p.data.defaultSplit });
  if (error) return { ok: false, error: friendly(error) };
  revalidatePath(`/s/${spaceId}`, "layout");
  return { ok: true, data: undefined };
}

export async function createInviteAction(spaceId: string): Promise<Result<{ url: string }>> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("create_invitation", { p_space: spaceId });
  if (error) return { ok: false, error: friendly(error) };
  revalidatePath(`/s/${spaceId}/space`);
  return { ok: true, data: { url: `${env.siteUrl()}/join/${data}` } };
}

export async function revokeInviteAction(spaceId: string, invitationId: string): Promise<Result> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("revoke_invitation", { p_invitation: invitationId });
  if (error) return { ok: false, error: friendly(error) };
  revalidatePath(`/s/${spaceId}/space`);
  return { ok: true, data: undefined };
}

export async function acceptInviteAction(token: string): Promise<Result> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) return { ok: false, error: friendly(error) };
  await rememberSpace(data as string);
  redirect(`/s/${data}`);
}

export async function deactivateMemberAction(spaceId: string, memberId: string, self: boolean): Promise<Result> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("deactivate_member", { p_member: memberId });
  if (error) return { ok: false, error: friendly(error) };
  if (self) {
    (await cookies()).delete("eql_space");
    redirect("/home");
  }
  revalidatePath(`/s/${spaceId}`, "layout");
  return { ok: true, data: undefined };
}

export async function setRoleAction(spaceId: string, memberId: string, role: "owner" | "member"): Promise<Result> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("set_member_role", { p_member: memberId, p_role: role });
  if (error) return { ok: false, error: friendly(error) };
  revalidatePath(`/s/${spaceId}/space`);
  return { ok: true, data: undefined };
}

export async function updatePrefsAction(spaceId: string, input: { billArrival: boolean; days: number[]; optOut: boolean }): Promise<Result> {
  const supabase = await supabaseServer();
  const days = [...new Set(input.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 14))].sort((a, b) => b - a);
  const { error } = await supabase.rpc("update_notification_prefs", { p_space: spaceId, p_bill_arrival: input.billArrival, p_days: days, p_opt_out: input.optOut });
  if (error) return { ok: false, error: friendly(error) };
  revalidatePath(`/s/${spaceId}/space`);
  return { ok: true, data: undefined };
}

export async function updateNameAction(spaceId: string, name: string): Promise<Result> {
  const n = name.trim();
  if (!n || n.length > 80) return { ok: false, error: "Enter a name up to 80 characters." };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("update_display_name", { p_name: n });
  if (error) return { ok: false, error: friendly(error) };
  revalidatePath(`/s/${spaceId}`, "layout");
  return { ok: true, data: undefined };
}

// ---------- bills ----------
const billSchema = z.object({
  spaceId: uuid,
  title: z.string().trim().min(1, "Add a title").max(80),
  category: z.enum(["electricity", "gas", "water", "internet", "rent", "phone", "groceries", "travel", "dining", "other"]),
  amountCents: z.number().int().positive("The amount must be more than $0.00"),
  payerMemberId: uuid,
  billDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  note: z.string().max(500).optional(),
  method: z.enum(["equal", "exact", "percent"]),
  participants: z.array(z.object({ memberId: uuid, value: z.number().int().optional() })).min(1, "Choose at least one person"),
  clientRequestId: uuid,
});
export type BillInput = z.infer<typeof billSchema>;

export async function createBillAction(input: BillInput): Promise<Result<{ id: string }>> {
  const p = billSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  const d = p.data;
  const split = splitBill(d.amountCents, d.method, d.participants as ShareInput[]);
  if (!split.ok) return { ok: false, error: split.error };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("create_bill", {
    p_space: d.spaceId, p_title: d.title, p_category: d.category, p_amount_cents: d.amountCents, p_payer_member: d.payerMemberId,
    p_bill_date: d.billDate, p_due_date: d.dueDate, p_note: d.note ?? null, p_split_method: d.method,
    p_shares: split.shares.map((s) => ({ member_id: s.memberId, amount_cents: s.amountCents })), p_client_request_id: d.clientRequestId,
  });
  if (error) return { ok: false, error: friendly(error) };
  await notifyNewBill(data as string);
  revalidatePath(`/s/${d.spaceId}`, "layout");
  return { ok: true, data: { id: data as string } };
}

/**
 * Edits a bill. The amount and split are sent only when they changed; the split is worked out here with the
 * same domain code as a new bill, and the database refuses it once a payment has been recorded.
 */
export async function updateBillDetailsAction(spaceId: string, billId: string, input: { version: number; title: string; category: string; dueDate: string | null; note: string; amountCents?: number; method?: SplitMethod; participants?: ShareInput[] }): Promise<Result> {
  const supabase = await supabaseServer();
  const args: Record<string, unknown> = { p_bill: billId, p_version: input.version, p_title: input.title, p_category: input.category, p_due_date: input.dueDate || null, p_note: input.note };
  if (input.amountCents !== undefined) {
    if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) return { ok: false, error: "Enter an amount above $0." };
    if (!input.method || !input.participants?.length) return { ok: false, error: "Pick who shares this bill." };
    const split = splitBill(input.amountCents, input.method, input.participants);
    if (!split.ok) return { ok: false, error: split.error };
    args.p_amount_cents = input.amountCents;
    args.p_split_method = input.method;
    args.p_shares = split.shares.map((x) => ({ member_id: x.memberId, amount_cents: x.amountCents }));
  }
  const { error } = await supabase.rpc("update_bill", args);
  if (error) return { ok: false, error: friendly(error) };
  revalidatePath(`/s/${spaceId}`, "layout");
  return { ok: true, data: undefined };
}

export async function voidBillAction(spaceId: string, billId: string): Promise<Result> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("void_bill", { p_bill: billId });
  if (error) return { ok: false, error: friendly(error) };
  revalidatePath(`/s/${spaceId}`, "layout");
  return { ok: true, data: undefined };
}

async function simpleRpc(spaceId: string, fn: string, args: Record<string, unknown>): Promise<Result> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: friendly(error) };
  revalidatePath(`/s/${spaceId}`, "layout");
  return { ok: true, data: undefined };
}

export async function reportSettlementAction(spaceId: string, input: { splitId: string; amountCents: number; method: string; note: string; clientRequestId: string }): Promise<Result> {
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0) return { ok: false, error: "Enter an amount above $0.00." };
  return simpleRpc(spaceId, "report_settlement", {
    p_split: input.splitId, p_amount_cents: input.amountCents, p_method: input.method.slice(0, 40), p_note: input.note.slice(0, 500), p_client_request_id: input.clientRequestId,
  });
}
export async function confirmSettlementAction(spaceId: string, settlementId: string) {
  return simpleRpc(spaceId, "confirm_settlement", { p_settlement: settlementId });
}
export async function disputeSettlementAction(spaceId: string, settlementId: string, note: string) {
  return simpleRpc(spaceId, "dispute_settlement", { p_settlement: settlementId, p_note: note.slice(0, 500) });
}
export async function disputeSplitAction(spaceId: string, splitId: string, note: string) {
  return simpleRpc(spaceId, "dispute_split", { p_split: splitId, p_note: note.slice(0, 500) });
}
export async function resolveDisputeAction(spaceId: string, splitId: string) {
  return simpleRpc(spaceId, "resolve_split_dispute", { p_split: splitId });
}
export async function sendReminderAction(spaceId: string, splitId: string) {
  const r = await simpleRpc(spaceId, "send_reminder", { p_split: splitId });
  // The database allowed it (payer only, once a day): also email the person if they have joined.
  if (r.ok) await emailReminder(splitId, (await getUser())?.id ?? null);
  return r;
}
export async function reportUtilityPaidAction(spaceId: string, billId: string) {
  return simpleRpc(spaceId, "report_utility_paid", { p_bill: billId });
}

// ---------- Auto Bills ----------
const MAX_PDF_BYTES = 10 * 1024 * 1024;

export async function uploadStatementAction(spaceId: string, form: FormData): Promise<Result<{ id: string }>> {
  if (!uuid.safeParse(spaceId).success) return { ok: false, error: "Unknown Space." };
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a PDF, photo or screenshot of the bill." };
  if (file.size > MAX_PDF_BYTES) return { ok: false, error: "That file is over 10 MB." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const supabase = await supabaseServer();
  // Check signatures rather than trusting the browser-reported type
  const isPdf = String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  const imageType = isPdf ? null : sniffImageType(bytes);
  if (!isPdf && !imageType) return { ok: false, error: "That file isn't a PDF or a supported image (JPEG, PNG, WebP or HEIC)." };

  let e: Extraction, unreadable: boolean, storedPath: string | null = null;
  if (imageType) {
    // Photos are read in memory and never stored, like Splitwise screenshots
    if (!process.env.GEMINI_API_KEY) return { ok: false, error: "Reading photos isn't available right now. Upload the PDF instead." };
    const { data: requestId, error: limitErr } = await supabase.rpc("begin_extraction", { p_image_count: 1 });
    if (limitErr) return { ok: false, error: limitErr.message.includes("rate_limited") ? "You've reached the limit of 10 photo reads an hour. Try again later, or upload the PDF." : "Something went wrong. Please try again." };
    const { fields, usage } = await extractStatementFromImage({ bytes, mimeType: imageType });
    await supabase.rpc("finish_extraction", { p_id: requestId, p_latency_ms: usage.latencyMs, p_input_tokens: usage.inputTokens, p_output_tokens: usage.outputTokens, p_succeeded: fields !== null });
    e = statementFromVision(fields);
    unreadable = fields === null;
  } else {
    let text = "";
    try {
      const { extractText, getDocumentProxy } = await import("unpdf");
      // pdf.js detaches the buffer it's given; parse a copy so the original can still be stored
      const pdf = await getDocumentProxy(bytes.slice());
      const out = await extractText(pdf, { mergePages: false });
      text = (Array.isArray(out.text) ? out.text : [out.text]).join("\n");
    } catch {
      text = "";
    }
    const path = `${spaceId}/${crypto.randomUUID()}.pdf`;
    const { error: upErr } = await supabase.storage.from("statements").upload(path, bytes, { contentType: "application/pdf", upsert: false });
    // Error message only, never file contents
    if (upErr) console.warn(JSON.stringify({ event: "statement_store_failed", error: upErr.message }));
    storedPath = upErr ? null : path;
    e = extractStatement(text);
    unreadable = text.trim().length < 20;
  }

  const { data, error } = await supabase.rpc("ingest_uploaded_statement", {
    p_space: spaceId, p_file_path: storedPath, p_file_name: file.name.slice(0, 200),
    p_kind: unreadable ? "unreadable" : e.kind,
    p_provider: e.provider.value, p_amount_cents: e.amountDueCents.value, p_due_date: e.dueDate.value,
    p_period_start: e.periodStart, p_period_end: e.periodEnd, p_account_last4: e.accountLast4, p_statement_ref: e.statementId,
    p_statement_key: statementKey(e),
    p_reasons: unreadable ? [imageType ? "We couldn't read this photo. Enter the details yourself, or try a clearer photo." : "We couldn't read text from this PDF. It may be a scanned image. Try uploading a photo of it instead."] : e.reasons,
    p_parser_version: e.parserVersion,
  });
  if (error) return { ok: false, error: friendly(error) };
  revalidatePath(`/s/${spaceId}`, "layout");
  return { ok: true, data: { id: data as string } };
}

export async function publishStatementAction(input: {
  spaceId: string; statementId: string; title: string; category: string; amountCents: number; payerMemberId: string; dueDate: string;
  periodStart: string | null; periodEnd: string | null; method: "equal" | "exact" | "percent"; participants: ShareInput[]; clientRequestId: string;
}): Promise<Result<{ billId: string }>> {
  if (!input.dueDate) return { ok: false, error: MESSAGES.due_date_required };
  const split = splitBill(input.amountCents, input.method, input.participants);
  if (!split.ok) return { ok: false, error: split.error };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("publish_statement", {
    p_statement: input.statementId, p_title: input.title.trim(), p_category: input.category, p_amount_cents: input.amountCents,
    p_payer_member: input.payerMemberId, p_due_date: input.dueDate, p_period_start: input.periodStart || null, p_period_end: input.periodEnd || null,
    p_split_method: input.method, p_shares: split.shares.map((s) => ({ member_id: s.memberId, amount_cents: s.amountCents })),
    p_client_request_id: input.clientRequestId,
  });
  if (error) return { ok: false, error: friendly(error) };
  await notifyNewBill(data as string);
  revalidatePath(`/s/${input.spaceId}`, "layout");
  return { ok: true, data: { billId: data as string } };
}

export async function rejectStatementAction(spaceId: string, statementId: string) {
  return simpleRpc(spaceId, "reject_statement", { p_statement: statementId });
}

export async function deleteStatementAction(spaceId: string, statementId: string): Promise<Result> {
  if (!uuid.safeParse(spaceId).success || !uuid.safeParse(statementId).success) return { ok: false, error: "We couldn't identify this statement. Refresh the page and try again." };
  const supabase = await supabaseServer();
  const { data: statement, error: readError } = await supabase.from("statements").select("file_path").eq("id", statementId).maybeSingle();
  if (readError) return { ok: false, error: friendly(readError) };
  const { error } = await supabase.rpc("delete_statement", { p_statement: statementId });
  if (error) return { ok: false, error: friendly(error) };
  if (statement?.file_path) await supabase.storage.from("statements").remove([statement.file_path]);
  revalidatePath(`/s/${spaceId}`, "layout");
  return { ok: true, data: undefined };
}

export async function deleteStatementsAction(spaceId: string, statementIds: string[]): Promise<Result> {
  if (!uuid.safeParse(spaceId).success || statementIds.length === 0 || statementIds.length > 100 || statementIds.some((id) => !uuid.safeParse(id).success)) {
    return { ok: false, error: "Choose one or more valid statements to delete." };
  }
  const supabase = await supabaseServer();
  const { data: statements, error: readError } = await supabase.from("statements").select("id, file_path").eq("space_id", spaceId).in("id", statementIds);
  if (readError) return { ok: false, error: friendly(readError) };
  for (const statement of statements ?? []) {
    const { error } = await supabase.rpc("delete_statement", { p_statement: statement.id });
    if (error) return { ok: false, error: friendly(error) };
  }
  const paths = (statements ?? []).map((s) => s.file_path).filter((path): path is string => !!path);
  if (paths.length) await supabase.storage.from("statements").remove(paths);
  revalidatePath(`/s/${spaceId}`, "layout");
  return { ok: true, data: undefined };
}

export async function statementFileUrlAction(path: string): Promise<Result<{ url: string }>> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.storage.from("statements").createSignedUrl(path, 60);
  if (error || !data) return { ok: false, error: "The original file isn't available." };
  return { ok: true, data: { url: data.signedUrl } };
}

// ---------- Import from Splitwise ----------
export async function applyImportAction(plan: unknown, clientRequestId: string): Promise<Result<{ batchId: string; spaceIds: string[] }>> {
  if (!uuid.safeParse(clientRequestId).success || typeof plan !== "object" || plan === null) return { ok: false, error: "Something went wrong. Please try again." };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("apply_splitwise_import", { p_plan: plan, p_client_request_id: clientRequestId });
  if (error) return { ok: false, error: friendly(error) };
  const r = data as { batch_id: string; space_ids: string[] };
  if (r.space_ids[0]) await rememberSpace(r.space_ids[0]);
  revalidatePath("/", "layout");
  return { ok: true, data: { batchId: r.batch_id, spaceIds: r.space_ids } };
}

export async function undoImportAction(batchId: string): Promise<Result> {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("undo_import", { p_batch: batchId });
  if (error) return { ok: false, error: friendly(error) };
  (await cookies()).delete("eql_space");
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

export async function createPersonClaimAction(personId: string): Promise<Result<{ url: string }>> {
  if (!uuid.safeParse(personId).success) return { ok: false, error: "Unknown person." };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("create_person_claim", { p_person: personId });
  if (error) return { ok: false, error: friendly(error) };
  return { ok: true, data: { url: `${env.siteUrl()}/claim/${data}` } };
}

/**
 * Emails a personal invite for someone who hasn't joined. The address is used once and not stored. The sender cannot
 * write any of the text: the link must be a live claim this person created, and the names come from our own records.
 */
export async function emailInviteAction(link: string, email: string): Promise<Result> {
  const to = String(email ?? "").trim();
  if (to.length > 254 || !/^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/.test(to)) return { ok: false, error: "That doesn't look like an email address." };
  const prefix = `${env.siteUrl()}/claim/`;
  const token = link.startsWith(prefix) ? link.slice(prefix.length) : "";
  if (!/^[0-9a-f]{64}$/.test(token)) return { ok: false, error: "That invite link isn't valid. Create a new one." };
  if (!emailEnabled()) return { ok: false, error: "Sending email isn't switched on yet. Use Text or your own email app instead." };
  const user = await getUser();
  const admin = supabaseAdmin();
  if (!user || !admin) return { ok: false, error: MESSAGES.forbidden };
  // The link must be a live claim created by this person
  const { data: claim } = await admin.from("person_claims").select("created_by").eq("token_hash", createHash("sha256").update(token).digest("hex")).maybeSingle();
  if (!claim || claim.created_by !== user.id) return { ok: false, error: "That invite link isn't valid. Create a new one." };
  const supabase = await supabaseServer();
  const { data: allowed } = await supabase.rpc("begin_invite_email");
  if (allowed !== true) return { ok: false, error: "You've sent the most invite emails for today. Use Copy link or Text instead." };
  const { data: rows } = await admin.rpc("preview_person_claim", { p_token: token, p_client_key: createHash("sha256").update(user.id).digest("hex") });
  const p = (rows as { valid: boolean; inviter_name: string | null; person_name: string | null; spaces: { name: string }[] }[] | null)?.[0];
  if (!p?.valid) return { ok: false, error: "That invite link has expired. Create a new one." };
  const content = inviteEmail({ inviterName: p.inviter_name ?? "Someone", personName: p.person_name ?? "there", spaceNames: (p.spaces ?? []).map((x) => x.name), url: link });
  if (!(await sendEmail(to, content, "invite"))) return { ok: false, error: "We couldn't send that email. Try Text or your own email app." };
  return { ok: true, data: undefined };
}

export async function revokePersonClaimsAction(spaceId: string, personId: string): Promise<Result> {
  return simpleRpc(spaceId, "revoke_person_claims", { p_person: personId });
}

/** Adds someone who hasn't joined, by name only. Phone and email are never sent here. */
export async function addPersonAction(spaceId: string, name: string): Promise<Result<{ personId: string; memberId: string }>> {
  if (!uuid.safeParse(spaceId).success) return { ok: false, error: "Unknown Space." };
  const clean = name.replace(/\s+/g, " ").trim();
  if (!clean || clean.length > 80) return { ok: false, error: MESSAGES.bad_person_name };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("add_placeholder_member", { p_space: spaceId, p_name: clean });
  if (error) return { ok: false, error: friendly(error) };
  revalidatePath(`/s/${spaceId}`, "layout");
  const r = data as { person_id: string; member_id: string };
  return { ok: true, data: { personId: r.person_id, memberId: r.member_id } };
}

export async function claimPersonAction(token: string): Promise<Result> {
  if (!/^[0-9a-f]{64}$/.test(token)) return { ok: false, error: MESSAGES.claim_invalid };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("claim_person", { p_token: token });
  if (error) return { ok: false, error: friendly(error) };
  const ids = (data as { space_ids: string[] }).space_ids;
  await rememberSpace(ids[0]);
  revalidatePath("/", "layout");
  redirect(`/s/${ids[0]}?claimed=${ids.length}`);
}

export async function dismissNotificationsAction(ids: number[]): Promise<Result> {
  if (!ids.length || ids.some((i) => !Number.isSafeInteger(i))) return { ok: true, data: undefined };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("mark_notifications_read", { p_ids: ids });
  if (error) return { ok: false, error: friendly(error) };
  revalidatePath("/", "layout");
  return { ok: true, data: undefined };
}

// ---------- AI entry (spec section 19): the model only reads; the domain layer does the math ----------
async function startAiRequest(kind: "quick_add" | "receipt"): Promise<Result<string>> {
  if (!process.env.GEMINI_API_KEY) return { ok: false, error: "This isn't available right now. You can add the bill by hand." };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("begin_ai_request", { p_kind: kind });
  if (error) return { ok: false, error: error.message.includes("rate_limited") ? "You've hit this hour's limit. Try again later, or add the bill by hand." : friendly(error) };
  return { ok: true, data: data as string };
}

async function finishAiRequest(id: string, usage: { latencyMs: number; inputTokens: number; outputTokens: number }, ok: boolean) {
  const supabase = await supabaseServer();
  await supabase.rpc("finish_extraction", { p_id: id, p_latency_ms: usage.latencyMs, p_input_tokens: usage.inputTokens, p_output_tokens: usage.outputTokens, p_succeeded: ok });
}

/** Used only when the on-device parser can't read the message (e.g. "Ana owes 40, rest equal"). */
export async function quickAddAiAction(spaceId: string, message: string): Promise<Result<QuickDraft>> {
  const text = String(message ?? "").replace(/\s+/g, " ").trim();
  if (!text) return { ok: false, error: "Type what you paid, like \"groceries 45 split with all\"." };
  if (text.length > 200) return { ok: false, error: "Keep it under 200 characters." };
  if (!uuid.safeParse(spaceId).success || !(await getSpaceContext(spaceId))?.me) return { ok: false, error: MESSAGES.forbidden };
  const started = await startAiRequest("quick_add");
  if (!started.ok) return started;
  const { raw, usage } = await extractQuickAdd(text);
  const draft = draftFromModel(raw, text);
  await finishAiRequest(started.data, usage, !!draft);
  if (!draft) return { ok: false, error: "We couldn't understand that. Try \"what, amount, who\", like \"dinner 60 with Raj\"." };
  return { ok: true, data: draft };
}

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

/** Reads a receipt image in memory. The image is not stored. */
export async function scanReceiptAction(spaceId: string, form: FormData): Promise<Result<Receipt>> {
  if (!uuid.safeParse(spaceId).success || !(await getSpaceContext(spaceId))?.me) return { ok: false, error: MESSAGES.forbidden };
  const file = form.get("receipt");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a photo or screenshot of the receipt." };
  if (file.size > MAX_RECEIPT_BYTES) return { ok: false, error: "That image is over 10 MB. Try a screenshot instead." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = sniffImageType(bytes);
  if (!mimeType) return { ok: false, error: "That isn't a photo we can read. Use a JPEG, PNG, WebP or HEIC image." };
  const started = await startAiRequest("receipt");
  if (!started.ok) return started;
  const { raw, usage } = await extractReceipt({ bytes, mimeType });
  const receipt = receiptFromModel(raw);
  await finishAiRequest(started.data, usage, !!receipt && receipt.ok);
  if (!receipt) return { ok: false, error: "We couldn't read that receipt. Try a clearer photo, or add the bill by hand." };
  if (!receipt.ok) return { ok: false, error: receipt.error };
  return { ok: true, data: receipt.receipt };
}

// ---------- Who sends your bills (spec sections 17.2 and 21.4) ----------
export async function saveBillSourcesAction(spaceId: string, state: string, choices: { category: string; providerId: string | null; typed: string | null; address?: string }[]): Promise<Result> {
  if (!uuid.safeParse(spaceId).success) return { ok: false, error: MESSAGES.forbidden };
  if (state !== OTHER_STATE && !(state in STATES)) return { ok: false, error: "Pick your state from the list." };
  const sources = parseSources(state, choices);
  if (!sources || sources.length === 0) return { ok: false, error: "Pick at least one company, so we know which emails to look at." };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("set_bill_sources", { p_space: spaceId, p_state: state, p_sources: sources });
  if (error) return { ok: false, error: friendly(error) };
  revalidatePath(`/s/${spaceId}/auto-bills`);
  return { ok: true, data: undefined };
}

/** "Whose name is each utility in?" Visible to every member. Records only; never moves money. */
export async function setUtilityHolderAction(spaceId: string, category: string, holder: { memberId?: string; name?: string }, last4: string | null): Promise<Result> {
  if (!uuid.safeParse(spaceId).success) return { ok: false, error: MESSAGES.forbidden };
  if (holder.memberId !== undefined && !uuid.safeParse(holder.memberId).success) return { ok: false, error: MESSAGES.holder_not_member };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("set_utility_holder", { p_space: spaceId, p_category: category, p_member: holder.memberId ?? null, p_name: holder.name ?? null, p_last4: last4 });
  if (error) return { ok: false, error: friendly(error) };
  revalidatePath(`/s/${spaceId}/space`);
  return { ok: true, data: undefined };
}

export async function clearUtilityHolderAction(spaceId: string, category: string): Promise<Result> {
  if (!uuid.safeParse(spaceId).success) return { ok: false, error: MESSAGES.forbidden };
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("clear_utility_holder", { p_space: spaceId, p_category: category });
  if (error) return { ok: false, error: friendly(error) };
  revalidatePath(`/s/${spaceId}/space`);
  return { ok: true, data: undefined };
}

/** "Find my bills in Gmail": bill-like senders from the user's own inbox, headers only, nothing stored. */
export async function discoverBillSendersAction(spaceId: string): Promise<Result<DiscoveredSender[]>> {
  if (!uuid.safeParse(spaceId).success) return { ok: false, error: MESSAGES.forbidden };
  const ctx = await getSpaceContext(spaceId);
  if (!ctx?.me) return { ok: false, error: MESSAGES.forbidden };
  const admin = supabaseAdmin();
  if (!admin) return { ok: false, error: "Gmail isn't set up on this server yet." };
  const { data: connection } = await admin.from("gmail_connections").select("refresh_token_ciphertext").eq("user_id", ctx.userId).eq("status", "active").maybeSingle();
  if (!connection) return { ok: false, error: "Connect Gmail first, then we can look for your bills." };
  try {
    const token = await gmailAccessToken(connection);
    const headers = await listBillLikeHeaders(token, DISCOVERY_QUERY);
    const supabase = await supabaseServer();
    const { data: chosen } = await supabase.from("space_bill_sources").select("sources").eq("space_id", spaceId).maybeSingle();
    return { ok: true, data: groupBillSenders(headers, (chosen?.sources ?? []) as BillSource[]) };
  } catch (e) {
    const revoked = e instanceof Error && e.message === "gmail_token_revoked";
    return { ok: false, error: revoked ? "Google access was removed. Reconnect Gmail and try again." : "We couldn't read Gmail just now. Try again in a minute." };
  }
}
