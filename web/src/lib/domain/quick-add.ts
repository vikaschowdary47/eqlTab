import { parseDollars, type Cents } from "./money";
import { splitBill } from "./split";

/**
 * Quick Add (spec section 19.2): "Indian grocery 230 divide among all" → a bill draft.
 *
 * Two steps, both pure:
 *  1. parseQuickAdd: text → QuickDraft (what was said). The AI fallback produces the same shape.
 *  2. resolveQuickAdd: QuickDraft + the Space's members → a bill ready to confirm (who, how much).
 * The model never does the arithmetic; splitBill does.
 */

export const QUICK_CATEGORIES = ["electricity", "gas", "water", "internet", "rent", "phone", "groceries", "travel", "dining", "other"] as const;
export type QuickCategory = (typeof QUICK_CATEGORIES)[number];

export interface QuickDraft {
  title: string;
  category: QuickCategory;
  /** Decimal string as written ("230", "184.40"). Null when the text has no amount. */
  amount: string | null;
  /** "me" or a name as written. */
  payer: string;
  /** "all", or names as written. "me" is always included unless the text says otherwise. */
  participants: "all" | string[];
  /** Fixed amounts for some people ("Ana owes 40"); everyone else splits the rest equally. */
  fixedShares: { name: string; amount: string }[];
  /**
   * Several separate splits in one sentence ("me and Raj for 25, Raj and Joseph for 10"). Each group's amount
   * is split equally among the people named; the groups must add up to the total. The model only reads the
   * groups. splitBill does the arithmetic.
   */
  groups?: { amount: string; people: string[] }[];
}

/** True when the text has more than one amount ("3 ways" doesn't count): several splits in one sentence. */
export function hasSeveralAmounts(text: string): boolean {
  return (text.replace(/\b\d+\s*ways?\b/gi, " ").match(/\d+(?:[.,]\d+)*/g) ?? []).length > 1;
}

export interface QuickMember { id: string; name: string; isMe: boolean }

export type Resolved =
  | {
      ok: true;
      title: string; category: QuickCategory; amountCents: Cents; payerMemberId: string;
      method: "equal" | "exact";
      participants: { memberId: string; value?: number }[];
      /** Final shares from splitBill, for the draft card. */
      shares: { memberId: string; amountCents: Cents }[];
    }
  | { ok: false; question: string; field: "amount" | "people" | "payer" | "shares"; unknownNames?: string[] };

const ALL_WORDS = /\b(all|everyone|everybody|every one|whole (?:house|group|space)|all of us)\b/i;
const SPLIT_WORDS = /\b(split|divide[d]?|share[d]?|among|between|with|amongst|ways?|equally|evenly)\b/gi;
const FILLER = /\b(for|the|a|an|on|of|bill|paid|i|me|my|and|rest|equal|by|to|in|it|was|is)\b/gi;

const CATEGORY_WORDS: [QuickCategory, RegExp][] = [
  ["electricity", /\b(electric(ity)?|power|comed|light bill|energy)\b/i],
  ["gas", /\b(gas|nicor|peoples gas|heating)\b/i],
  ["water", /\b(water|sewer)\b/i],
  ["internet", /\b(wifi|wi-fi|internet|xfinity|comcast|spectrum|broadband|at&t fiber)\b/i],
  ["rent", /\b(rent|lease|landlord)\b/i],
  ["phone", /\b(phone|mobile|t-mobile|verizon|at&t|mint)\b/i],
  ["groceries", /\b(grocer(y|ies)|costco|walmart|aldi|patel|jewel|trader joe'?s|whole foods|target|kroger|mart|vegetables|milk)\b/i],
  ["travel", /\b(uber|lyft|taxi|flight|train|gas station|trip|hotel|airbnb|parking|toll)\b/i],
  ["dining", /\b(dinner|lunch|breakfast|food|pizza|restaurant|biryani|cafe|coffee|drinks|bar|takeout|doordash|ubereats)\b/i],
];

export function guessCategory(text: string): QuickCategory {
  return CATEGORY_WORDS.find(([, re]) => re.test(text))?.[0] ?? "other";
}

const AMOUNT = /\$?\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?(?!\d)/;

/** Deterministic parser for the common phrasings. Returns null when the text needs the AI. */
export function parseQuickAdd(input: string): QuickDraft | null {
  const text = input.replace(/\s+/g, " ").trim();
  if (!text || text.length > 200) return null;
  // "Ana owes 40, rest equal" and similar fixed-share phrasing is left to the AI.
  if (/\bowes?\b|\brest\b|\b\d+\s*%/i.test(text)) return null;
  // More than one amount ("paid 40, me and Raj for 25, Raj and Joseph for 10") is several splits in one
  // sentence. Reading only the first number would quietly give a wrong split, so leave it to the AI.
  if (hasSeveralAmounts(text)) return null;

  // Payer: "Raj paid 120 for dinner"
  let payer = "me";
  let rest = text;
  const paid = /^([A-Za-z][\w'.-]*(?: [A-Z][\w'.-]*)?) paid\b/i.exec(rest);
  if (paid && !/^(i|me|we)$/i.test(paid[1])) {
    payer = paid[1];
    rest = rest.slice(paid[0].length);
  } else {
    rest = rest.replace(/^(i|we) paid\b/i, "");
  }

  const amountMatch = AMOUNT.exec(rest);
  const amount = amountMatch ? `${amountMatch[1].replace(/,/g, "")}${amountMatch[2] ? `.${amountMatch[2]}` : ""}` : null;
  const beforeAmount = amountMatch ? rest.slice(0, amountMatch.index) : rest;
  const afterAmount = amountMatch ? rest.slice(amountMatch.index + amountMatch[0].length) : "";

  // People: "with Raj and Priya", "between me, Ana", "among all"
  let participants: "all" | string[] = "all";
  const peoplePart = /\b(?:with|between|among|amongst)\b(.*)$/i.exec(afterAmount) ?? /\b(?:with|between|among|amongst)\b(.*)$/i.exec(beforeAmount);
  if (peoplePart && !ALL_WORDS.test(peoplePart[1])) {
    const names = peoplePart[1]
      .replace(/\b\d+\s*ways?\b/gi, "")
      .split(/,|\band\b|&|\+/i)
      .map((n) => n.replace(/[^\p{L}\p{M}' .-]/gu, "").replace(/\b(split|equally|evenly)\b/gi, "").trim())
      .filter(Boolean);
    if (names.length) participants = ["me", ...names.filter((n) => !/^(me|i|myself)$/i.test(n))];
  }

  // Title: words around the amount, minus splitting words and fillers.
  const titleSource = (beforeAmount + " " + afterAmount.replace(/\b(?:with|between|among|amongst)\b.*$/i, ""))
    .replace(ALL_WORDS, " ").replace(SPLIT_WORDS, " ").replace(FILLER, " ").replace(/\b\d+\b/g, " ")
    .replace(/[^\p{L}\p{M}\d&' -]/gu, " ").replace(/\s+/g, " ").trim();
  const title = titleSource ? titleSource.charAt(0).toUpperCase() + titleSource.slice(1) : "";
  return { title: title.slice(0, 80) || "Expense", category: guessCategory(text), amount, payer, participants, fixedShares: [] };
}

function norm(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\d ]/gu, "").replace(/\s+/g, " ").trim();
}

/** Match a written name to exactly one member: full name, first name, or a unique prefix. */
export function matchMember(name: string, members: QuickMember[]): QuickMember[] {
  // "id:<memberId>" is how the draft card refers to someone the user picked by tapping.
  if (name.startsWith("id:")) return members.filter((m) => m.id === name.slice(3));
  const n = norm(name);
  if (!n) return [];
  if (/^(me|i|myself|you)$/.test(n)) return members.filter((m) => m.isMe);
  const exact = members.filter((m) => norm(m.name) === n);
  if (exact.length) return exact;
  const first = members.filter((m) => norm(m.name).split(" ")[0] === n);
  if (first.length) return first;
  return n.length >= 3 ? members.filter((m) => norm(m.name).startsWith(n)) : [];
}

export function resolveQuickAdd(d: QuickDraft, members: QuickMember[]): Resolved {
  const amountCents = d.amount === null ? null : parseDollars(d.amount);
  if (amountCents === null || amountCents <= 0) return { ok: false, field: "amount", question: "How much was it?" };

  const me = members.find((m) => m.isMe);
  if (!me) return { ok: false, field: "people", question: "You're not an active member of this Space." };

  const unknown: string[] = [];
  const pick = (name: string): QuickMember | null => {
    const found = matchMember(name, members);
    if (found.length === 1) return found[0];
    unknown.push(name);
    return null;
  };

  const payer = d.payer === "me" ? me : pick(d.payer);
  const people = d.participants === "all" ? members : (d.participants.map(pick).filter(Boolean) as QuickMember[]);
  // "Raj paid 120, split with me and Ana" means Raj shares it too. People picked by tapping are taken as-is.
  const typedNames = d.participants !== "all" && !d.participants.every((n) => n.startsWith("id:"));
  if (payer && typedNames && !people.some((p) => p.id === payer.id)) people.unshift(payer);
  const fixed = d.fixedShares.map((f) => ({ member: pick(f.name), cents: parseDollars(f.amount) }));
  const groups = (d.groups ?? []).map((g) => ({ cents: parseDollars(g.amount), people: [...new Map((g.people.map(pick).filter(Boolean) as QuickMember[]).map((m) => [m.id, m])).values()] }));

  if (unknown.length) {
    return { ok: false, field: payer ? "people" : "payer", unknownNames: [...new Set(unknown)], question: `Who is ${[...new Set(unknown)].map((u) => `"${u}"`).join(" and ")}? Pick them below.` };
  }

  // Several groups, each split equally among its own people ("me and Raj for 25, Raj and Joseph for 10").
  if (groups.length > 0) {
    if (groups.some((g) => g.cents === null || g.cents <= 0)) return { ok: false, field: "shares", question: "One of the amounts isn't a valid number." };
    if (groups.some((g) => g.people.length === 0)) return { ok: false, field: "people", question: "Who is in each part?" };
    const groupTotal = groups.reduce((a, g) => a + (g.cents as number), 0);
    if (groupTotal !== amountCents) {
      return { ok: false, field: "shares", question: `The parts add up to $${(groupTotal / 100).toFixed(2)}, but the total is $${(amountCents / 100).toFixed(2)}. Check the amounts and try again.` };
    }
    const owed = new Map<string, number>();
    for (const g of groups) {
      const inGroup = members.filter((m) => g.people.some((p) => p.id === m.id));
      const part = splitBill(g.cents as number, "equal", inGroup.map((m) => ({ memberId: m.id })));
      if (!part.ok) return { ok: false, field: "shares", question: part.error };
      for (const sh of part.shares) owed.set(sh.memberId, (owed.get(sh.memberId) ?? 0) + sh.amountCents);
    }
    const parts = members.filter((m) => owed.has(m.id)).map((m) => ({ memberId: m.id, value: owed.get(m.id)! }));
    const whole = splitBill(amountCents, "exact", parts);
    if (!whole.ok) return { ok: false, field: "shares", question: whole.error };
    return { ok: true, title: d.title.trim().slice(0, 80) || "Expense", category: d.category, amountCents, payerMemberId: payer!.id, method: "exact", participants: parts, shares: whole.shares };
  }

  // Keep the Space's order so leftover cents are deterministic.
  const ordered = members.filter((m) => people.some((p) => p.id === m.id));
  if (ordered.length === 0) return { ok: false, field: "people", question: "Split with whom?" };

  const base = { title: d.title.trim().slice(0, 80) || "Expense", category: d.category, amountCents, payerMemberId: payer!.id };

  if (fixed.length === 0) {
    const r = splitBill(amountCents, "equal", ordered.map((m) => ({ memberId: m.id })));
    if (!r.ok) return { ok: false, field: "people", question: r.error };
    return { ok: true, ...base, method: "equal", participants: ordered.map((m) => ({ memberId: m.id })), shares: r.shares };
  }

  // Fixed amounts for some people, the rest split equally among everyone else.
  if (fixed.some((f) => f.cents === null || f.cents < 0)) return { ok: false, field: "shares", question: "One of the amounts isn't a valid number." };
  const fixedTotal = fixed.reduce((a, f) => a + (f.cents as number), 0);
  const others = ordered.filter((m) => !fixed.some((f) => f.member!.id === m.id));
  for (const f of fixed) if (!ordered.some((m) => m.id === f.member!.id)) ordered.push(f.member!);
  if (fixedTotal > amountCents) return { ok: false, field: "shares", question: "The fixed amounts add up to more than the total." };
  const remainder = amountCents - fixedTotal;
  if (remainder > 0 && others.length === 0) return { ok: false, field: "shares", question: "Who splits the rest?" };
  const restShares = remainder > 0 ? splitBill(remainder, "equal", others.map((m) => ({ memberId: m.id }))) : { ok: true as const, shares: [] };
  if (!restShares.ok) return { ok: false, field: "shares", question: restShares.error };
  const byId = new Map<string, number>();
  for (const f of fixed) byId.set(f.member!.id, (byId.get(f.member!.id) ?? 0) + (f.cents as number));
  for (const s of restShares.shares) byId.set(s.memberId, (byId.get(s.memberId) ?? 0) + s.amountCents);
  const finalOrder = members.filter((m) => byId.has(m.id));
  const participants = finalOrder.map((m) => ({ memberId: m.id, value: byId.get(m.id)! }));
  const r = splitBill(amountCents, "exact", participants);
  if (!r.ok) return { ok: false, field: "shares", question: r.error };
  return { ok: true, ...base, method: "exact", participants, shares: r.shares };
}

/** Validates the AI's JSON into a QuickDraft. Anything off-schema is rejected, never guessed. */
export function draftFromModel(raw: unknown, message?: string): QuickDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  // The model says this isn't about a shared expense at all ("write me a hello world python code").
  if (o.is_expense === false) return null;
  // Every amount must be a number the person actually typed. The model only reads: it never supplies a figure.
  const typed = message === undefined ? null : new Set((message.match(/\d+(?:[.,]\d+)*/g) ?? []).map((n) => Number(n.replace(/,/g, ""))));
  const typedAmount = (v: unknown) => typed === null || (typeof v === "string" && typed.has(Number(v)));
  const str = (v: unknown, max: number) => (typeof v === "string" && v.trim().length > 0 && v.length <= max ? v.trim() : null);
  const money = (v: unknown) => (typeof v === "string" && /^\d+(\.\d{1,2})?$/.test(v.trim()) ? v.trim() : null);
  let amount = o.amount === null ? null : money(o.amount);
  if (o.amount !== null && amount === null) return null;
  if (amount !== null && !typedAmount(amount)) amount = null; // not in the message: ask the person instead of trusting it
  const category = QUICK_CATEGORIES.includes(o.category as QuickCategory) ? (o.category as QuickCategory) : "other";
  const payer = str(o.payer, 80) ?? "me";
  let participants: "all" | string[] = "all";
  if (Array.isArray(o.participants)) {
    const names = o.participants.map((n) => str(n, 80)).filter((n): n is string => !!n);
    if (names.length !== o.participants.length) return null;
    participants = names.length ? names : "all";
  } else if (o.participants !== "all") return null;
  const fixedShares: QuickDraft["fixedShares"] = [];
  if (Array.isArray(o.fixed_shares)) {
    for (const f of o.fixed_shares) {
      const name = str((f as Record<string, unknown>)?.name, 80);
      const amt = money((f as Record<string, unknown>)?.amount);
      if (!name || !amt || !typedAmount(amt)) return null;
      fixedShares.push({ name, amount: amt });
    }
  }
  let groups: QuickDraft["groups"];
  if (Array.isArray(o.groups) && o.groups.length > 0) {
    groups = [];
    for (const g of o.groups) {
      const gr = g as Record<string, unknown>;
      const amt = money(gr?.amount);
      const people = Array.isArray(gr?.people) ? gr.people.map((n) => str(n, 80)).filter((n): n is string => !!n) : [];
      if (!amt || !typedAmount(amt) || people.length === 0 || people.length !== (gr.people as unknown[]).length) return null;
      groups.push({ amount: amt, people });
    }
  }
  return { title: str(o.title, 80) ?? "Expense", category, amount, payer, participants, fixedShares, ...(groups ? { groups } : {}) };
}

/** What "Edit details" hands to the Add a bill form so the split from Quick Add isn't lost. */
export interface CarriedSplit { method: "equal" | "exact"; selected: string[]; amounts: Record<string, string> }

/** Link parameters for the Add a bill form. Only the app reads them back, and parseCarriedSplit re-checks everything. */
export function carriedSplitParams(r: Extract<Resolved, { ok: true }>): Record<string, string> {
  if (r.method === "exact") return { split: r.participants.map((p) => `${p.memberId}:${((p.value ?? 0) / 100).toFixed(2)}`).join(","), payer: r.payerMemberId };
  return { people: r.participants.map((p) => p.memberId).join(","), payer: r.payerMemberId };
}

/** Reads those parameters back. Unknown people, bad amounts or repeats mean "ignore it": the form then starts as usual. */
export function parseCarriedSplit(q: { split?: string; people?: string }, activeIds: string[]): CarriedSplit | null {
  const ok = new Set(activeIds);
  if (q.split) {
    const amounts: Record<string, string> = {};
    for (const pair of q.split.split(",").slice(0, 50)) {
      const [id, amt] = pair.split(":");
      if (!id || !ok.has(id) || id in amounts || !amt || !/^\d+(\.\d{1,2})?$/.test(amt)) return null;
      amounts[id] = amt;
    }
    const selected = activeIds.filter((id) => id in amounts);
    return selected.length ? { method: "exact", selected, amounts } : null;
  }
  if (q.people) {
    const ids = q.people.split(",").slice(0, 50);
    if (ids.some((id) => !ok.has(id)) || new Set(ids).size !== ids.length) return null;
    const selected = activeIds.filter((id) => ids.includes(id));
    return selected.length ? { method: "equal", selected, amounts: {} } : null;
  }
  return null;
}
