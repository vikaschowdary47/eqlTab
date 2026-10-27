import { describe, expect, it } from "vitest";
import { billSearchQuery, billSenderDomains, isBillSender, senderDomain } from "@/lib/domain/bill-senders";

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
