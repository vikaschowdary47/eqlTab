import { describe, expect, it } from "vitest";
import { billSearchQuery, billSenderDomains, classifyBillEmail, isBillSender, providerFromSender, senderDomain } from "@/lib/domain/bill-senders";

const domains = billSenderDomains();

describe("Gmail bill senders", () => {
  it("reads the sender's domain", () => {
    expect(senderDomain("ComEd <noreply@e.comed.com>")).toBe("e.comed.com");
    expect(senderDomain("billing@xfinity.com")).toBe("xfinity.com");
    expect(senderDomain("no address")).toBeNull();
  });

  it("accepts utilities and their subdomains", () => {
    expect(isBillSender("ComEd <noreply@e.comed.com>", domains)).toBe(true);
    expect(isBillSender("Nicor Gas <ebill@nicorgas.com>", domains)).toBe(true);
    expect(isBillSender("Xfinity <online.communications@alerts.comcast.net>", domains)).toBe(true);
  });

  it("never opens banks, shopping or look-alike domains", () => {
    expect(isBillSender("Chase <no.reply.alerts@chase.com>", domains)).toBe(false);
    expect(isBillSender("Amazon <auto-confirm@amazon.com>", domains)).toBe(false);
    expect(isBillSender("Scam <billing@comed.com.evil.io>", domains)).toBe(false);
    expect(isBillSender("Scam <billing@notcomed.com>", domains)).toBe(false);
  });

  it("adds valid extra domains from settings and ignores junk", () => {
    const d = billSenderDomains(" MyCityWater.org, not a domain, ");
    expect(d).toContain("mycitywater.org");
    expect(d).not.toContain("not a domain");
  });

  it("searches only those senders", () => {
    const q = billSearchQuery(["comed.com", "xfinity.com"]);
    expect(q).toBe("newer_than:90d from:(comed.com OR xfinity.com) -in:chats");
    expect(q).not.toMatch(/has:attachment|statement/);
  });
});


const sig = (subject: string, o: Partial<Parameters<typeof classifyBillEmail>[0]> = {}) =>
  classifyBillEmail({ subject, hasPdf: false, amountFound: false, dueDateFound: false, ...o });

describe("which bill-sender emails count", () => {
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

  it("names the provider from the sender when the body doesn't", () => {
    expect(providerFromSender("ComEd <noreply@e.comed.com>")).toBe("ComEd");
    expect(providerFromSender("AT&T <att@emaildl.att-mail.com>")).toBe("AT&T");
    expect(providerFromSender("someone@gmail.com")).toBeNull();
  });
});
