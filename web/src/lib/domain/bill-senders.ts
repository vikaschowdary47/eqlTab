/**
 * Gmail scan helpers (spec sections 17.2 and 21.4). Which companies to search comes from the
 * household's own choices (providers.ts); this file decides whether one of their emails is a bill.
 */

/** "ComEd <noreply@e.comed.com>" → "e.comed.com". Null when there is no usable address. */
export function senderDomain(from: string): string | null {
  const addr = /<([^>]+)>/.exec(from)?.[1] ?? from;
  const m = /@([a-z0-9.-]+\.[a-z]{2,})\s*$/i.exec(addr.trim());
  return m ? m[1].toLowerCase() : null;
}

export interface BillEmailSignals {
  subject: string;
  hasPdf: boolean;
  pdfName?: string;
  amountFound: boolean;
  dueDateFound: boolean;
}

/**
 * Decides what a bill-sender email is. Marketing from the same companies ("Upgrade your plan",
 * "Sign in to view your bill" in the footer) must be skipped, not shown as a bill.
 *  - "statement": a bill we can read: an amount or a due date was found, or a bill PDF is attached.
 *  - "notice": the subject itself says a bill or statement is ready, but the email has no details.
 *  - "skip": everything else.
 */
export function classifyBillEmail(e: BillEmailSignals): "statement" | "notice" | "skip" {
  const subject = e.subject.toLowerCase();
  const promo = /(\boffer|\bdeal|save \$|% off|upgrade|new phone|switch|limited time|exclusive|rewards?|survey|webinar|newsletter|tips|introducing|welcome to)/i.test(subject);
  const billSubject = /(\b(e-?bill|bill|statement|invoice)\b.*\b(ready|available|due|posted|is here|has arrived)\b|\b(payment|amount|balance) due\b|\bpayment reminder\b|\bautopay\b|\byour (?:monthly |new |latest )?(?:bill|statement)\b)/i.test(subject);
  // Receipts and confirmations are about a payment already made, not a bill to split.
  if (/(payment (?:received|confirmed|confirmation|successful|processed|complete)|thank you for your payment|\breceipt\b|has been paid|was paid|paid successfully|payment was (?:made|received|successful))/i.test(subject)) return "skip";
  const billPdf = e.hasPdf && /(bill|statement|invoice|\d{4}[-_]?\d{2})/i.test(e.pdfName ?? "");
  if ((e.amountFound || e.dueDateFound) && (billSubject || billPdf) ) return "statement";
  if (billPdf && !promo) return "statement";
  if ((e.amountFound && e.dueDateFound) && !promo) return "statement";
  if (billSubject && !promo) return "notice";
  return "skip";
}

export interface ScanStats { imported: number; found: number; already: number; otherSender: number; notBill: number; duplicate: number }

/** Plain-language result of a Gmail scan, so "0 imported" always says why. */
export function scanSummary(s: ScanStats, companies: string[]): { title: string; detail: string } {
  const who = companies.length ? listNames(companies) : "your companies";
  if (s.found === 0) {
    return {
      title: `No emails from ${who} in the last 90 days`,
      detail: "If your bill comes from a different company (for example a billing service like Public Grid), tap Change and use \"Find my bills in Gmail\".",
    };
  }
  const parts: string[] = [];
  if (s.imported) parts.push(`${s.imported} new ${s.imported === 1 ? "bill" : "bills"} added below`);
  if (s.already) parts.push(`${s.already} already here`);
  if (s.duplicate) parts.push(`${s.duplicate} same as a bill you already have`);
  if (s.notBill) parts.push(`${s.notBill} weren't bills (ads or account alerts)`);
  if (s.otherSender) parts.push(`${s.otherSender} from a different sender`);
  return {
    title: s.imported ? `Found ${s.imported} new ${s.imported === 1 ? "bill" : "bills"}` : "No new bills",
    detail: `Checked ${s.found} ${s.found === 1 ? "email" : "emails"} from ${who}: ${parts.join(", ")}.${s.imported ? " Check each one before sharing it." : ""}`,
  };
}

function listNames(n: string[]) {
  return n.length <= 2 ? n.join(" and ") : `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}`;
}

/**
 * A "your bill is ready" notice is a follow-up when the same company sent a real bill within a few days
 * (Public Grid sends both). Returns true for notices to drop. Items without a date are kept.
 */
export function isFollowUpNotice(item: { company: string; verdict: "statement" | "notice"; date: string | null }, all: { company: string; verdict: "statement" | "notice"; date: string | null }[], days = 10): boolean {
  if (item.verdict !== "notice" || !item.date) return false;
  const t = Date.parse(item.date);
  return all.some((o) => o.verdict === "statement" && o.company === item.company && o.date !== null && Math.abs(Date.parse(o.date) - t) <= days * 86_400_000);
}
