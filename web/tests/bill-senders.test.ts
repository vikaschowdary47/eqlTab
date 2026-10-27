import { describe, expect, it } from "vitest";
import { classifyBillEmail, isFollowUpNotice, scanSummary, senderDomain } from "@/lib/domain/bill-senders";

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


describe("scan result explains itself", () => {
  const zero = { imported: 0, found: 0, already: 0, otherSender: 0, notBill: 0, duplicate: 0 };
  it("says when nothing came from the chosen companies", () => {
    expect(scanSummary(zero, ["ComEd", "Peoples Gas", "Xfinity"]).title).toBe("No emails from ComEd, Peoples Gas and Xfinity in the last 90 days");
  });
  it("says why emails were skipped", () => {
    const r = scanSummary({ ...zero, found: 4, already: 1, notBill: 3 }, ["Public Grid"]);
    expect(r).toEqual({ title: "No new bills", detail: "Checked 4 emails from Public Grid: 1 already here, 3 weren't bills (ads or account alerts)." });
  });
  it("says when AI helped", () => {
    expect(scanSummary({ ...zero, found: 3, imported: 3, readByAi: 2 }, ["Public Grid"]).detail).toBe("Checked 3 emails from Public Grid: 3 new bills added below. AI helped read 2. Check each one before sharing it.");
  });
  it("counts new bills", () => {
    expect(scanSummary({ ...zero, found: 2, imported: 2 }, ["Public Grid"]).title).toBe("Found 2 new bills");
  });
});

describe("payment receipts and follow-up notices", () => {
  it("skips receipts and confirmations, keeps 'payment due'", () => {
    expect(sig("Payment received - thank you", { amountFound: true })).toBe("skip");
    expect(sig("Your payment was successful", { amountFound: true, dueDateFound: true })).toBe("skip");
    expect(sig("Your receipt from Public Grid", { amountFound: true })).toBe("skip");
    expect(sig("Payment due soon")).toBe("notice");
  });

  it("drops a notice sent within 10 days of a real bill from the same company", () => {
    const all = [
      { company: "Public Grid", verdict: "statement" as const, date: "2026-08-04T14:34:00Z" },
      { company: "Public Grid", verdict: "notice" as const, date: "2026-08-05T09:00:00Z" },
      { company: "Public Grid", verdict: "notice" as const, date: "2026-07-01T09:00:00Z" },
      { company: "Xfinity", verdict: "notice" as const, date: "2026-08-05T09:00:00Z" },
    ];
    expect(all.map((x) => isFollowUpNotice(x, all))).toEqual([false, true, false, false]);
    expect(isFollowUpNotice({ company: "Public Grid", verdict: "notice", date: null }, all)).toBe(false);
  });
});
