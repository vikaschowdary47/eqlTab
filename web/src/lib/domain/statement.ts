/**
 * Rule-based extraction from statement text (PDF text layer or email body).
 * It never guesses: a field is either found unambiguously, ambiguous, or missing,
 * and anything short of "found" sends the statement to human review.
 */
import { parseDollars, type Cents } from "./money";

export type FieldStatus = "found" | "ambiguous" | "missing";

export interface Extraction {
  kind: "statement" | "notice_only";
  provider: { value: string | null; status: FieldStatus };
  amountDueCents: { value: Cents | null; status: FieldStatus };
  dueDate: { value: string | null; status: FieldStatus };
  periodStart: string | null;
  periodEnd: string | null;
  accountLast4: string | null;
  statementId: string | null;
  needsReview: boolean;
  reasons: string[];
  parserVersion: string;
}

export const PARSER_VERSION = "rules-2";
/** Above this, a human must look even when every field parsed cleanly. */
export const LARGE_AMOUNT_CENTS = 100_000;

const PROVIDERS: { name: string; re: RegExp }[] = [
  { name: "ComEd", re: /\bcomed\b|commonwealth edison/i },
  { name: "Southern Connecticut Gas", re: /southern connecticut gas|\bscg\b/i },
  { name: "Con Edison", re: /con\s?edison|coned\b/i },
  { name: "PG&E", re: /pg&e|pacific gas and electric/i },
  { name: "Xfinity", re: /xfinity|comcast/i },
  { name: "Spectrum", re: /\bspectrum\b/i },
  { name: "Verizon", re: /\bverizon\b/i },
  { name: "AT&T", re: /\bat&t\b/i },
  { name: "Peoples Gas", re: /peoples gas/i },
  { name: "Eversource", re: /eversource/i },
];

const MONTHS = "jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec";
const MONTH_NUM: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const DATE =`(\\d{1,2}/\\d{1,2}/\\d{2,4}|(?:${MONTHS})[a-z]*\\.?\\s+\\d{1,2},?\\s+\\d{4})`;
const MONEY = `\\$\\s?([\\d,]+\\.\\d{2})`;

// "Your monthly gas bill in the amount of $292.23 is now available": the label sits before the number. Only bill/statement/balance
// wording counts, so a "late fee in the amount of $25" is never read as the amount due.
const AMOUNT_LABELS = /(total amount due|amount due|total due|please pay|balance due|new charges due|(?:bill|statement|balance) (?:is )?in the amount of|bill amount)/i;
// Autopay services (e.g. Public Grid) give no due date, only when they'll take the payment: that's the date that matters.
const DUE_LABELS = /(payment due date|due date|due by|please pay by|pay by|will be (?:withdrawn|charged|debited|drafted|paid) on|scheduled (?:for|on)|auto-?pay date)/i;
/** "$97.62 payment will be withdrawn on …": what the card is actually charged, which can include a fee. */
const CHARGE = /\$\s?([\d,]+\.\d{2})\s+(?:payment\s+)?will be (?:withdrawn|charged|debited|drafted)/i;

export function toISODate(s: string): string | null {
  const t = s.trim().replace(/\.(?=\s)/, "");
  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return iso(y, Number(m[1]), Number(m[2]));
  }
  m = t.match(new RegExp(`^(${MONTHS})[a-z]*\\s+(\\d{1,2}),?\\s+(\\d{4})$`, "i"));
  if (m) {
    const month = MONTH_NUM[m[1].toLowerCase()];
    return iso(Number(m[3]), month, Number(m[2]));
  }
  return null;
}

function iso(y: number, mo: number, d: number): string | null {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function uniq<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

/** Values that appear on the same line as a label, or on the line right after it. */
function labeled(lines: string[], label: RegExp, value: RegExp): string[] {
  const out: string[] = [];
  lines.forEach((line, i) => {
    if (!label.test(line)) return;
    const after = line.slice(line.search(label));
    const hit = after.match(value) ?? lines[i + 1]?.match(value);
    if (hit) out.push(hit[1]);
  });
  return out;
}

export function extractStatement(text: string): Extraction {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const reasons: string[] = [];

  const providers = uniq(PROVIDERS.filter((p) => p.re.test(text)).map((p) => p.name));
  const provider =
    providers.length === 1 ? { value: providers[0], status: "found" as const }
    : providers.length > 1 ? { value: null, status: "ambiguous" as const }
    : { value: null, status: "missing" as const };

  const amounts = uniq(labeled(lines, AMOUNT_LABELS, new RegExp(MONEY)).map((a) => parseDollars(a)).filter((a): a is number => a !== null));
  const amountDueCents =
    amounts.length === 1 ? { value: amounts[0], status: "found" as const }
    : amounts.length > 1 ? { value: null, status: "ambiguous" as const }
    : { value: null, status: "missing" as const };

  const dues = uniq(labeled(lines, DUE_LABELS, new RegExp(DATE, "i")).map(toISODate).filter((d): d is string => d !== null));
  const dueDate =
    dues.length === 1 ? { value: dues[0], status: "found" as const }
    : dues.length > 1 ? { value: null, status: "ambiguous" as const }
    : { value: null, status: "missing" as const };

  const period = text.match(new RegExp(`(?:billing|service) period[^\\d\\w]*(?:from\\s+)?${DATE}\\s*(?:-|to|through|–)\\s*${DATE}`, "i"));
  const periodStart = period ? toISODate(period[1]) : null;
  const periodEnd = period ? toISODate(period[2]) : null;

  const acct = text.match(/account (?:number|no\.?|#)[:\s#]*([\d\- ]{6,})/i);
  const accountLast4 = acct ? acct[1].replace(/\D/g, "").slice(-4) || null : null;
  const sid = text.match(/(?:statement|invoice|bill) (?:number|no\.?|#|id)[:\s#]*([A-Z0-9-]{4,})/i);
  const statementId = sid ? sid[1] : null;

  const looksLikeNotice =
    amountDueCents.status === "missing" && dueDate.status === "missing" &&
    /(statement is ready|bill is ready|view your bill|sign in to view|log in to view|is now available)/i.test(text);

  if (provider.status !== "found") reasons.push(provider.status === "ambiguous" ? "More than one provider name appears" : "Provider not recognized");
  if (amountDueCents.status !== "found") reasons.push(amountDueCents.status === "ambiguous" ? "Found more than one amount due" : "Amount due not found");
  if (dueDate.status !== "found") reasons.push(dueDate.status === "ambiguous" ? "Found more than one due date" : "Due date not found");
  if (amountDueCents.value !== null && amountDueCents.value >= LARGE_AMOUNT_CENTS) reasons.push("Amount is unusually large");
  if (amountDueCents.value === 0) reasons.push("Amount due is $0.00");
  const charge = text.match(CHARGE);
  const chargeCents = charge ? parseDollars(charge[1]) : null;
  if (chargeCents !== null && amountDueCents.value !== null && chargeCents > amountDueCents.value) {
    reasons.push(`Card charge is $${(chargeCents / 100).toFixed(2)}, $${((chargeCents - amountDueCents.value) / 100).toFixed(2)} more than the bill (likely a fee). Decide whether to split the fee too.`);
  }

  return {
    kind: looksLikeNotice ? "notice_only" : "statement",
    provider, amountDueCents, dueDate, periodStart, periodEnd, accountLast4, statementId,
    needsReview: reasons.length > 0,
    reasons,
    parserVersion: PARSER_VERSION,
  };
}

/** Identity used for duplicate and revision detection. */
export function statementKey(e: Pick<Extraction, "provider" | "accountLast4" | "periodStart" | "periodEnd" | "statementId">): string | null {
  if (!e.provider.value) return null;
  if (e.periodStart && e.periodEnd) return [e.provider.value, e.accountLast4 ?? "", e.periodStart, e.periodEnd].join("|");
  if (e.statementId) return [e.provider.value, e.accountLast4 ?? "", "id", e.statementId].join("|");
  return null;
}

export const VISION_PARSER_VERSION = "vision-1";
export const EMAIL_AI_PARSER_VERSION = "email-ai-1";
/** The most email text ever sent to the model. */
export const EMAIL_AI_MAX_CHARS = 8000;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Builds an Extraction from what a vision model read off a photo or screenshot of a bill.
 * Same contract as the text parser: a field the model wasn't sure of is "ambiguous",
 * so it goes to human review rather than being trusted.
 */
export function statementFromVision(raw: unknown, source: "photo" | "email" = "photo"): Extraction {
  const o = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const conf = (k: string) => (typeof o[`${k}_confidence`] === "number" ? (o[`${k}_confidence`] as number) : 0);
  const str = (k: string, max = 80) => (typeof o[k] === "string" && (o[k] as string).trim() ? (o[k] as string).trim().slice(0, max) : null);
  const date = (k: string) => { const v = str(k, 10); return v && ISO.test(v) && toISODate(v.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$2/$3/$1")) === v ? v : null; };
  const field = <T,>(value: T | null, c: number) =>
    value === null ? { value: null, status: "missing" as const } : c >= 0.7 ? { value, status: "found" as const } : { value: null, status: "ambiguous" as const };

  const cents = typeof o.amount_due_cents === "number" && Number.isSafeInteger(o.amount_due_cents) && o.amount_due_cents >= 0 ? o.amount_due_cents : null;
  const provider = field(str("provider"), conf("provider"));
  const amountDueCents = field(cents, conf("amount_due"));
  const dueDate = field(date("due_date"), conf("due_date"));
  const reasons: string[] = [source === "email" ? "Read by AI from the email. Check every field against the original." : "Read from a photo. Check every field against the original."];
  if (provider.status !== "found") reasons.push(provider.status === "ambiguous" ? "Provider name was hard to read" : "Provider not found");
  if (amountDueCents.status !== "found") reasons.push(amountDueCents.status === "ambiguous" ? "Amount due was hard to read" : "Amount due not found");
  if (dueDate.status !== "found") reasons.push(dueDate.status === "ambiguous" ? "Due date was hard to read" : "Due date not found");
  if (cents !== null && cents >= LARGE_AMOUNT_CENTS) reasons.push("Amount is unusually large");
  if (cents === 0) reasons.push("Amount due is $0.00");
  const last4 = str("account_last4", 4);

  return {
    kind: o.is_bill === false ? "notice_only" : "statement",
    provider, amountDueCents, dueDate,
    periodStart: date("period_start"), periodEnd: date("period_end"),
    accountLast4: last4 && /^\d{4}$/.test(last4) ? last4 : null,
    statementId: str("statement_number", 40),
    needsReview: true, // photos are always checked by a person
    reasons,
    parserVersion: source === "email" ? EMAIL_AI_PARSER_VERSION : VISION_PARSER_VERSION,
  };
}

// ---------- AI fallback for emailed bills ----------
// The rule-based parser runs first. Only when it cannot find the amount or due date is the text sent to
// the model. The model is untrusted: it only fills the fixed bill fields, every value must appear in
// the email itself, and the result always goes to human review.

/** Masks long digit runs (account numbers, phone numbers) before text leaves for the model. The last 4 digits stay. */
export function maskForAi(text: string): string {
  return text
    .replace(/\d[\d -]{7,}\d/g, (m) => {
      const d = m.replace(/\D/g, "");
      return d.length >= 9 ? `••••${d.slice(-4)}` : m;
    })
    .slice(0, EMAIL_AI_MAX_CHARS);
}

function textHasAmount(text: string, cents: number): boolean {
  const [whole, frac] = (cents / 100).toFixed(2).split(".");
  const withCommas = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return new RegExp(`(?<![\\d.,])(?:${whole}|${withCommas})\\.${frac}(?!\\d)`).test(text);
}
function textHasDate(text: string, iso: string): boolean {
  for (const m of text.matchAll(new RegExp(DATE, "gi"))) if (toISODate(m[1]) === iso) return true;
  return false;
}
function textHasLast4(text: string, last4: string): boolean {
  return (text.match(/\d[\d -]*\d/g) ?? []).some((run) => run.replace(/\D/g, "").endsWith(last4));
}

/**
 * Builds an Extraction from what the model read in an email. Any value that does not literally appear
 * in the original text is thrown away (a wrong amount from a mistake or a planted instruction).
 */
export function statementFromEmailAi(raw: unknown, original: string): Extraction {
  const o = { ...(typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {}) };
  const dropped: string[] = [];
  const drop = (key: string, label: string) => { o[key] = null; dropped.push(label); };

  if (typeof o.amount_due_cents === "number" && Number.isSafeInteger(o.amount_due_cents) && !textHasAmount(original, o.amount_due_cents)) drop("amount_due_cents", "amount due");
  for (const [k, label] of [["due_date", "due date"], ["period_start", "billing period"], ["period_end", "billing period"]] as const) {
    if (typeof o[k] === "string" && !textHasDate(original, o[k] as string)) drop(k, label);
  }
  if (typeof o.provider === "string" && !original.toLowerCase().includes((o.provider as string).trim().toLowerCase())) drop("provider", "provider");
  if (typeof o.account_last4 === "string" && !textHasLast4(original, o.account_last4)) drop("account_last4", "account digits");
  if (typeof o.statement_number === "string" && !original.includes((o.statement_number as string).trim())) drop("statement_number", "statement number");

  const e = statementFromVision(o, "email");
  if (dropped.length) e.reasons.push(`The AI gave values that are not in the email, so they were ignored: ${[...new Set(dropped)].join(", ")}`);
  return e;
}

/** Keeps every field the rule-based parser found; fills only the gaps from the AI reading. */
export function mergeWithAi(local: Extraction, ai: Extraction): Extraction {
  const pick = <T extends { status: FieldStatus }>(a: T, b: T): T => (a.status === "found" ? a : b.status === "found" ? b : a);
  const provider = pick(local.provider, ai.provider);
  const amountDueCents = pick(local.amountDueCents, ai.amountDueCents);
  const dueDate = pick(local.dueDate, ai.dueDate);
  const hasPeriod = local.periodStart && local.periodEnd;
  const periodStart = hasPeriod ? local.periodStart : ai.periodStart;
  const periodEnd = hasPeriod ? local.periodEnd : ai.periodEnd;

  const reasons = ["Some fields were read by AI. Check every field against the original."];
  if (provider.status !== "found") reasons.push("Provider not recognized");
  if (amountDueCents.status !== "found") reasons.push("Amount due not found");
  if (dueDate.status !== "found") reasons.push("Due date not found");
  if (amountDueCents.value !== null && amountDueCents.value >= LARGE_AMOUNT_CENTS) reasons.push("Amount is unusually large");
  if (amountDueCents.value === 0) reasons.push("Amount due is $0.00");
  reasons.push(...local.reasons.filter((r) => r.startsWith("Card charge")), ...ai.reasons.filter((r) => r.startsWith("The AI gave")));

  return {
    kind: amountDueCents.status === "found" || dueDate.status === "found" ? "statement" : local.kind,
    provider, amountDueCents, dueDate, periodStart, periodEnd,
    accountLast4: local.accountLast4 ?? ai.accountLast4,
    statementId: local.statementId ?? ai.statementId,
    needsReview: true,
    reasons,
    parserVersion: `${local.parserVersion}+${EMAIL_AI_PARSER_VERSION}`,
  };
}
