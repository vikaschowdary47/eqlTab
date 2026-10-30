import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { emailEnabled, sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { dueSoonEmail, newBillEmail, reminderEmail } from "@/lib/domain/email-templates";
import { splitPosition } from "@/lib/domain/balances";
import { daysUntil, shouldSendDueReminder } from "@/lib/domain/reminders";

/**
 * Emails to people who have joined a Space. Everything here is best effort: it never throws, and it does
 * nothing until RESEND_API_KEY is set. People who haven't joined have no address on file and are reached
 * by the personal links instead. Each email is about the recipient's own share only.
 */
type Admin = NonNullable<ReturnType<typeof supabaseAdmin>>;
type Member = { id: string; user_id: string | null; display_name: string | null; status: string };

const billUrl = (spaceId: string, billId: string) => `${env.siteUrl()}/s/${spaceId}/bills/${billId}`;

async function emailOf(admin: Admin, userId: string): Promise<string | null> {
  const { data } = await admin.auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}

async function nameOfUser(admin: Admin, userId: string | null, fallback: string | null): Promise<string> {
  if (userId) {
    const { data } = await admin.from("profiles").select("display_name").eq("id", userId).maybeSingle();
    if (data?.display_name) return data.display_name as string;
  }
  return fallback ?? "Someone";
}

async function prefsOf(admin: Admin, userId: string, spaceId: string) {
  const { data } = await admin.from("notification_prefs").select("bill_arrival, reminder_days, reminders_opt_out").eq("user_id", userId).eq("space_id", spaceId).maybeSingle();
  return { billArrival: data?.bill_arrival ?? true, reminderDays: (data?.reminder_days as number[] | undefined) ?? null, optOut: data?.reminders_opt_out ?? false };
}

/** A new bill was shared: tell each joined person in the split (except whoever paid) their share. */
export async function notifyNewBill(billId: string): Promise<void> {
  try {
    const admin = supabaseAdmin();
    if (!admin || !emailEnabled()) return;
    const { data: b } = await admin.from("bills").select("id, title, space_id, due_date, status, source, payer_member_id").eq("id", billId).maybeSingle();
    if (!b || b.status !== "published" || b.source === "import") return;
    const [{ data: space }, { data: splits }, { data: members }] = await Promise.all([
      admin.from("spaces").select("name").eq("id", b.space_id).maybeSingle(),
      admin.from("bill_splits").select("member_id, amount_cents").eq("bill_id", b.id),
      admin.from("space_members").select("id, user_id, display_name, status").eq("space_id", b.space_id).limit(60),
    ]);
    const byId = new Map(((members ?? []) as Member[]).map((m) => [m.id, m]));
    const payer = byId.get(b.payer_member_id);
    const payerName = await nameOfUser(admin, payer?.user_id ?? null, payer?.display_name ?? null);
    for (const s of splits ?? []) {
      const m = byId.get(s.member_id);
      if (!m?.user_id || m.status !== "active" || s.member_id === b.payer_member_id || s.amount_cents <= 0) continue;
      if (!(await prefsOf(admin, m.user_id, b.space_id)).billArrival) continue;
      const to = await emailOf(admin, m.user_id);
      if (to) await sendEmail(to, newBillEmail({ payerName, billTitle: b.title, shareCents: s.amount_cents, dueDate: b.due_date, spaceName: space?.name ?? "your Space", url: billUrl(b.space_id, b.id) }), "new_bill");
    }
  } catch { /* an email must never break saving a bill */ }
}

/** A payer pressed "Remind": email that person too, if they have joined. The database already rate-limits this to once a day. */
export async function emailReminder(splitId: string, senderUserId: string | null): Promise<void> {
  try {
    const admin = supabaseAdmin();
    if (!admin || !emailEnabled()) return;
    const { data: sp } = await admin.from("bill_splits").select("id, bill_id, member_id, amount_cents").eq("id", splitId).maybeSingle();
    if (!sp) return;
    const [{ data: b }, { data: m }, { data: paid }] = await Promise.all([
      admin.from("bills").select("id, title, space_id, due_date, payer_member_id").eq("id", sp.bill_id).maybeSingle(),
      admin.from("space_members").select("id, user_id, display_name, status").eq("id", sp.member_id).maybeSingle(),
      admin.from("settlements").select("amount_cents").eq("bill_split_id", splitId).eq("status", "confirmed"),
    ]);
    if (!b || !m?.user_id || m.status !== "active") return;
    const owed = Math.max(0, sp.amount_cents - (paid ?? []).reduce((a, x) => a + x.amount_cents, 0));
    if (owed <= 0) return;
    const to = await emailOf(admin, m.user_id);
    if (!to) return;
    const fromName = await nameOfUser(admin, senderUserId, null);
    await sendEmail(to, reminderEmail({ fromName, billTitle: b.title, owedCents: owed, dueDate: b.due_date, url: billUrl(b.space_id, b.id) }), "reminder");
  } catch { /* best effort */ }
}

/** The daily job: email each joined person whose share is due soon, once per reminder day. Returns how many were sent. */
export async function sendDueReminders(today: string): Promise<{ checked: number; sent: number }> {
  const admin = supabaseAdmin();
  if (!admin || !emailEnabled()) return { checked: 0, sent: 0 };
  const horizon = new Date(Date.parse(`${today}T00:00:00Z`) + 14 * 86_400_000).toISOString().slice(0, 10);
  const { data: bills } = await admin
    .from("bills")
    .select("id, title, space_id, due_date, payer_member_id, bill_splits(id, member_id, amount_cents, settlements(amount_cents, status))")
    .eq("status", "published").neq("source", "import").gte("due_date", today).lte("due_date", horizon).limit(500);
  let checked = 0, sent = 0;
  for (const b of bills ?? []) {
    if (!b.due_date) continue;
    const daysLeft = daysUntil(b.due_date, today);
    const { data: members } = await admin.from("space_members").select("id, user_id, display_name, status").eq("space_id", b.space_id).limit(60);
    const byId = new Map(((members ?? []) as Member[]).map((m) => [m.id, m]));
    const payer = byId.get(b.payer_member_id);
    const payerName = await nameOfUser(admin, payer?.user_id ?? null, payer?.display_name ?? null);
    for (const s of b.bill_splits ?? []) {
      const m = byId.get(s.member_id);
      if (!m?.user_id || m.status !== "active") continue;
      checked++;
      const prefs = await prefsOf(admin, m.user_id, b.space_id);
      const settlements = ((s.settlements ?? []) as { amount_cents: number; status: "reported" | "confirmed" | "disputed" | "reversed" }[]).map((x) => ({ amountCents: x.amount_cents, status: x.status }));
      const split = { id: s.id, memberId: s.member_id, payerMemberId: b.payer_member_id, amountCents: s.amount_cents, settlements };
      if (!shouldSendDueReminder({ split, daysLeft, reminderDays: prefs.reminderDays, optOut: prefs.optOut })) continue;
      // Claim this reminder first; if it was already sent (a second run), the insert returns nothing.
      const { data: claimed } = await admin.from("due_reminder_sends").upsert({ bill_split_id: s.id, days_before: daysLeft }, { onConflict: "bill_split_id,days_before", ignoreDuplicates: true }).select("bill_split_id");
      if (!claimed?.length) continue;
      const to = await emailOf(admin, m.user_id);
      if (to && (await sendEmail(to, dueSoonEmail({ billTitle: b.title, owedCents: splitPosition(split).outstandingCents, daysLeft, dueDate: b.due_date, payerName, url: billUrl(b.space_id, b.id) }), "due_soon"))) sent++;
    }
  }
  return { checked, sent };
}
