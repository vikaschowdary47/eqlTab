import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { gmailAccessToken, findBillMessages, readBillMessage, readMessageSender } from "@/lib/gmail-api";
import { billSenderDomains, isBillSender } from "@/lib/domain/bill-senders";
import { extractStatement, statementKey } from "@/lib/domain/statement";

export async function POST(req: Request) {
  const spaceId = new URL(req.url).searchParams.get("spaceId");
  const target = spaceId ? `/s/${spaceId}/auto-bills` : "/home";
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = supabaseAdmin();
  if (!user) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(target)}`, req.url));
  if (!admin || !spaceId) return NextResponse.redirect(new URL(`${target}?gmail=not_configured`, req.url));
  const { data: member } = await admin.from("space_members").select("id").eq("space_id", spaceId).eq("user_id", user.id).eq("status", "active").maybeSingle();
  if (!member) return NextResponse.redirect(new URL(`${target}?gmail=forbidden`, req.url));
  const { data: connection } = await admin.from("gmail_connections").select("refresh_token_ciphertext").eq("user_id", user.id).eq("status", "active").maybeSingle();
  if (!connection) return NextResponse.redirect(new URL(`${target}?gmail=gmail_not_connected`, req.url));

  try {
    const token = await gmailAccessToken(connection);
    const domains = billSenderDomains(process.env.GMAIL_BILL_SENDERS);
    const messages = await findBillMessages(token, domains);
    const { data: space } = await admin.from("spaces").select("inbound_token").eq("id", spaceId).maybeSingle();
    if (!space) return NextResponse.json({ error: "space_not_found" }, { status: 404 });
    const messageIds = messages.map((message) => message.id);
    const existingQuery = messageIds.length
      ? await admin.from("statements").select("statement_ref").eq("space_id", spaceId).eq("source", "email").in("statement_ref", messageIds)
      : { data: [], error: null };
    if (existingQuery.error) throw new Error("gmail_dedupe_lookup_failed");
    const existing = existingQuery.data;
    const seen = new Set((existing ?? []).map((row) => row.statement_ref).filter((value): value is string => !!value));
    let imported = 0;
    for (const message of messages) {
      if (seen.has(message.id)) continue;
      // Check immediately before processing too. This keeps repeated scans idempotent
      // even if the batch lookup is stale or contains duplicate legacy rows.
      const { data: existingRows, error: existingError } = await admin.from("statements")
        .select("id")
        .eq("space_id", spaceId)
        .eq("source", "email")
        .eq("statement_ref", message.id)
        .limit(1);
      if (existingError) throw new Error("gmail_dedupe_lookup_failed");
      if (existingRows?.length) {
        seen.add(message.id);
        continue;
      }
      // Double-check the sender from headers only; anything else is never downloaded.
      if (!isBillSender(await readMessageSender(message.id, token), domains)) continue;
      const parsed = await readBillMessage(message.id, token);
      let text = `${parsed.subject}\n${parsed.from}\n${parsed.text}`;
      if (parsed.pdf) {
        try {
          const { extractText, getDocumentProxy } = await import("unpdf");
          const out = await extractText(await getDocumentProxy(new Uint8Array(parsed.pdf.bytes)), { mergePages: true });
          text = `${out.text}\n${text}`;
        } catch { /* continue with the email body */ }
      }
      const extraction = extractStatement(text);
      const billLanguage = /(bill|statement|invoice|amount due|balance due|payment due|utility|service period|billing period|pay by)/i.test(text);
      const pdfNameSignal = !!parsed.pdf && /(bill|statement|invoice|utility|comed|xfinity|spectrum|verizon|att)/i.test(parsed.pdf.name);
      const usefulDetail = extraction.provider.status === "found" || extraction.amountDueCents.status === "found" || extraction.dueDate.status === "found" || !!extraction.periodStart || !!extraction.periodEnd || !!extraction.statementId;
      const isBillCandidate = billLanguage || pdfNameSignal;
      const isNotice = extraction.kind === "notice_only";
      if (!isBillCandidate || (!usefulDetail && !parsed.pdf && !isNotice)) continue;
      const parsedKey = statementKey(extraction);
      if (parsedKey) {
        const { data: sameBills } = await admin.from("statements").select("amount_cents, due_date").eq("space_id", spaceId).eq("statement_key", parsedKey).limit(20);
        if (sameBills?.some((row) => row.amount_cents === extraction.amountDueCents.value && row.due_date === extraction.dueDate.value)) continue;
      }
      let filePath: string | null = null;
      let fileName: string | null = null;
      if (parsed.pdf && parsed.pdf.bytes.length <= 10 * 1024 * 1024) {
        const path = `${spaceId}/${crypto.randomUUID()}.pdf`;
        const upload = await admin.storage.from("statements").upload(path, parsed.pdf.bytes, { contentType: "application/pdf", upsert: false });
        if (!upload.error) { filePath = path; fileName = parsed.pdf.name.slice(0, 200); }
      }
      const { error } = await admin.rpc("ingest_emailed_statement", {
        p_inbound_token: space.inbound_token, p_sender: parsed.from.slice(0, 200) || null, p_file_path: filePath, p_file_name: fileName,
        p_kind: text.trim() ? extraction.kind : "unreadable", p_provider: extraction.provider.value, p_amount_cents: extraction.amountDueCents.value,
        p_due_date: extraction.dueDate.value, p_period_start: extraction.periodStart, p_period_end: extraction.periodEnd, p_account_last4: extraction.accountLast4,
        p_statement_ref: message.id, p_statement_key: parsedKey, p_reasons: extraction.reasons, p_parser_version: extraction.parserVersion,
      });
      if (!error) { imported++; seen.add(message.id); }
      else if (error.code !== "23505") throw new Error("gmail_import_failed");
    }
    return NextResponse.redirect(new URL(`${target}?gmail=sync_success&count=${imported}`, req.url));
  } catch (error) {
    const reason = error instanceof Error && error.message === "gmail_token_revoked" ? "revoked" : "sync_error";
    await admin.from("gmail_connections").update({ status: reason === "revoked" ? "revoked" : "error", last_error: reason, updated_at: new Date().toISOString() }).eq("user_id", user.id);
    return NextResponse.redirect(new URL(`${target}?gmail=${reason}`, req.url));
  }
}
