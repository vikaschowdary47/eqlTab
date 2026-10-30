import { describe, expect, it } from "vitest";
import { carriedSplitParams, draftFromModel, matchMember, parseCarriedSplit, parseQuickAdd, resolveQuickAdd, type QuickMember } from "@/lib/domain/quick-add";

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

  it("leaves a sentence with several amounts to the AI instead of reading only the first", () => {
    expect(parseQuickAdd("i paid 40 for food me and raj for 25, raj and joseph for 10 and me and joseph for 5")).toBeNull();
  });
  it("still reads one amount with '3 ways'", () => {
    expect(parseQuickAdd("dinner 84.50 split 3 ways")?.amount).toBe("84.50");
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

describe("groups: several splits in one sentence", () => {
  const members = [
    { id: "m-me", name: "Vikas", isMe: true },
    { id: "m-raj", name: "Raj", isMe: false },
    { id: "m-joe", name: "Joseph", isMe: false },
  ];
  const draft = draftFromModel({
    title: "Food", category: "dining", amount: "40", payer: "me", participants: "all", fixed_shares: [],
    groups: [{ amount: "25", people: ["me", "Raj"] }, { amount: "10", people: ["Raj", "Joseph"] }, { amount: "5", people: ["me", "Joseph"] }],
  })!;
  it("adds each person's parts: you 15, Raj 17.50, Joseph 7.50", () => {
    const r = resolveQuickAdd(draft, members);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.method).toBe("exact");
    expect(Object.fromEntries(r.shares.map((s) => [s.memberId, s.amountCents]))).toEqual({ "m-me": 1500, "m-raj": 1750, "m-joe": 750 });
  });
  it("refuses parts that don't add up to the total", () => {
    const r = resolveQuickAdd({ ...draft, amount: "45" }, members);
    expect(r.ok).toBe(false);
  });
  it("asks who a name is instead of guessing", () => {
    const r = resolveQuickAdd({ ...draft, groups: [{ amount: "40", people: ["me", "Zed"] }] }, members);
    expect(r.ok).toBe(false);
  });
  it("rejects malformed groups from the model", () => {
    expect(draftFromModel({ title: "x", category: "other", amount: "10", payer: "me", participants: "all", fixed_shares: [], groups: [{ amount: "ten", people: ["me"] }] })).toBeNull();
  });
});

describe("Edit details keeps the split", () => {
  const members = [{ id: "a1", name: "Vikas", isMe: true }, { id: "b2", name: "Raj", isMe: false }, { id: "c3", name: "Joseph", isMe: false }];
  const ids = members.map((m) => m.id);
  it("carries each person's exact amount into the form and reads it back", () => {
    const d = draftFromModel({ title: "Food", category: "dining", amount: "40", payer: "me", participants: "all", fixed_shares: [],
      groups: [{ amount: "25", people: ["me", "Raj"] }, { amount: "10", people: ["Raj", "Joseph"] }, { amount: "5", people: ["me", "Joseph"] }] })!;
    const r = resolveQuickAdd(d, members);
    if (!r.ok) throw new Error("expected a resolved draft");
    expect(parseCarriedSplit(carriedSplitParams(r), ids)).toEqual({ method: "exact", selected: ids, amounts: { a1: "15.00", b2: "17.50", c3: "7.50" } });
  });
  it("ignores unknown people, repeats and bad amounts", () => {
    expect(parseCarriedSplit({ split: "zz:10.00" }, ids)).toBeNull();
    expect(parseCarriedSplit({ split: "a1:5.00,a1:6.00" }, ids)).toBeNull();
    expect(parseCarriedSplit({ split: "a1:abc" }, ids)).toBeNull();
  });
});

describe("picked people", () => {
  it("id: references come from tapping a person and always match exactly", () => {
    const r = resolveQuickAdd({ title: "Pizza", category: "dining", amount: "40", payer: "me", participants: ["id:me", "id:ana"], fixedShares: [] }, members);
    expect(shares(r)).toEqual([["me", 2000], ["ana", 2000]]);
  });
});

describe("draftFromModel: the model only reads", () => {
  const base = { is_expense: true, title: "Dinner", category: "dining", amount: "60", payer: "me", participants: "all", fixed_shares: [], groups: [] };
  it("refuses a message that is not an expense", () => {
    expect(draftFromModel({ ...base, is_expense: false }, "write me a hello world python code")).toBeNull();
  });
  it("does not trust an amount that is not in the message", () => {
    const d = draftFromModel({ ...base, title: "Hello world", amount: "100" }, "write me a hello world python code");
    expect(d?.amount).toBeNull();
  });
  it("keeps an amount the person typed, with or without commas or cents", () => {
    expect(draftFromModel(base, "dinner 60 with Raj")?.amount).toBe("60");
    expect(draftFromModel({ ...base, amount: "1200" }, "rent 1,200 split all")?.amount).toBe("1200");
    expect(draftFromModel({ ...base, amount: "184.40" }, "power bill 184.40")?.amount).toBe("184.40");
  });
  it("rejects invented fixed shares and parts", () => {
    expect(draftFromModel({ ...base, fixed_shares: [{ name: "Ana", amount: "40" }] }, "dinner 60, Ana owes 25")).toBeNull();
    expect(draftFromModel({ ...base, groups: [{ amount: "99", people: ["me"] }] }, "dinner 60")).toBeNull();
  });
});
