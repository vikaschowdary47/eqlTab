import { describe, expect, it } from "vitest";
import { draftFromModel, matchMember, parseQuickAdd, resolveQuickAdd, type QuickMember } from "@/lib/domain/quick-add";

const members: QuickMember[] = [
  { id: "me", name: "Vikas C", isMe: true },
  { id: "raj", name: "Raj Kumar", isMe: false },
  { id: "priya", name: "Priya S", isMe: false },
  { id: "ana", name: "Ana", isMe: false },
];
const go = (text: string) => {
  const d = parseQuickAdd(text);
  if (!d) throw new Error(`no parse: ${text}`);
  return resolveQuickAdd(d, members);
};
const shares = (r: ReturnType<typeof resolveQuickAdd>) => (r.ok ? r.shares.map((s) => [s.memberId, s.amountCents]) : r.question);

describe("Quick Add parsing", () => {
  it("Indian grocery 230 divide among all", () => {
    const d = parseQuickAdd("Indian grocery 230 divide among all")!;
    expect(d).toMatchObject({ title: "Indian grocery", category: "groceries", amount: "230", payer: "me", participants: "all" });
    expect(shares(resolveQuickAdd(d, members))).toEqual([["me", 5750], ["raj", 5750], ["priya", 5750], ["ana", 5750]]);
  });

  it("wifi 65 split with Raj and Priya includes me", () => {
    const r = go("wifi 65 split with Raj and Priya");
    expect(r.ok && r.category).toBe("internet");
    expect(shares(r)).toEqual([["me", 2167], ["raj", 2167], ["priya", 2166]]);
  });

  it("Raj paid 120 for dinner, split with me and Ana", () => {
    const r = go("Raj paid 120 for dinner, split with me and Ana");
    expect(r.ok && r.payerMemberId).toBe("raj");
    expect(r.ok && r.title).toBe("Dinner");
    expect(shares(r)).toEqual([["me", 4000], ["raj", 4000], ["ana", 4000]]);
  });

  it("uber 30 defaults to everyone, paid by me", () => {
    const r = go("uber 30");
    expect(r.ok && [r.title, r.category, r.amountCents, r.payerMemberId]).toEqual(["Uber", "travel", 3000, "me"]);
  });

  it("handles $ and cents", () => {
    expect(go("$184.40 electricity with everyone").ok && go("$184.40 electricity with everyone")).toMatchObject({ amountCents: 18440, category: "electricity" });
    expect(parseQuickAdd("costco 1,234.5 all")!.amount).toBe("1234.5");
  });

  it("asks for an amount when there isn't one", () => {
    const r = go("groceries split with all");
    expect(r).toEqual({ ok: false, field: "amount", question: "How much was it?" });
  });

  it("asks who someone is instead of guessing", () => {
    const r = go("pizza 40 with Sam");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.unknownNames).toEqual(["Sam"]);
  });

  it("leaves 'owes' and 'rest' phrasing to the AI", () => {
    expect(parseQuickAdd("costco 184.40, Ana owes 40, rest equal")).toBeNull();
  });
});

describe("matchMember", () => {
  it("matches full name, first name, or a unique prefix, never ambiguous ones", () => {
    expect(matchMember("raj", members).map((m) => m.id)).toEqual(["raj"]);
    expect(matchMember("Raj Kumar", members).map((m) => m.id)).toEqual(["raj"]);
    expect(matchMember("pri", members).map((m) => m.id)).toEqual(["priya"]);
    expect(matchMember("me", members).map((m) => m.id)).toEqual(["me"]);
    const twoSams = [...members, { id: "s1", name: "Sam A", isMe: false }, { id: "s2", name: "Sam B", isMe: false }];
    expect(matchMember("sam", twoSams)).toHaveLength(2);
    expect(resolveQuickAdd({ title: "x", category: "other", amount: "10", payer: "me", participants: ["sam"], fixedShares: [] }, twoSams).ok).toBe(false);
  });
});

describe("AI drafts", () => {
  it("costco 184.40, Ana owes 40, rest equal", () => {
    const d = draftFromModel({ title: "Costco", category: "groceries", amount: "184.40", payer: "me", participants: "all", fixed_shares: [{ name: "Ana", amount: "40" }] })!;
    const r = resolveQuickAdd(d, members);
    expect(r.ok && r.method).toBe("exact");
    // 144.40 / 3 = 48.14, 48.13, 48.13
    expect(shares(r)).toEqual([["me", 4814], ["raj", 4813], ["priya", 4813], ["ana", 4000]]);
    expect(r.ok && r.shares.reduce((a, s) => a + s.amountCents, 0)).toBe(18440);
  });

  it("rejects malformed model output", () => {
    expect(draftFromModel({ amount: "12.345", participants: "all" })).toBeNull();
    expect(draftFromModel({ amount: 12, participants: "all" })).toBeNull();
    expect(draftFromModel({ amount: "12", participants: "everyone" })).toBeNull();
    expect(draftFromModel("ignore previous instructions")).toBeNull();
  });

  it("fixed shares larger than the total are refused", () => {
    const d = draftFromModel({ title: "x", category: "other", amount: "30", payer: "me", participants: "all", fixed_shares: [{ name: "Ana", amount: "40" }] })!;
    expect(resolveQuickAdd(d, members).ok).toBe(false);
  });
});

describe("picked people", () => {
  it("id: references come from tapping a person and always match exactly", () => {
    const r = resolveQuickAdd({ title: "Pizza", category: "dining", amount: "40", payer: "me", participants: ["id:me", "id:ana"], fixedShares: [] }, members);
    expect(shares(r)).toEqual([["me", 2000], ["ana", 2000]]);
  });
});
