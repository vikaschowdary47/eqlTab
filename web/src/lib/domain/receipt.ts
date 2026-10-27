import type { Cents } from "./money";

/**
 * Receipt splitting (spec section 19.3). The model reads lines; everything here is exact integer math.
 *
 * Rounding: each person's exact share is a fraction. We round once, at the end, with the largest
 * remainder method so shares always add up to the total and leftover cents don't always land on
 * the same person.
 */

export interface ReceiptItem {
  id: string;
  label: string;
  quantity: number;
  /** Net price of the line after any discount printed for it. */
  amountCents: Cents;
  /** The model wasn't sure about this line. The UI highlights it. */
  unsure: boolean;
}

export interface Receipt {
  store: string | null;
  date: string | null;
  items: ReceiptItem[];
  taxCents: Cents;
  tipCents: Cents;
  feesCents: Cents;
  /** Discounts not tied to one item (e.g. "$5 off your order"). Positive number, subtracted. */
  orderDiscountCents: Cents;
  /** As printed. Null when the receipt shows no total. */
  printedTotalCents: Cents | null;
}

export type ExtrasMode = "proportional" | "equal";

export function extrasCents(r: Pick<Receipt, "taxCents" | "tipCents" | "feesCents" | "orderDiscountCents">): Cents {
  return r.taxCents + r.tipCents + r.feesCents - r.orderDiscountCents;
}

export function itemsTotal(items: Pick<ReceiptItem, "amountCents">[]): Cents {
  return items.reduce((a, i) => a + i.amountCents, 0);
}

export function computedTotal(r: Receipt): Cents {
  return itemsTotal(r.items) + extrasCents(r);
}

/** Positive: the lines are short of the printed total (something is missing). */
export function reconcileDifference(r: Receipt): Cents | null {
  return r.printedTotalCents === null ? null : r.printedTotalCents - computedTotal(r);
}

export type ReceiptSplit =
  | { ok: true; totalCents: Cents; shares: { memberId: string; amountCents: Cents; itemsCents: Cents }[] }
  | { ok: false; error: string; itemId?: string };

/**
 * @param assignments item id → member ids sharing it
 * @param memberOrder the Space's member order, for deterministic tie-breaks
 */
export function splitReceipt(r: Receipt, assignments: Record<string, string[]>, memberOrder: string[], mode: ExtrasMode = "proportional"): ReceiptSplit {
  for (const i of r.items) {
    if (!Number.isSafeInteger(i.amountCents) || i.amountCents < 0) return { ok: false, error: `"${i.label}" needs a price of $0.00 or more`, itemId: i.id };
    const who = assignments[i.id] ?? [];
    if (i.amountCents > 0 && who.length === 0) return { ok: false, error: `Nobody is picked for "${i.label}". Tap it to choose who shares it.`, itemId: i.id };
    if (new Set(who).size !== who.length) return { ok: false, error: "Each person can appear only once per item", itemId: i.id };
    if (who.some((m) => !memberOrder.includes(m))) return { ok: false, error: "Someone picked is no longer in this Space", itemId: i.id };
  }
  const S = itemsTotal(r.items);
  if (S <= 0) return { ok: false, error: "Add at least one item with a price" };
  const E = extrasCents(r);
  const T = S + E;
  if (T <= 0) return { ok: false, error: "The total must be more than $0.00" };

  // Each person's item subtotal as an exact fraction N_p / L, with L = lcm of the group sizes.
  const groupSizes = r.items.filter((i) => i.amountCents > 0).map((i) => (assignments[i.id] ?? []).length);
  const L = groupSizes.reduce((a, k) => lcm(a, BigInt(k)), BigInt(1));
  const N = new Map<string, bigint>();
  for (const i of r.items) {
    if (i.amountCents === 0) continue;
    const who = assignments[i.id];
    const part = (BigInt(i.amountCents) * L) / BigInt(who.length); // exact: L is a multiple of who.length
    for (const m of who) N.set(m, (N.get(m) ?? BigInt(0)) + part);
  }
  const people = memberOrder.filter((m) => N.has(m));
  const n = BigInt(people.length);

  // Exact share = num_p / den.
  //   proportional: N_p / L * T / S          → num = N_p * T,           den = L * S
  //   equal:        N_p / L + E / n          → num = N_p * n + E * L,   den = L * n
  const bigT = BigInt(T), bigS = BigInt(S), bigE = BigInt(E);
  const den = mode === "proportional" ? L * bigS : L * n;
  const nums = people.map((m) => (mode === "proportional" ? N.get(m)! * bigT : N.get(m)! * n + bigE * L));
  if (nums.some((x) => x < BigInt(0))) return { ok: false, error: "A discount is bigger than someone's items. Split extras by item value instead." };

  const floors = nums.map((x) => x / den);
  const rems = nums.map((x) => x % den);
  let left = bigT - floors.reduce((a, x) => a + x, BigInt(0));
  const order = people.map((_, idx) => idx).sort((a, b) => (rems[b] > rems[a] ? 1 : rems[b] < rems[a] ? -1 : a - b));
  const extra = people.map(() => BigInt(0));
  for (const idx of order) {
    if (left <= BigInt(0)) break;
    extra[idx] = BigInt(1);
    left -= BigInt(1);
  }
  const shares = people.map((m, idx) => ({
    memberId: m,
    amountCents: Number(floors[idx] + extra[idx]),
    itemsCents: Number((N.get(m)! + L / BigInt(2)) / L),
  }));
  return { ok: true, totalCents: T, shares };
}

function gcd(a: bigint, b: bigint): bigint {
  while (b) [a, b] = [b, a % b];
  return a;
}
function lcm(a: bigint, b: bigint): bigint {
  return (a / gcd(a, b)) * b;
}

/** Validates the model's JSON. Anything off-schema is rejected, never guessed. */
export function receiptFromModel(raw: unknown): { ok: true; receipt: Receipt } | { ok: false; error: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.is_receipt === false) return { ok: false, error: "That doesn't look like a receipt. Try a photo of the full receipt or order summary." };
  if (!Array.isArray(o.items)) return null;
  const cents = (v: unknown) => (v === null || v === undefined ? 0 : Number.isSafeInteger(v) && (v as number) >= 0 ? (v as number) : NaN);

  const items: ReceiptItem[] = [];
  for (const [idx, it] of o.items.entries()) {
    const x = it as Record<string, unknown>;
    const label = typeof x?.label === "string" ? x.label.trim().slice(0, 80) : "";
    const amount = x?.amount_cents;
    const unreadable = amount === null || amount === undefined;
    if (!unreadable && !(Number.isSafeInteger(amount) && (amount as number) >= 0)) return null;
    const qty = typeof x?.quantity === "number" && x.quantity > 0 && x.quantity < 1000 ? x.quantity : 1;
    const conf = typeof x?.confidence === "number" ? x.confidence : 0;
    items.push({ id: `i${idx}`, label: label || `Item ${idx + 1}`, quantity: qty, amountCents: unreadable ? 0 : (amount as number), unsure: unreadable || conf < 0.6 });
  }
  if (items.length === 0) return { ok: false, error: "We couldn't find any items on that receipt. Try a clearer photo." };
  if (items.length > 150) return { ok: false, error: "That receipt has too many lines to split here." };

  let orderDiscount = 0;
  if (Array.isArray(o.discounts)) {
    for (const d of o.discounts) {
      const x = d as Record<string, unknown>;
      const amt = cents(x?.amount_cents);
      if (Number.isNaN(amt)) return null;
      const idx = x?.item_index;
      const target = Number.isInteger(idx) ? items[idx as number] : undefined;
      if (target && target.amountCents >= amt) target.amountCents -= amt;
      else orderDiscount += amt;
    }
  }
  const tax = cents(o.tax_cents), tip = cents(o.tip_cents), fees = cents(o.fees_cents);
  if ([tax, tip, fees].some(Number.isNaN)) return null;
  const total = o.total_cents === null || o.total_cents === undefined ? null : cents(o.total_cents);
  if (total !== null && Number.isNaN(total)) return null;
  const str = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const date = str(o.date, 10);
  return {
    ok: true,
    receipt: {
      store: str(o.store, 60), date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
      items, taxCents: tax, tipCents: tip, feesCents: fees, orderDiscountCents: orderDiscount, printedTotalCents: total,
    },
  };
}

/** Short plain-text record of who had what, saved as the bill's note so the split is explainable. */
export function receiptNote(r: Receipt, assignments: Record<string, string[]>, nameOf: (id: string) => string, everyoneCount: number, max = 500): string {
  const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;
  const personal = r.items.filter((i) => (assignments[i.id]?.length ?? 0) > 0 && assignments[i.id].length < everyoneCount);
  const parts = personal.map((i) => `${i.label} ${fmt(i.amountCents)} (${assignments[i.id].map((m) => nameOf(m).split(" ")[0]).join(", ")})`);
  const head = `Receipt${r.store ? ` from ${r.store}` : ""}: ${r.items.length} items.`;
  const body = parts.length ? ` Not shared by everyone: ${parts.join("; ")}.` : " All items shared by everyone.";
  const out = head + body;
  return out.length > max ? out.slice(0, max - 1) + "…" : out;
}
