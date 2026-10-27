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
