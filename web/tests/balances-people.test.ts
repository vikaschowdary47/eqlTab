import { describe, expect, it } from "vitest";
import { balancesByPerson, type SplitLike } from "@/lib/domain/balances";

let n = 0;
const split = (memberId: string, payerMemberId: string, amountCents: number, settlements: SplitLike["settlements"] = []): SplitLike =>
  ({ id: `s${n++}`, memberId, payerMemberId, amountCents, settlements });

describe("balancesByPerson", () => {
  it("lists who owes me and whom I owe, one row each", () => {
    const r = balancesByPerson([
      // I paid $200 electricity, split 4 ways
      split("me", "me", 5000), split("raj", "me", 5000), split("ana", "me", 5000), split("priya", "me", 5000),
      // Arjun paid $184.40 wifi, I owe my share
      split("me", "arjun", 4610), split("arjun", "arjun", 4610),
    ], "me");
    expect(r.owedToMe.map((x) => [x.memberId, x.netCents])).toEqual([["raj", 5000], ["ana", 5000], ["priya", 5000]]);
    expect(r.iOwe).toEqual([{ memberId: "arjun", netCents: 4610, pendingCents: 0 }]);
  });

  it("nets the same person across bills", () => {
    const r = balancesByPerson([split("raj", "me", 5000), split("me", "raj", 2000)], "me");
    expect(r.owedToMe).toEqual([{ memberId: "raj", netCents: 3000, pendingCents: 0 }]);
    expect(r.iOwe).toEqual([]);
  });

  it("leaves out people who are settled and counts only confirmed payments", () => {
    const r = balancesByPerson([
      split("raj", "me", 5000, [{ amountCents: 5000, status: "confirmed" }]),
      split("ana", "me", 5000, [{ amountCents: 2000, status: "reported" }]),
    ], "me");
    expect(r.owedToMe).toEqual([{ memberId: "ana", netCents: 5000, pendingCents: 2000 }]);
  });

  it("ignores bills I'm not part of", () => {
    expect(balancesByPerson([split("raj", "ana", 5000)], "me")).toEqual({ owedToMe: [], iOwe: [] });
  });
});
