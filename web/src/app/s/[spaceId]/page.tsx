import Link from "next/link";
import type { Metadata } from "next";
import { getActivity, getBills, getProfile, getSpaceContext, getStatements, getUnreadNotifications } from "@/lib/data";
import { TopNotices } from "@/components/top-notices";
import { buildAttention } from "@/lib/attention";
import { balancesByPerson } from "@/lib/domain/balances";
import { formatDate, todayISO } from "@/lib/domain/due";
import { SPACE_PRESETS } from "@/lib/domain/spaces";
import { ActivityList } from "@/components/activity";
import { BillRow } from "@/components/bill-row";
import { ButtonLink, Card, Chip, EmptyState, FacePile, Money, SectionTitle, ShareBar, cx } from "@/components/ui";
import { BalanceCards } from "@/components/balance-cards";
import { QuickAdd } from "@/components/quick-add";
import { HomeActions } from "@/components/home-actions";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Home" };

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "America/Chicago" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default async function Dashboard({ params, searchParams }: { params: Promise<{ spaceId: string }>; searchParams: Promise<{ claimed?: string }> }) {
  const { spaceId } = await params;
  const claimed = Math.min(Math.max(Number((await searchParams).claimed) || 0, 0), 99);
  const ctx = (await getSpaceContext(spaceId))!;
  const [bills, statements, activity, profile, notes] = await Promise.all([getBills(spaceId, ctx), getStatements(spaceId), getActivity(spaceId, 6), getProfile(), getUnreadNotifications()]);
  const meId = ctx.formerMe?.id ?? null;
  const today = todayISO();
  const preset = SPACE_PRESETS[ctx.space.type];

  const splits = bills.flatMap((b) => b.splits.map((s) => ({
    id: s.id, memberId: s.member.id, amountCents: s.amount_cents, payerMemberId: b.payer.id,
    settlements: s.settlements.map((x) => ({ amountCents: x.amount_cents, status: x.status })),
  })));
  const people = meId ? balancesByPerson(splits, meId) : { owedToMe: [], iOwe: [] };

  const myOpen = bills.filter((b) => b.mine && b.payer.id !== meId && b.mine.position.outstandingCents > 0);
  const nextDue = myOpen.filter((b) => b.due_date).sort((a, b) => a.due_date!.localeCompare(b.due_date!))[0];
  const attention = buildAttention(spaceId, bills, statements, meId, today);
  const upcoming = bills
    .filter((b) => (b.payer.id === meId ? b.outstandingCents > 0 : (b.mine?.position.outstandingCents ?? 0) > 0))
    .slice(0, 5);
  const firstName = profile?.display_name.split(" ")[0];
  const faces = (
    <Link href={`/s/${spaceId}/space`} className="mt-2 inline-flex items-center gap-2 text-[13px] text-muted hover:text-ink">
      <FacePile names={ctx.active.map((m) => (m.id === ctx.me?.id ? (profile?.display_name ?? m.name) : m.name))} size={26} />
      {ctx.active.length === 1 ? "Just you so far · invite people" : `${ctx.active.length} people`}
    </Link>
  );
  const actions = ctx.me ? <HomeActions spaceId={spaceId} address={`bills+${ctx.space.inbound_token}@${env.inboundDomain()}`} isOwner={ctx.me.role === "owner"} /> : null;
  const quick = ctx.me ? <QuickAdd spaceId={spaceId} today={today} members={ctx.active.map((m) => ({ id: m.id, name: m.name, isMe: m.id === ctx.me!.id }))} /> : null;

  if (bills.length === 0 && statements.length === 0) {
    return (
      <div className="space-y-8">
        <TopNotices notes={notes} claimed={claimed} />
        <header className="rise">
          <p className="text-[14px] text-muted">{greeting()}{firstName ? `, ${firstName}` : ""}</p>
          <h1 className="text-[clamp(30px,5vw,40px)] font-semibold tracking-[-0.04em] leading-tight">{ctx.space.name}</h1>
          {faces}
        </header>
        {quick}
        {actions}
        <div className="grid lg:grid-cols-[1.15fr_1fr] gap-6 items-start">
          <EmptyState
            title={`No ${preset.expenseNoun}s yet`}
            action={preset.autoBillsFirst ? (
              <><ButtonLink href={`/s/${spaceId}/auto-bills`}>Set up Auto Bills</ButtonLink><ButtonLink href={`/s/${spaceId}/bills/new`} variant="secondary">Add manually</ButtonLink></>
            ) : (
              <><ButtonLink href={`/s/${spaceId}/bills/new`}>Add an expense</ButtonLink><ButtonLink href={`/s/${spaceId}/auto-bills`} variant="secondary">Upload a statement</ButtonLink></>
            )}>
            {preset.autoBillsFirst
              ? "Upload a utility statement and we'll read the amount and due date, or enter a bill yourself. Everyone sees their share as soon as you save."
              : "Add what you paid and choose who shares it. Everyone sees exactly what they owe."}
          </EmptyState>
          <div className="space-y-4">
            {ctx.me?.role === "owner" && (
              <Card className="p-5">
                <p className="font-semibold">Coming from Splitwise?</p>
                <p className="text-[14px] text-muted mt-1">Screenshot your group balances and we'll bring them over. You check every number before anything is saved.</p>
                <ButtonLink href={`/import?from=${spaceId}`} variant="secondary" size="sm" className="mt-4">Import from Splitwise</ButtonLink>
              </Card>
            )}
            {ctx.active.length < 2 && ctx.me?.role === "owner" && (
              <Card className="p-5">
                <p className="font-semibold">Invite people</p>
                <p className="text-[14px] text-muted mt-1">Bills are more useful when everyone can see them. Send a private link from Space settings.</p>
                <ButtonLink href={`/s/${spaceId}/space#invite`} variant="secondary" size="sm" className="mt-4">Create invite link</ButtonLink>
              </Card>
            )}
            <figure className="rounded-[18px] ring-1 ring-dashed ring-line-strong p-5 bg-surface/50">
              <div className="flex items-center justify-between">
                <p className="text-[14px] font-medium">What a bill looks like</p>
                <Chip>Example only</Chip>
              </div>
              <div className="mt-4 flex items-end justify-between">
                <div><p className="text-[13px] text-muted">Electricity · ComEd</p><Money cents={4610} size="md" /><p className="text-[13px] text-muted">your share of $184.40</p></div>
                <Chip tone="warning">Due in 5 days</Chip>
              </div>
              <ShareBar className="mt-4" parts={[{ key: "a", cents: 1, state: "own" }, { key: "b", cents: 1, state: "paid" }, { key: "c", cents: 1, state: "pending" }, { key: "d", cents: 1, state: "open" }]} />
              <figcaption className="text-[12px] text-muted mt-3">Sample data. Not from your Space.</figcaption>
            </figure>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <TopNotices notes={notes} claimed={claimed} />
      <header className="flex items-end justify-between gap-4 rise">
        <div>
          <p className="text-[14px] text-muted">{greeting()}{firstName ? `, ${firstName}` : ""}</p>
          <h1 className="text-[clamp(28px,5vw,40px)] font-semibold tracking-[-0.04em] leading-tight">{ctx.space.name}</h1>
          {faces}
        </div>
        {attention.length > 0 && <a href="#attention" className="hidden sm:inline-flex"><Chip tone="warning">{attention.length} {attention.length === 1 ? "thing needs" : "things need"} you</Chip></a>}
      </header>

      {/* Signature: what you owe and what you're owed, side by side (section 21.1). */}
      <BalanceCards spaceId={spaceId} iOwe={people.iOwe} owedToMe={people.owedToMe}
        people={ctx.members.map((m) => ({ id: m.id, name: m.name }))} nextDueLabel={nextDue ? formatDate(nextDue.due_date) : undefined} />

      {quick}

      {actions}

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-10 lg:gap-8 items-start">
        <div className="space-y-10 min-w-0">
          {attention.length > 0 && (
            <section id="attention" aria-labelledby="att" className="rise-3">
              <SectionTitle id="att">Needs you</SectionTitle>
              <Card className="divide-y divide-line overflow-hidden">
                {attention.slice(0, 6).map((a) => (
                  <Link key={a.key} href={a.href} className="flex items-start gap-3.5 px-4 sm:px-5 py-4 hover:bg-sunken/60">
                    <span aria-hidden="true" className={cx("mt-1.5 size-2 rounded-full shrink-0", a.tone === "error" ? "bg-error" : a.tone === "warning" ? "bg-warning" : "bg-brand")} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[15px] font-medium">{a.title}</span>
                      <span className="block text-[14px] text-muted">{a.detail}</span>
                    </span>
                    <span className="text-[14px] font-medium text-brand-ink shrink-0 mt-0.5">{a.cta} →</span>
                  </Link>
                ))}
              </Card>
              {attention.length > 6 && <p className="text-[13px] text-muted mt-2">And {attention.length - 6} more on the Bills page.</p>}
            </section>
          )}

          <section aria-labelledby="up">
            <SectionTitle id="up" action={<Link href={`/s/${spaceId}/bills`} className="text-[14px] text-brand-ink hover:underline underline-offset-4">All bills</Link>}>Upcoming bills</SectionTitle>
            {upcoming.length ? (
              <Card className="divide-y divide-line overflow-hidden">{upcoming.map((b) => <BillRow key={b.id} bill={b} spaceId={spaceId} meId={meId} />)}</Card>
            ) : (
              <Card className="p-6 text-[15px] text-muted">Nothing open. When a new bill arrives, it shows up here with your share.</Card>
            )}
          </section>
        </div>

        <section aria-labelledby="recent" className="min-w-0">
          <SectionTitle id="recent" action={<Link href={`/s/${spaceId}/activity`} className="text-[14px] text-brand-ink hover:underline underline-offset-4">View all</Link>}>Recent activity</SectionTitle>
          <Card className="overflow-hidden">
            {activity.length ? <ActivityList items={activity} members={ctx.members} meUserId={ctx.userId} spaceId={spaceId} /> : <p className="p-5 text-muted text-[14px]">No activity yet.</p>}
          </Card>
        </section>
      </div>
    </div>
  );
}
