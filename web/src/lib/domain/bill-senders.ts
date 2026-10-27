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
  const billPdf = e.hasPdf && /(bill|statement|invoice|\d{4}[-_]?\d{2})/i.test(e.pdfName ?? "");
  if ((e.amountFound || e.dueDateFound) && (billSubject || billPdf) ) return "statement";
  if (billPdf && !promo) return "statement";
  if ((e.amountFound && e.dueDateFound) && !promo) return "statement";
  if (billSubject && !promo) return "notice";
  return "skip";
}
