import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractStatement } from "@/lib/domain/statement";
import { classifyBillEmail } from "@/lib/domain/bill-senders";

// A real Public Grid bill email, with the name, card digits and address removed.
const bill = readFileSync(new URL("./fixtures/public-grid-email.txt", import.meta.url), "utf8");
const recap = readFileSync(new URL("./fixtures/public-grid-recap.txt", import.meta.url), "utf8");

describe("Public Grid bill email", () => {
  const e = extractStatement(bill);
  it("reads the amount due and uses the autopay date as the due date", () => {
    expect(e.amountDueCents).toEqual({ value: 9449, status: "found" });
    expect(e.dueDate).toEqual({ value: "2026-08-05", status: "found" });
    expect(e.kind).toBe("statement");
  });
  it("flags that the card charge includes a fee", () => {
    expect(e.reasons).toContain("Card charge is $97.62, $3.13 more than the bill (likely a fee). Decide whether to split the fee too.");
  });
  it("is kept as a bill", () => {
    expect(classifyBillEmail({ subject: "Your Electric bill is ready", hasPdf: false, amountFound: true, dueDateFound: true })).toBe("statement");
  });
});

describe("Public Grid energy recap", () => {
  it("is not a bill", () => {
    const e = extractStatement(recap);
    expect(e.amountDueCents.status).toBe("missing");
    expect(classifyBillEmail({ subject: "Your Energy Recap", hasPdf: false, amountFound: false, dueDateFound: false })).toBe("skip");
  });
});
