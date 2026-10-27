import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { gmailAccessToken, findBillMessages, readBillMessage, readMessageSender } from "@/lib/gmail-api";
import { extractBillEmail } from "@/lib/import/extract";
import { billFromModel, emailText, mergeWithAi, needsAi } from "@/lib/domain/email-ai";
import { classifyBillEmail, isFollowUpNotice } from "@/lib/domain/bill-senders";
import { matchSource, senderAddress, sourcesSearchQuery, type BillSource, type LearnedSender } from "@/lib/domain/providers";
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
    // Only the companies this household chose (section 21.4). No choices yet: ask first.
    const { data: chosen } = await admin.from("space_bill_sources").select("sources, learned_senders").eq("space_id", spaceId).maybeSingle();
    const sources = (chosen?.sources ?? []) as BillSource[];
    let learned = (chosen?.learned_senders ?? []) as LearnedSender[];
    const query = sourcesSearchQuery(sources, learned);
    if (!query) return NextResponse.redirect(new URL(`${target}?gmail=pick_providers`, req.url));
    const messages = await findBillMessages(token, query);
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
    // What happened to each email, so the result can explain itself (no names, subjects or amounts).
    const stats = { found: messages.length, already: 0, otherSender: 0, notBill: 0, duplicate: 0, readByAi: 0 };
    // At most this many emails go to the AI per scan; the rest use the rules alone.
    let aiBudget = 15;
    // Pass 1: read and classify. Pass 2: save real bills first, then notices that aren't follow-ups of them.
    type Candidate = { message: { id: string }; sender: string; company: NonNullable<ReturnType<typeof matchSource>>; parsed: Awaited<ReturnType<typeof readBillMessage>>; text: string; extraction: ReturnType<typeof extractStatement>; verdict: "statement" | "notice" };
    const candidates: Candidate[] = [];
    for (const message of messages) {
      if (seen.has(message.id)) { stats.already++; continue; }
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
        stats.already++;
        continue;
      }
      // Double-check the sender from headers only; anything else is never downloaded.
      const sender = await readMessageSender(message.id, token);
      const company = matchSource(sender, sources, learned);
      if (!company) { stats.otherSender++; continue; }
      const parsed = await readBillMessage(message.id, token);
      // Plain text, not raw HTML, so labels and amounts land on readable lines.
      let text = `${parsed.subject}\n${parsed.from}\n${emailText(parsed.text, 50_000)}`;
      if (parsed.pdf) {
        try {
          const { extractText, getDocumentProxy } = await import("unpdf");
          const out = await extractText(await getDocumentProxy(new Uint8Array(parsed.pdf.bytes)), { mergePages: true });
          text = `${out.text}\n${text}`;
        } catch { /* continue with the email body */ }
      }
      let extraction = extractStatement(text);
      // Marketing from the same companies is skipped; only real bills and "your bill is ready" notices are kept.
      let verdict = classifyBillEmail({
        subject: parsed.subject, hasPdf: !!parsed.pdf, pdfName: parsed.pdf?.name,
        amountFound: extraction.amountDueCents.status === "found", dueDateFound: extraction.dueDate.status === "found",
      });
      if (process.env.NODE_ENV !== "production") console.info("[gmail-scan]", { from: parsed.from, subject: parsed.subject, verdict, amount: extraction.amountDueCents.status, due: extraction.dueDate.status, pdf: parsed.pdf?.name ?? null });
      // Any company, any wording: when the rules miss the amount or due date, the AI reads the email
      // and fills only those gaps (validated, and marked for review). Without a key or over budget, rules only.
      if (needsAi(extraction, verdict) && aiBudget > 0 && process.env.GEMINI_API_KEY) {
        const { data: requestId, error: limitErr } = await supabase.rpc("begin_ai_request", { p_kind: "email" });
        if (!limitErr) {
          aiBudget--;
          const { raw, usage } = await extractBillEmail(emailText(text));
          const ai = billFromModel(raw);
          await supabase.rpc("finish_extraction", { p_id: requestId, p_latency_ms: usage.latencyMs, p_input_tokens: usage.inputTokens, p_output_tokens: usage.outputTokens, p_succeeded: !!ai });
          ({ verdict, extraction } = mergeWithAi(extraction, verdict, ai));
          stats.readByAi++;
          if (process.env.NODE_ENV !== "production") console.info("[gmail-scan] ai", { subject: parsed.subject, kind: ai?.kind ?? "unreadable", verdict, amount: extraction.amountDueCents.status, due: extraction.dueDate.status });
        } else {
          aiBudget = 0;
        }
      }
      if (verdict === "skip") { stats.notBill++; continue; }
      candidates.push({ message, sender, company, parsed, text, extraction, verdict });
    }

    const marks = candidates.map((c) => ({ company: c.company.name, verdict: c.verdict, date: c.parsed.date }));
    candidates.sort((x, y) => (x.verdict === y.verdict ? 0 : x.verdict === "statement" ? -1 : 1));
    for (const { message, sender, company, parsed, text, extraction, verdict } of candidates) {
      if (isFollowUpNotice({ company: company.name, verdict, date: parsed.date }, marks)) { stats.duplicate++; continue; }
      if (verdict === "notice") extraction.kind = "notice_only";
      else if (extraction.kind === "notice_only") extraction.kind = "statement";
      // The household told us who sends this bill, so that name wins. A Public Grid bill mentions ComEd
      // (the delivery utility) in its text, but the bill, amount and due date are Public Grid's.
      if (extraction.provider.value !== company.name) {
        extraction.provider = { ...extraction.provider, value: company.name, status: "found" };
        extraction.reasons = extraction.reasons.filter((r) => !/provider/i.test(r));
        extraction.needsReview = extraction.reasons.length > 0;
      }
      // Remember the exact sender of a real bill, so later scans search for that address too.
      const address = senderAddress(sender);
      if (verdict === "statement" && address && !learned.some((l) => l.address === address) && learned.length < 30) {
        learned = [...learned, { address, name: company.name, category: company.category }];
        await admin.from("space_bill_sources").update({ learned_senders: learned }).eq("space_id", spaceId);
      }
      const parsedKey = statementKey(extraction);
      if (parsedKey) {
        const { data: sameBills } = await admin.from("statements").select("amount_cents, due_date").eq("space_id", spaceId).eq("statement_key", parsedKey).limit(20);
        if (sameBills?.some((row) => row.amount_cents === extraction.amountDueCents.value && row.due_date === extraction.dueDate.value)) { stats.duplicate++; continue; }
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
    const q = new URLSearchParams({ gmail: "sync_success", count: String(imported), found: String(stats.found), already: String(stats.already), other: String(stats.otherSender), notbill: String(stats.notBill), dup: String(stats.duplicate), ai: String(stats.readByAi) });
    return NextResponse.redirect(new URL(`${target}?${q}`, req.url));
  } catch (error) {
    const reason = error instanceof Error && error.message === "gmail_token_revoked" ? "revoked" : "sync_error";
    await admin.from("gmail_connections").update({ status: reason === "revoked" ? "revoked" : "error", last_error: reason, updated_at: new Date().toISOString() }).eq("user_id", user.id);
    return NextResponse.redirect(new URL(`${target}?gmail=${reason}`, req.url));
  }
}
