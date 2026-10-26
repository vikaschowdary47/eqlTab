import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { gmailAccessToken, findBillMessages, readBillMessage } from "@/lib/gmail-api";
import { extractStatement, statementKey } from "@/lib/domain/statement";

export async function POST(req: Request) {
  const spaceId = new URL(req.url).searchParams.get("spaceId");
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = supabaseAdmin();
  if (!user || !admin || !spaceId) return NextResponse.json({ error: "not_configured" }, { status: 400 });
  const { data: member } = await admin.from("space_members").select("id").eq("space_id", spaceId).eq("user_id", user.id).eq("status", "active").maybeSingle();
  if (!member) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { data: connection } = await admin.from("gmail_connections").select("refresh_token_ciphertext").eq("user_id", user.id).eq("status", "active").maybeSingle();
  if (!connection) return NextResponse.json({ error: "gmail_not_connected" }, { status: 400 });

  try {
    const token = await gmailAccessToken(connection);
    const messages = await findBillMessages(token);
    const { data: space } = await admin.from("spaces").select("inbound_token").eq("id", spaceId).maybeSingle();
    if (!space) return NextResponse.json({ error: "space_not_found" }, { status: 404 });
    let imported = 0;
    for (const message of messages) {
      const parsed = await readBillMessage(message.id, token);
      let text = parsed.text;
      if (parsed.pdf) {
        try {
          const { extractText, getDocumentProxy } = await import("unpdf");
          const out = await extractText(await getDocumentProxy(new Uint8Array(parsed.pdf.bytes)), { mergePages: true });
          text = `${out.text}\n${text}`;
        } catch { /* continue with the email body */ }
      }
      const extraction = extractStatement(text);
      let filePath: string | null = null;
      let fileName: string | null = null;
      if (parsed.pdf && parsed.pdf.bytes.length <= 10 * 1024 * 1024) {
        const path = `${spaceId}/${crypto.randomUUID()}.pdf`;
        const upload = await admin.storage.from("statements").upload(path, parsed.pdf.bytes, { contentType: "application/pdf", upsert: false });
        if (!upload.error) { filePath = path; fileName = parsed.pdf.name.slice(0, 200); }
      }
      const { error } = await admin.rpc("ingest_emailed_statement", {
        p_inbound_token: space.inbound_token, p_sender: null, p_file_path: filePath, p_file_name: fileName,
        p_kind: text.trim() ? extraction.kind : "unreadable", p_provider: extraction.provider.value, p_amount_cents: extraction.amountDueCents.value,
        p_due_date: extraction.dueDate.value, p_period_start: extraction.periodStart, p_period_end: extraction.periodEnd, p_account_last4: extraction.accountLast4,
        p_statement_ref: extraction.statementId ?? message.id, p_statement_key: statementKey(extraction), p_reasons: extraction.reasons, p_parser_version: extraction.parserVersion,
      });
      if (!error) imported++;
    }
    return NextResponse.redirect(new URL(`/s/${spaceId}/auto-bills?gmail=sync_success&count=${imported}`, req.url));
  } catch (error) {
    const reason = error instanceof Error && error.message === "gmail_token_revoked" ? "revoked" : "sync_error";
    await admin.from("gmail_connections").update({ status: reason === "revoked" ? "revoked" : "error", last_error: reason, updated_at: new Date().toISOString() }).eq("user_id", user.id);
    return NextResponse.redirect(new URL(`/s/${spaceId}/auto-bills?gmail=${reason}`, req.url));
  }
}
