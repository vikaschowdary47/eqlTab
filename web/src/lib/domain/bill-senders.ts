/**
 * Which emails the Gmail scan may open (spec sections 17.2 and 21.4: read only bill senders).
 *
 * The scan asks Gmail only for mail from these domains, then checks each message's From header
 * (metadata only, no body) before downloading anything. Bank statements, shopping receipts and
 * personal mail are never opened.
 *
 * Domains match the sender's domain or any subdomain ("e.comed.com" matches "comed.com").
 * Add more with GMAIL_BILL_SENDERS="example-utility.com,other.com". Check a provider's real
 * sending domain from one of its bill emails before adding it.
 */
export const DEFAULT_BILL_SENDER_DOMAINS = [
  // Electricity and gas (Chicago area first, then other large US utilities)
  "comed.com", "nicorgas.com", "nicor.com", "peoplesgasdelivery.com", "ameren.com",
  "dteenergy.com", "consumersenergy.com", "duke-energy.com", "coned.com", "pge.com", "sce.com",
  "nationalgrid.com", "xcelenergy.com", "dominionenergy.com", "pseg.com", "eversource.com",
  "georgiapower.com", "fpl.com", "aep.com", "firstenergycorp.com", "pplelectric.com",
  // Internet, TV and phone
  "xfinity.com", "comcast.net", "att.com", "att-mail.com", "spectrum.com", "charter.net",
  "verizon.com", "verizonwireless.com", "t-mobile.com", "mintmobile.com", "cox.com",
  "frontier.com", "rcn.com", "astound.com", "wowway.com",
  // Bill-pay services many utilities and landlords send through
  "paymentus.com", "invoicecloud.com", "invoicecloud.net",
] as const;

export function billSenderDomains(extra = ""): string[] {
  const added = extra.split(",").map((d) => d.trim().toLowerCase()).filter((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d));
  return [...new Set([...DEFAULT_BILL_SENDER_DOMAINS, ...added])];
}

/** "ComEd <noreply@e.comed.com>" → "e.comed.com". Null when there is no usable address. */
export function senderDomain(from: string): string | null {
  const addr = /<([^>]+)>/.exec(from)?.[1] ?? from;
  const m = /@([a-z0-9.-]+\.[a-z]{2,})\s*$/i.exec(addr.trim());
  return m ? m[1].toLowerCase() : null;
}

export function isBillSender(from: string, domains: string[]): boolean {
  const d = senderDomain(from);
  return !!d && domains.some((allowed) => d === allowed || d.endsWith(`.${allowed}`));
}

/** Gmail search limited to bill senders. Gmail's from: matches subdomains of a domain too. */
export function billSearchQuery(domains: string[], days = 90): string {
  return `newer_than:${days}d from:(${domains.join(" OR ")}) -in:chats`;
}

/** Provider names by sender domain, so a bill from e.comed.com is labelled ComEd even when the body doesn't say it. */
const PROVIDER_BY_DOMAIN: Record<string, string> = {
  "comed.com": "ComEd", "nicorgas.com": "Nicor Gas", "nicor.com": "Nicor Gas", "peoplesgasdelivery.com": "Peoples Gas",
  "ameren.com": "Ameren", "dteenergy.com": "DTE Energy", "consumersenergy.com": "Consumers Energy", "duke-energy.com": "Duke Energy",
  "coned.com": "Con Edison", "pge.com": "PG&E", "sce.com": "SCE", "nationalgrid.com": "National Grid", "xcelenergy.com": "Xcel Energy",
  "dominionenergy.com": "Dominion Energy", "pseg.com": "PSE&G", "eversource.com": "Eversource", "georgiapower.com": "Georgia Power",
  "fpl.com": "FPL", "aep.com": "AEP", "firstenergycorp.com": "FirstEnergy", "pplelectric.com": "PPL Electric",
  "xfinity.com": "Xfinity", "comcast.net": "Xfinity", "att.com": "AT&T", "att-mail.com": "AT&T", "spectrum.com": "Spectrum",
  "charter.net": "Spectrum", "verizon.com": "Verizon", "verizonwireless.com": "Verizon", "t-mobile.com": "T-Mobile",
  "mintmobile.com": "Mint Mobile", "cox.com": "Cox", "frontier.com": "Frontier", "rcn.com": "RCN", "astound.com": "Astound", "wowway.com": "WOW!",
};

export function providerFromSender(from: string): string | null {
  const d = senderDomain(from);
  if (!d) return null;
  const key = Object.keys(PROVIDER_BY_DOMAIN).find((k) => d === k || d.endsWith(`.${k}`));
  return key ? PROVIDER_BY_DOMAIN[key] : null;
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
