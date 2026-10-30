import "server-only";
import { APP_DOMAIN, APP_NAME } from "@/lib/brand";
import type { EmailContent } from "@/lib/domain/email-templates";

/** Email is off until RESEND_API_KEY is set. Everything that sends must keep working without it. */
export function emailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY;
}

/** Sends one email through Resend. Returns false (never throws) so a failed email can't break the action that triggered it. */
export async function sendEmail(to: string, content: EmailContent, kind: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return false;
  const from = process.env.EMAIL_FROM || `${APP_NAME} <notifications@${APP_DOMAIN}>`;
  let ok = false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject: content.subject, text: content.text, html: content.html }),
      signal: AbortSignal.timeout(8000),
    });
    ok = res.ok;
  } catch {
    ok = false;
  }
  // Counts only: never the address, subject or body
  console.info(JSON.stringify({ event: "email_send", kind, ok }));
  return ok;
}
