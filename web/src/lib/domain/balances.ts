import type { Cents } from "./money";

export type SettlementStatus = "reported" | "confirmed" | "disputed" | "reversed";

export interface SplitLike {
  id: string;
  memberId: string;
  amountCents: Cents;
  payerMemberId: string;
  settlements: { amountCents: Cents; status: SettlementStatus }[];
}

export interface SplitPosition {
  /** Still owed after confirmed settlements. Never negative. */
  outstandingCents: Cents;
  /** Reported but not yet confirmed. Shown separately, never subtracted from outstanding. */
  pendingCents: Cents;
  confirmedCents: Cents;
  disputed: boolean;
  isPayerOwnShare: boolean;
}

export function splitPosition(s: SplitLike): SplitPosition {
  if (s.memberId === s.payerMemberId)
    return { outstandingCents: 0, pendingCents: 0, confirmedCents: 0, disputed: false, isPayerOwnShare: true };
  const confirmed = sumBy(s.settlements, "confirmed");
  const pending = sumBy(s.settlements, "reported");
  const outstanding = Math.max(0, s.amountCents - confirmed);
  return {
    outstandingCents: outstanding,
    pendingCents: Math.min(pending, outstanding),
    confirmedCents: confirmed,
    disputed: s.settlements.some((x) => x.status === "disputed"),
    isPayerOwnShare: false,
  };
}

function sumBy(list: { amountCents: Cents; status: SettlementStatus }[], status: SettlementStatus) {
  return list.filter((x) => x.status === status).reduce((a, x) => a + x.amountCents, 0);
}

/** Totals from one member's point of view. */
export function memberTotals(splits: SplitLike[], meMemberId: string) {
  let youOwe = 0, owedToYou = 0, youOwePending = 0, owedToYouPending = 0;
  for (const s of splits) {
    const p = splitPosition(s);
    if (p.isPayerOwnShare) continue;
    if (s.memberId === meMemberId) { youOwe += p.outstandingCents; youOwePending += p.pendingCents; }
    if (s.payerMemberId === meMemberId) { owedToYou += p.outstandingCents; owedToYouPending += p.pendingCents; }
  }
  return { youOwe, owedToYou, youOwePending, owedToYouPending };
}

/** Max a member may report now: outstanding minus what they already reported. */
export function reportableCents(s: SplitLike): Cents {
  const p = splitPosition(s);
  return Math.max(0, p.outstandingCents - p.pendingCents);
}

export interface PersonBalance {
  memberId: string;
  /** Positive: they owe me. Negative: I owe them. Confirmed payments only. */
  netCents: Cents;
  /** Reported payments still waiting for confirmation, in the same direction as netCents. */
  pendingCents: Cents;
}

/**
 * Who owes me and whom I owe, one row per other person, from my point of view.
 * A person can appear on both sides across different bills; the rows are netted so each
 * person shows once. Settled people (net 0) are left out.
 */
export function balancesByPerson(splits: SplitLike[], meMemberId: string): { owedToMe: PersonBalance[]; iOwe: PersonBalance[] } {
  const net = new Map<string, { net: number; pending: number }>();
  const add = (id: string, n: number, p: number) => {
    const cur = net.get(id) ?? { net: 0, pending: 0 };
    net.set(id, { net: cur.net + n, pending: cur.pending + p });
  };
  for (const s of splits) {
    const p = splitPosition(s);
    if (p.isPayerOwnShare) continue;
    if (s.payerMemberId === meMemberId && s.memberId !== meMemberId) add(s.memberId, p.outstandingCents, p.pendingCents);
    if (s.memberId === meMemberId && s.payerMemberId !== meMemberId) add(s.payerMemberId, -p.outstandingCents, -p.pendingCents);
  }
  const rows = [...net.entries()].map(([memberId, v]) => ({ memberId, netCents: v.net, pendingCents: v.pending }));
  return {
    owedToMe: rows.filter((r) => r.netCents > 0).map((r) => ({ ...r, pendingCents: Math.max(0, r.pendingCents) })).sort((a, b) => b.netCents - a.netCents),
    iOwe: rows.filter((r) => r.netCents < 0).map((r) => ({ memberId: r.memberId, netCents: -r.netCents, pendingCents: Math.max(0, -r.pendingCents) })).sort((a, b) => b.netCents - a.netCents),
  };
}
