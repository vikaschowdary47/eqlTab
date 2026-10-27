/**
 * AI reading of bill emails (works for any company, no per-company rules).
 *
 * The rule-based reader (statement.ts) runs first: free and instant. When it can't tell what an
 * email is, or misses the amount or due date, the model reads the email and fills only the gaps.
 * The model's answer is validated here like any untrusted input, and anything it adds is marked
 * for review. People still confirm every bill before anyone sees a share.
 */
import { parseDollars, type Cents } from "./money";
import { toISODate, type Extraction } from "./statement";

export const EMAIL_KINDS = ["bill", "bill_ready_notice", "payment_receipt", "usage_summary", "marketing", "other"] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];

export interface AiBill {
  kind: EmailKind;
  /** Who sends the bill and takes the payment, e.g. "Public Grid". */
  biller: string | null;
  /** The utility behind it, when different, e.g. "ComEd". */
  utility: string | null;
  amountDueCents: Cents | null;
  /** The pay-by date, or the autopay withdrawal date when that's all there is. */
  dueDate: string | null;
  /** What the card or bank is actually charged, when stated and different (fees). */
  chargeCents: Cents | null;
  periodStart: string | null;
  periodEnd: string | null;
  /** 0..1, the model's own certainty about the amount and the due date. */
  amountConfidence: number;
  dueDateConfidence: number;
}

/** Below this, an AI value is not used at all; the field stays missing for the person to fill. */
export const MIN_CONFIDENCE = 0.7;

const money = (v: unknown): Cents | null => {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return Number.isSafeInteger(v) && v >= 0 ? v : NaN;
  if (typeof v === "string") { const c = parseDollars(v); return c === null ? NaN : c; }
  return NaN;
};
const date = (v: unknown): string | null | typeof INVALID => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string") return INVALID;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return toISODate(`${v.slice(5, 7)}/${v.slice(8, 10)}/${v.slice(0, 4)}`) ?? INVALID;
  return toISODate(v) ?? INVALID;
};
const INVALID = Symbol("invalid");
const conf = (v: unknown) => (typeof v === "number" && v >= 0 && v <= 1 ? v : 0);
const name = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 60) : null);

/** Validates the model's JSON. Off-schema answers are rejected, never patched up. */
export function billFromModel(raw: unknown): AiBill | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!EMAIL_KINDS.includes(o.kind as EmailKind)) return null;
  const amount = money(o.amount_due_cents), charge = money(o.charge_cents);
  if (Number.isNaN(amount) || Number.isNaN(charge)) return null;
  const due = date(o.due_date), ps = date(o.period_start), pe = date(o.period_end);
  if (due === INVALID || ps === INVALID || pe === INVALID) return null;
  return {
    kind: o.kind as EmailKind, biller: name(o.biller), utility: name(o.utility),
    amountDueCents: amount, dueDate: due, chargeCents: charge,
    periodStart: ps, periodEnd: pe,
    amountConfidence: conf(o.amount_confidence), dueDateConfidence: conf(o.due_date_confidence),
  };
}

/** Should we ask the model about this email? Only when the rules couldn't finish the job. */
export function needsAi(rules: Extraction, verdict: "statement" | "notice" | "skip"): boolean {
  if (verdict === "skip") return false;
  return rules.amountDueCents.status !== "found" || rules.dueDate.status !== "found";
}

export type Merged = { verdict: "statement" | "notice" | "skip"; extraction: Extraction };

/**
 * Combines the rules' result with the model's. The rules win where they found something; the model
 * fills gaps it is confident about. Anything the model contributed is listed in the reasons, so the
 * review screen says "read by AI, check this".
 */
export function mergeWithAi(rules: Extraction, verdict: "statement" | "notice" | "skip", ai: AiBill | null): Merged {
  if (!ai) return { verdict, extraction: rules };
  // The model sees the whole email, so it decides what kind of email this is.
  if (ai.kind === "payment_receipt" || ai.kind === "usage_summary" || ai.kind === "marketing" || ai.kind === "other") {
    return { verdict: "skip", extraction: rules };
  }
  const e: Extraction = { ...rules, reasons: [...rules.reasons], provider: { ...rules.provider }, amountDueCents: { ...rules.amountDueCents }, dueDate: { ...rules.dueDate } };
  const added: string[] = [];

  if (e.amountDueCents.status !== "found" && ai.amountDueCents !== null && ai.amountConfidence >= MIN_CONFIDENCE) {
    e.amountDueCents = { value: ai.amountDueCents, status: "found" };
    added.push("amount");
  } else if (e.amountDueCents.status === "found" && ai.amountDueCents !== null && ai.amountDueCents !== e.amountDueCents.value) {
    e.reasons.push(`Two readings of the amount disagree ($${(e.amountDueCents.value! / 100).toFixed(2)} and $${(ai.amountDueCents / 100).toFixed(2)}). Check the bill.`);
  }
  if (e.dueDate.status !== "found" && ai.dueDate && ai.dueDateConfidence >= MIN_CONFIDENCE) {
    e.dueDate = { value: ai.dueDate, status: "found" };
    added.push("due date");
  }
  if (!e.periodStart && ai.periodStart && ai.periodEnd) { e.periodStart = ai.periodStart; e.periodEnd = ai.periodEnd; }

  const amount = e.amountDueCents.value;
  if (ai.chargeCents !== null && amount !== null && ai.chargeCents > amount && !e.reasons.some((r) => r.startsWith("Card charge"))) {
    e.reasons.push(`Card charge is $${(ai.chargeCents / 100).toFixed(2)}, $${((ai.chargeCents - amount) / 100).toFixed(2)} more than the bill (likely a fee). Decide whether to split the fee too.`);
  }

  // Reasons that the model has now answered no longer apply.
  if (added.includes("amount")) e.reasons = e.reasons.filter((r) => !/^Amount due not found|^Found more than one amount/.test(r));
  if (added.includes("due date")) e.reasons = e.reasons.filter((r) => !/^Due date not found|^Found more than one due date/.test(r));
  if (added.length) e.reasons.push(`Read by AI: ${added.join(" and ")}. Check before sharing.`);

  const hasDetails = e.amountDueCents.status === "found";
  const outVerdict = hasDetails ? "statement" : "notice";
  e.kind = outVerdict === "notice" ? "notice_only" : "statement";
  e.needsReview = e.reasons.length > 0;
  e.parserVersion = added.length ? `${rules.parserVersion}+ai` : rules.parserVersion;
  return { verdict: outVerdict, extraction: e };
}

/** Email HTML to plain text for the model: no tags, styles, scripts or tracking links. */
export function emailText(raw: string, max = 12_000): string {
  return raw
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d|td)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&#39;|&apos;/gi, "'").replace(/&quot;/gi, '"')
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{2,}/g, "\n")
    .trim()
    .slice(0, max);
}
