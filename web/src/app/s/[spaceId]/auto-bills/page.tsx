import Link from "next/link";
import type { Metadata } from "next";
import { getSpaceContext, getStatements, getUser, missingStatements } from "@/lib/data";
import { formatDate } from "@/lib/domain/due";
import { env } from "@/lib/env";
import { AutoBillsList } from "@/components/auto-bills-list";
import { UploadStatement } from "@/components/upload-statement";
import { CopyField } from "@/components/copy-field";
import { ForwardingGuide } from "@/components/forwarding-guide";
import { Card, Chip, Notice, SectionTitle } from "@/components/ui";
import { GmailConnect } from "@/components/gmail-connect";
import { BillSources } from "@/components/bill-sources";
import type { BillSource } from "@/lib/domain/providers";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Auto Bills" };

export default async function AutoBillsPage({ params, searchParams }: { params: Promise<{ spaceId: string }>; searchParams: Promise<{ gmail?: string; count?: string; got?: string; found?: string; already?: string; other?: string; notbill?: string; dup?: string }> }) {
  const { spaceId } = await params;
  const ctx = (await getSpaceContext(spaceId))!;
  const statements = await getStatements(spaceId);
  const open = statements.filter((s) => ["ready", "needs_review", "needs_statement", "failed"].includes(s.status));
  const done = statements.filter((s) => !open.includes(s));
  const missing = missingStatements(statements);
  const forwardingLive = !!process.env.INBOUND_WEBHOOK_SECRET && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  const address = `bills+${ctx.space.inbound_token}@${env.inboundDomain()}`;
  const sp = await searchParams;
  const { gmail: gmailStatus, count: gmailCount, got: gmailGot } = sp;
  const n = (v?: string) => Math.min(Math.max(Number(v) || 0, 0), 999);
  const scanStats = sp.found !== undefined ? { imported: n(sp.count), found: n(sp.found), already: n(sp.already), otherSender: n(sp.other), notBill: n(sp.notbill), duplicate: n(sp.dup) } : undefined;
  const signedInEmail = (await getUser())?.email ?? undefined;
  const gmail = await supabaseServer();
  const { data: billSources } = await gmail.from("space_bill_sources").select("state, sources").eq("space_id", spaceId).maybeSingle();
  const chosenSources = (billSources?.sources ?? []) as BillSource[];
  const { data: fwCode } = await gmail.from("space_forwarding_codes").select("code, received_at").eq("space_id", spaceId).maybeSingle();
  const { data: gmailConnection } = ctx.me?.user_id ? await gmail.from("gmail_connections").select("gmail_address, status").eq("user_id", ctx.me.user_id).eq("status", "active").maybeSingle() : { data: null };

  return (
    <div className="space-y-6 max-w-[920px]">
      <header className="rise">
        <Link href={`/s/${spaceId}/bills`} className="inline-flex items-center gap-2 text-[14px] font-medium text-ink-2 hover:text-ink transition-colors">← <span>Bills</span></Link>
        <h1 className="mt-3 text-[clamp(28px,5vw,40px)] font-semibold tracking-[-0.05em] leading-none">Auto Bills<span className="text-brand-strong">.</span></h1>
        <p className="text-ink-2 mt-2 max-w-[60ch] text-[15px] leading-6">Bills arrive here. We read the provider, amount and due date, you check them, then everyone sees their share.</p>
      </header>

      {missing.map((m) => (
        <Notice key={m.provider} tone="warning" title={`We haven't received this month's ${m.provider} bill`}>
          The last one covered a period ending {m.lastPeriodEnd ? formatDate(m.lastPeriodEnd) : "over a month ago"}. That doesn't mean it's paid. Check the provider's site or your email, then upload the statement.
        </Notice>
      ))}

      {open.length > 0 && (
        <section aria-labelledby="todo">
          <SectionTitle id="todo" action={<span className="text-[12px] text-muted">{open.length} to review</span>}>Waiting for you</SectionTitle>
          <AutoBillsList statements={open} spaceId={spaceId} />
        </section>
      )}

      {ctx.me && (open.length > 0 ? (
        <details id="add-bills" className="group rounded-[14px] ring-1 ring-line bg-surface scroll-mt-24" open={!!gmailStatus}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[15px] font-medium">
            <span>Add more bills<span className="ml-2 text-[13px] font-normal text-muted">forward an email, connect Gmail or upload</span></span>
            <span className="text-muted transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
          </summary>
          <div className="space-y-6 px-4 pb-4">
        <div className="grid md:grid-cols-2 gap-4 items-start rise-2">
              <section id="forwarding" aria-labelledby="fw" className="space-y-2 scroll-mt-24">
                <div className="flex items-center justify-between"><h2 id="fw" className="text-[16px] font-semibold tracking-[-0.01em]">Forward bill emails</h2>{forwardingLive ? <Chip tone="success">On</Chip> : <Chip>Coming soon</Chip>}</div>
                <Card className="p-4 space-y-3">
                  {!forwardingLive && <Notice tone="neutral" title="Forwarding isn't switched on yet">Your address is reserved for this Space. Until forwarding is on, upload the PDF or a photo of the bill instead.</Notice>}
                  <CopyField label="This Space's private address" value={address} mono />
                  <ForwardingGuide address={address} code={fwCode ? { code: fwCode.code, receivedAt: fwCode.received_at } : null} />
                  <p className="text-[12px] text-muted">If a provider only emails "your bill is ready", we'll ask you for the amount instead of guessing.</p>
                </Card>
              </section>
              <section aria-labelledby="gmail" className="space-y-2">
                <div className="flex items-center justify-between"><h2 id="gmail" className="text-[16px] font-semibold tracking-[-0.01em]">Connect Gmail</h2><Chip tone={gmailConnection ? "success" : "neutral"}>{gmailConnection ? "Connected" : "Optional"}</Chip></div>
                <GmailConnect spaceId={spaceId} address={gmailConnection?.gmail_address} status={gmailStatus} count={gmailCount} signedInEmail={signedInEmail} got={gmailGot} hasSources={chosenSources.length > 0} scanStats={scanStats} companies={chosenSources.map((x) => x.name)} />
              </section>
            </div>

        <section aria-labelledby="up" className="space-y-2">
              <h2 id="up" className="text-[16px] font-semibold tracking-[-0.01em]">Or upload a bill</h2>
              <UploadStatement spaceId={spaceId} />
            </section>
          </div>
        </details>
      ) : (
        <>
        <div className="grid md:grid-cols-2 gap-4 items-start rise-2">
          <section id="forwarding" aria-labelledby="fw" className="space-y-2 scroll-mt-24">
            <div className="flex items-center justify-between"><h2 id="fw" className="text-[16px] font-semibold tracking-[-0.01em]">Forward bill emails</h2>{forwardingLive ? <Chip tone="success">On</Chip> : <Chip>Coming soon</Chip>}</div>
            <Card className="p-4 space-y-3">
              {!forwardingLive && <Notice tone="neutral" title="Forwarding isn't switched on yet">Your address is reserved for this Space. Until forwarding is on, upload the PDF or a photo of the bill instead.</Notice>}
              <CopyField label="This Space's private address" value={address} mono />
              <ForwardingGuide address={address} code={fwCode ? { code: fwCode.code, receivedAt: fwCode.received_at } : null} />
              <p className="text-[12px] text-muted">If a provider only emails "your bill is ready", we'll ask you for the amount instead of guessing.</p>
            </Card>
          </section>
          <section aria-labelledby="gmail" className="space-y-2">
            <div className="flex items-center justify-between"><h2 id="gmail" className="text-[16px] font-semibold tracking-[-0.01em]">Connect Gmail</h2><Chip tone={gmailConnection ? "success" : "neutral"}>{gmailConnection ? "Connected" : "Optional"}</Chip></div>
            <GmailConnect spaceId={spaceId} address={gmailConnection?.gmail_address} status={gmailStatus} count={gmailCount} signedInEmail={signedInEmail} got={gmailGot} hasSources={chosenSources.length > 0} scanStats={scanStats} companies={chosenSources.map((x) => x.name)} />
          </section>
        </div>

        <section aria-labelledby="up" className="space-y-2">
          <h2 id="up" className="text-[16px] font-semibold tracking-[-0.01em]">Or upload a bill</h2>
          <UploadStatement spaceId={spaceId} />
        </section>
        </>
      ))}

      {ctx.me && (
        <details id="companies" className="group rounded-[14px] ring-1 ring-line bg-surface scroll-mt-24" open={chosenSources.length === 0 && !!gmailConnection}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[15px] font-medium">
            <span>Which companies should Gmail look for?{chosenSources.length > 0 && <span className="ml-2 text-[13px] font-normal text-muted">{chosenSources.length} chosen</span>}</span>
            <span className="text-muted transition-transform group-open:rotate-180" aria-hidden="true">⌄</span>
          </summary>
          <div className="px-4 pb-4">
            <BillSources spaceId={spaceId} state={billSources?.state ?? null} sources={chosenSources} gmailConnected={!!gmailConnection} />
          </div>
        </details>
      )}

      {done.length > 0 && (
        <section aria-labelledby="past">
          <SectionTitle id="past">History</SectionTitle>
          <AutoBillsList statements={done} spaceId={spaceId} />
        </section>
      )}
    </div>
  );
}
