/**
 * The emails eqlTab sends to people who have joined a Space. Plain text plus a simple HTML copy.
 * Each email is about one person's own share and carries only a link back to the bill: no
 * account numbers, no other members' amounts. Names and titles are escaped, and subjects are one line.
 */
import { formatUSD } from "./money";
import { formatDate } from "./due";

export interface EmailContent { subject: string; text: string; html: string }

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim().slice(0, 120);

function build(subject: string, lines: string[], cta: { label: string; url: string }, footer: string): EmailContent {
  const text = [...lines, "", `${cta.label}: ${cta.url}`, "", footer].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#fdfbf7;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1d2b27">
<div style="max-width:480px;margin:0 auto;padding:28px 20px">
${lines.map((l) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.5">${esc(l)}</p>`).join("\n")}
<p style="margin:22px 0"><a href="${esc(cta.url)}" style="display:inline-block;background:#1d2b27;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:15px">${esc(cta.label)}</a></p>
<p style="margin:0;font-size:12px;color:#6b7a75;line-height:1.5">${esc(footer)}</p>
</div></body></html>`;
  return { subject: oneLine(subject), text, html };
}

const FOOTER = "You get this because you're in a shared Space on eqlTab. We never move money: this only tells you what's owed. You can change these emails under Space > Notifications.";

export function newBillEmail(i: { payerName: string; billTitle: string; shareCents: number; dueDate: string | null; spaceName: string; url: string }): EmailContent {
  const due = i.dueDate ? `, due ${formatDate(i.dueDate)}` : "";
  return build(
    `New bill in ${i.spaceName}: ${i.billTitle}`,
    [`${i.payerName} added "${i.billTitle}" to ${i.spaceName}.`, `Your share is ${formatUSD(i.shareCents)}${due}.`],
    { label: "See your share", url: i.url }, FOOTER,
  );
}

export function reminderEmail(i: { fromName: string; billTitle: string; owedCents: number; dueDate: string | null; url: string }): EmailContent {
  const due = i.dueDate ? ` The bill is due ${formatDate(i.dueDate)}.` : "";
  return build(
    `Reminder: ${formatUSD(i.owedCents)} for ${i.billTitle}`,
    [`${i.fromName} sent you a reminder about "${i.billTitle}".`, `You still owe ${formatUSD(i.owedCents)}.${due}`],
    { label: "Open the bill", url: i.url }, FOOTER,
  );
}

export function dueSoonEmail(i: { billTitle: string; owedCents: number; daysLeft: number; dueDate: string; payerName: string; url: string }): EmailContent {
  const when = i.daysLeft <= 0 ? "is due today" : i.daysLeft === 1 ? "is due tomorrow" : `is due in ${i.daysLeft} days`;
  return build(
    `${i.billTitle} ${when}`,
    [`"${i.billTitle}" ${when} (${formatDate(i.dueDate)}).`, `You owe ${i.payerName} ${formatUSD(i.owedCents)} for your share.`],
    { label: "Open the bill", url: i.url }, FOOTER,
  );
}
