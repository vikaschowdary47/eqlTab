import Link from "next/link";
import type { Metadata } from "next";
import { getSpaceContext, getStatements, getUser, missingStatements } from "@/lib/data";
import { formatDate } from "@/lib/domain/due";
import { env } from "@/lib/env";
import { AutoBillsList } from "@/components/auto-bills-list";
import { UploadStatement } from "@/components/upload-statement";
import { CopyField } from "@/components/copy-field";
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
  const { data: gmailConnection } = ctx.me?.user_id ? await gmail.from("gmail_connections").select("gmail_address, status").eq("user_id", ctx.me.user_id).eq("status", "active").maybeSingle() : { data: null };

  return (
    <div className="auto-bills-stage relative space-y-10 max-w-[920px]">
      <div className="heikei-art" aria-hidden="true"><span className="heikei-seed" /><span className="heikei-seed" /><span className="heikei-seed" /></div>
      <header className="rise max-w-[680px]">
        <Link href={`/s/${spaceId}/bills`} className="inline-flex items-center gap-2 text-[14px] font-medium text-ink-2 hover:text-ink transition-colors">← <span>Bills</span></Link>
        <p className="mt-8 text-[12px] font-semibold uppercase tracking-[0.18em] text-brand-ink">Inbox to shared</p>
        <h1 className="mt-3 text-[clamp(36px,7vw,64px)] font-semibold tracking-[-0.065em] leading-[.95]">Auto Bills<span className="text-brand-strong">.</span></h1>
        <p className="text-ink-2 mt-5 max-w-[56ch] text-[16px] leading-7">Statements arrive here. We read the provider, amount, due date, and billing period. You check the details, then everyone sees their share.</p>
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

      {ctx.me && (
        <section id="companies" aria-label="Who sends your bills" className="rise-2 scroll-mt-24">
          <BillSources spaceId={spaceId} state={billSources?.state ?? null} sources={chosenSources} gmailConnected={!!gmailConnection} />
        </section>
      )}

      {ctx.me && (
        <div className="grid md:grid-cols-2 gap-6 items-start">
          <section aria-labelledby="up" className="space-y-3">
            <div className="flex items-center justify-between"><h2 id="up" className="text-[17px] font-semibold tracking-[-0.01em]">Upload a statement</h2><Chip tone="success">Available</Chip></div>
            <UploadStatement spaceId={spaceId} />
          </section>

          <section id="forwarding" aria-labelledby="fw" className="space-y-3 scroll-mt-24">
            <div className="flex items-center justify-between"><h2 id="fw" className="text-[17px] font-semibold tracking-[-0.01em]">Forward bill emails</h2>{forwardingLive ? <Chip tone="success">On</Chip> : <Chip>Coming soon</Chip>}</div>
            <Card className="p-5 space-y-4">
              {!forwardingLive && <Notice tone="neutral" title="Forwarding isn't switched on yet">Your address is reserved for this Space. Until forwarding is on, upload the PDF or a photo of the bill instead.</Notice>}
              <CopyField label="This Space's private address" value={address} mono />
              <ol className="space-y-2.5 text-[14px] text-ink-2 list-decimal pl-5 marker:text-muted">
                <li>In your email, open a bill from your provider, for example ComEd.</li>
                <li>Forward it, with the PDF attached if there is one, to the address above.</li>
                <li>To do this automatically, create a filter for the provider's sender and forward matches here. You can turn the filter off anytime.</li>
              </ol>
              <p className="text-[13px] text-muted">Many providers only email "your bill is ready" with a sign-in link. When that happens we'll ask you for the statement instead of guessing the amount.</p>
            </Card>
          </section>
          <section aria-labelledby="gmail" className="space-y-3">
            <div className="flex items-center justify-between"><h2 id="gmail" className="text-[17px] font-semibold tracking-[-0.01em]">Connect Gmail</h2><Chip tone={gmailConnection ? "success" : "neutral"}>{gmailConnection ? "Connected" : "Optional"}</Chip></div>
            <GmailConnect spaceId={spaceId} address={gmailConnection?.gmail_address} status={gmailStatus} count={gmailCount} signedInEmail={signedInEmail} got={gmailGot} hasSources={chosenSources.length > 0} scanStats={scanStats} companies={chosenSources.map((x) => x.name)} />
          </section>
        </div>
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
