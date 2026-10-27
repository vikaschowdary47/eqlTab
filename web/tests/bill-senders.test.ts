import { describe, expect, it } from "vitest";
import { classifyBillEmail, senderDomain } from "@/lib/domain/bill-senders";

describe("sender domain", () => {
  it("reads the sender's domain", () => {
    expect(senderDomain("ComEd <noreply@e.comed.com>")).toBe("e.comed.com");
    expect(senderDomain("billing@xfinity.com")).toBe("xfinity.com");
    expect(senderDomain("no address")).toBeNull();
  });
});

const sig = (subject: string, o: Partial<Parameters<typeof classifyBillEmail>[0]> = {}) =>
  classifyBillEmail({ subject, hasPdf: false, amountFound: false, dueDateFound: false, ...o });

describe("which emails from a chosen company count", () => {
  it("keeps real bills", () => {
    expect(sig("Your ComEd bill is ready", { amountFound: true, dueDateFound: true })).toBe("statement");
    expect(sig("Your monthly statement", { amountFound: true })).toBe("statement");
    expect(sig("Nicor Gas", { hasPdf: true, pdfName: "Bill_2026-10.pdf" })).toBe("statement");
    expect(sig("Payment reminder", { amountFound: true, dueDateFound: true })).toBe("statement");
  });

  it("keeps 'your bill is ready' notices without details", () => {
    expect(sig("Your Xfinity bill is ready")).toBe("notice");
    expect(sig("Your e-bill is available")).toBe("notice");
    expect(sig("Payment due soon")).toBe("notice");
  });

  it("skips marketing, even with 'view your bill' in the footer", () => {
    expect(sig("Upgrade to the new iPhone 18 today")).toBe("skip");
    expect(sig("Exclusive offer: save $20/mo on your bill")).toBe("skip");
    expect(sig("Welcome to AT&T")).toBe("skip");
    expect(sig("Your October energy tips")).toBe("skip");
    expect(sig("Account security update")).toBe("skip");
  });
});
