import Link from "next/link";
import { formatUSD } from "@/lib/domain/money";
import type { PersonBalance } from "@/lib/domain/balances";
import { Avatar, Money, cx } from "./ui";

interface Person { id: string; name: string }

/**
 * Section 21.1: "You owe" and "You're owed" side by side, same size and weight.
 * Each card lists the people behind its number, so nobody has to open another screen to see it.
 */
export function BalanceCards({ spaceId, iOwe, owedToMe, people, nextDueLabel }: {
  spaceId: string; iOwe: PersonBalance[]; owedToMe: PersonBalance[]; people: Person[]; nextDueLabel?: string;
}) {
  const name = (id: string) => people.find((p) => p.id === id)?.name ?? "Former member";
  const oweTotal = iOwe.reduce((a, r) => a + r.netCents, 0);
  const owedTotal = owedToMe.reduce((a, r) => a + r.netCents, 0);
  const net = owedTotal - oweTotal;
  const overall = oweTotal === 0 && owedTotal === 0
    ? "You're all settled up 🎉"
    : net > 0 ? `Overall, you'll get back ${formatUSD(net)}`
    : net < 0 ? `Overall, you owe ${formatUSD(-net)}`
    : "Overall, it evens out";

  if (oweTotal === 0 && owedTotal === 0) {
    return (
      <section aria-label="Your balance" className="rise-2 relative overflow-hidden rounded-[24px] bg-rind/60 ring-1 ring-[#c5df8a] p-6 sm:p-8">
        <Confetti />
        <p className="relative text-[14px] font-medium text-[#2f4a1c]">Your balance</p>
        <p className="relative mt-1 pr-14 text-[clamp(26px,5vw,34px)] font-semibold tracking-[-0.03em] text-ink">You're all settled up 🎉</p>
        <p className="relative mt-1 pr-14 text-[15px] text-ink-2">Nobody owes anybody. Enjoy it while it lasts.</p>
      </section>
    );
  }

  return (
    <section aria-label="Your balance" className="rise-2">
      <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
        <Side
          tone="owe" label="You owe" total={oweTotal} rows={iOwe} name={name}
          sub={oweTotal === 0 ? "Nothing right now" : `to ${count(iOwe.length)}${nextDueLabel ? ` · next due ${nextDueLabel}` : ""}`}
          href={`/s/${spaceId}/bills?f=upcoming`} cta="Record a payment" />
        <Side
          tone="owed" label="You're owed" total={owedTotal} rows={owedToMe} name={name}
          sub={owedTotal === 0 ? "Nobody owes you" : `from ${count(owedToMe.length)}`}
          href={`/s/${spaceId}/bills?f=upcoming`} cta="Remind people" />
      </div>
      <p className="mt-3 text-[15px] font-medium text-ink-2 text-center sm:text-left">{overall}</p>
    </section>
  );
}

function count(n: number) {
  return `${n} ${n === 1 ? "person" : "people"}`;
}

function Side({ tone, label, total, sub, rows, name, href, cta }: {
  tone: "owe" | "owed"; label: string; total: number; sub: string; rows: PersonBalance[]; name: (id: string) => string; href: string; cta: string;
}) {
  const dark = tone === "owe";
  const pending = rows.reduce((a, r) => a + r.pendingCents, 0);
  return (
    <div className={cx("relative overflow-hidden rounded-[22px] sm:rounded-[24px] p-4 sm:p-7 flex flex-col min-w-0",
      dark ? "bg-night text-white grain" : "bg-surface ring-1 ring-line")}>
      {dark && <div aria-hidden="true" className="absolute -right-20 -top-20 size-56 rounded-full bg-brand/30 blur-3xl" />}
      {!dark && <div aria-hidden="true" className="absolute -right-16 -top-16 size-48 rounded-full bg-rind/70 blur-3xl" />}
      <p className={cx("relative flex items-center gap-2 text-[14px] font-medium", dark ? "text-white/70" : "text-ink-2")}>
        <span aria-hidden="true" className={cx("grid place-items-center size-5 rounded-full text-[11px]", dark ? "bg-white/15" : "bg-success-wash text-success")}>{dark ? "↑" : "↓"}</span>
        {label}
      </p>
      <Money cents={total} size="fluid" className={cx("relative block mt-2", dark && "text-white")} />
      <p className={cx("relative mt-1.5 text-[13px] sm:text-[14px] leading-snug", dark ? "text-white/65" : "text-muted")}>{sub}</p>
      {pending > 0 && (
        <p className={cx("relative mt-1 text-[12px] sm:text-[13px] leading-snug", dark ? "text-brand" : "text-warning")}>
          {formatUSD(pending)} {dark ? "reported, waiting for confirmation" : "reported paid, waiting for you to confirm"}
        </p>
      )}

      {rows.length > 0 && (
        <ul className={cx("relative mt-3 sm:mt-5 divide-y", dark ? "divide-white/10" : "divide-line")}>
          {rows.slice(0, 4).map((r) => (
            <li key={r.memberId} className="flex items-center gap-2 sm:gap-2.5 py-2 sm:py-2.5">
              <Avatar name={name(r.memberId)} size={24} />
              <span className="flex-1 min-w-0 truncate text-[13px] sm:text-[14px]"><span className="sm:hidden">{name(r.memberId).split(" ")[0]}</span><span className="hidden sm:inline">{name(r.memberId)}</span></span>
              <span className="num text-[13px] sm:text-[14px] font-semibold">{formatUSD(r.netCents)}</span>
            </li>
          ))}
          {rows.length > 4 && <li className={cx("py-2 text-[13px]", dark ? "text-white/60" : "text-muted")}>and {rows.length - 4} more</li>}
        </ul>
      )}

      {rows.length > 0 && (
        <div className="relative mt-auto pt-4">
          <Link href={href} className={cx("text-[13px] sm:text-[14px] font-medium underline underline-offset-4", dark ? "text-white decoration-white/40 hover:decoration-white" : "text-brand-ink decoration-brand-strong/30 hover:decoration-brand-strong")}>
            {cta} →
          </Link>
        </div>
      )}
    </div>
  );
}

/** Watermelon seeds and flesh dots: decoration only. */
function Confetti() {
  const bits = [
    { l: "80%", t: "14%", r: 38, c: "var(--seed)", w: 9, h: 15 },
    { l: "88%", t: "48%", r: -24, c: "var(--brand)", w: 12, h: 12 },
    { l: "93%", t: "16%", r: 64, c: "var(--seed)", w: 7, h: 12 },
    { l: "84%", t: "76%", r: 12, c: "var(--brand-strong)", w: 8, h: 8 },
    { l: "95%", t: "70%", r: -50, c: "var(--seed)", w: 8, h: 13 },
  ];
  return (
    <span aria-hidden="true" className="absolute inset-0 pointer-events-none">
      {bits.map((b, i) => (
        <span key={i} className="absolute rise" style={{ left: b.l, top: b.t, width: b.w, height: b.h, background: b.c, opacity: b.c === "var(--seed)" ? 0.55 : 0.85, borderRadius: b.w === b.h ? "999px" : "80% 20% 80% 20%", transform: `rotate(${b.r}deg)`, animationDelay: `${i * 70}ms` }} />
      ))}
    </span>
  );
}
