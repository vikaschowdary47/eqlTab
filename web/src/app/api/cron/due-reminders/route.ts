import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { emailEnabled } from "@/lib/email";
import { sendDueReminders } from "@/lib/notify";

export const dynamic = "force-dynamic";

/**
 * Daily job (see vercel.json). Vercel calls it with `Authorization: Bearer $CRON_SECRET`. Off until
 * CRON_SECRET and RESEND_API_KEY are set; anyone else gets a 401 and learns nothing.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !emailEnabled()) return NextResponse.json({ error: "reminders_disabled" }, { status: 503 });
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await sendDueReminders(new Date().toISOString().slice(0, 10));
  console.info(JSON.stringify({ event: "due_reminders", ...result }));
  return NextResponse.json({ ok: true, ...result });
}
