"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { createBillAction, quickAddAiAction, type BillInput } from "@/lib/actions";
import { formatUSD } from "@/lib/domain/money";
import { carriedSplitParams, hasSeveralAmounts, parseQuickAdd, resolveQuickAdd, type QuickDraft, type QuickMember } from "@/lib/domain/quick-add";
import { CATEGORY_LABEL } from "./status";
import { Avatar, Button, Notice, Spinner, cx } from "./ui";
import { uuid } from "@/lib/uuid";

const EXAMPLES = ["Indian grocery 230 divide among all", "wifi 65 split with Raj", "dinner 84.50 with everyone"];

/**
 * Section 19.2: type one line, check the draft, tap Save.
 * Common phrasings are read on the device (instant, free). Only unusual ones go to the AI.
 * The AI never does the math: resolveQuickAdd + splitBill do.
 */
export function QuickAdd({ spaceId, today, members, compact }: { spaceId: string; today: string; members: QuickMember[]; compact?: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [draft, setDraft] = useState<QuickDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [reading, startReading] = useTransition();
  const [saving, startSaving] = useTransition();
  const requestId = useRef(uuid());
  const inputRef = useRef<HTMLInputElement>(null);

  const resolved = useMemo(() => (draft ? resolveQuickAdd(draft, members) : null), [draft, members]);
  const name = (id: string) => members.find((m) => m.id === id);

  function read(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setSaved(null);
    const t = text.trim();
    if (!t) return inputRef.current?.focus();
    const local = parseQuickAdd(t);
    if (local && local.amount !== null) return setDraft(local);
    startReading(async () => {
      const r = await quickAddAiAction(spaceId, t);
      if (!r.ok) {
        // Fall back to what we could read on the device, so the user only fills the gap.
        if (local) return setDraft(local);
        return setError(r.error);
      }
      setDraft(r.data);
    });
  }

  function togglePerson(id: string) {
    if (!draft || !resolved?.ok) return;
    const current = resolved.participants.map((p) => p.memberId);
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    setDraft({ ...draft, participants: next.map((x) => `id:${x}`), fixedShares: [], groups: undefined });
  }

  function pickFor(unknownName: string, memberId: string) {
    if (!draft) return;
    const swap = (n: string) => (n === unknownName ? `id:${memberId}` : n);
    setDraft({
      ...draft,
      payer: swap(draft.payer),
      participants: draft.participants === "all" ? "all" : draft.participants.map(swap),
      fixedShares: draft.fixedShares.map((f) => ({ ...f, name: swap(f.name) })),
      groups: draft.groups?.map((g) => ({ ...g, people: g.people.map(swap) })),
    });
  }

  function save() {
    if (!resolved?.ok) return;
    setError(null);
    startSaving(async () => {
      const r = await createBillAction({
        spaceId, title: resolved.title, category: resolved.category as BillInput["category"], amountCents: resolved.amountCents,
        payerMemberId: resolved.payerMemberId, billDate: today, dueDate: null, note: "",
        method: resolved.method, participants: resolved.participants, clientRequestId: requestId.current,
      });
      if (!r.ok) return setError(r.error);
      requestId.current = uuid();
      setSaved(`${resolved.title} · ${formatUSD(resolved.amountCents)} saved`);
      setDraft(null);
      setText("");
      router.refresh();
    });
  }

  const editHref = resolved?.ok
    ? `/s/${spaceId}/bills/new?${new URLSearchParams({ title: resolved.title, amount: (resolved.amountCents / 100).toFixed(2), category: resolved.category, ...carriedSplitParams(resolved) })}`
    : `/s/${spaceId}/bills/new`;

  return (
    <section id="quick-add" aria-label="Quick add" className={cx("rounded-[22px] bg-surface ring-1 ring-line shadow-[0_1px_2px_rgba(11,26,24,0.04)]", compact ? "p-3 sm:p-4" : "p-4 sm:p-6")}>
      <form onSubmit={read} className="flex items-center gap-2">
        <label htmlFor="quick-text" className="sr-only">Type a bill</label>
        <span aria-hidden="true" className="grid place-items-center size-10 shrink-0 rounded-full bg-brand-wash text-brand-ink text-[18px]">✦</span>
        <input id="quick-text" ref={inputRef} value={text} maxLength={200} autoComplete="off" enterKeyHint="go"
          onChange={(e) => { setText(e.target.value); if (draft) setDraft(null); }}
          placeholder="groceries 230 split with all"
          className="flex-1 min-w-0 h-11 bg-transparent text-[16px] placeholder:text-muted/80 focus:outline-none" />
        {text.trim() ? (
          <Button type="submit" size="sm" loading={reading} className="h-10 rounded-full px-4">Go</Button>
        ) : (
          <Link href={`/s/${spaceId}/receipt`} className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-full bg-sunken text-[14px] font-medium text-ink-2 hover:bg-line/60 shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
            <span className="hidden min-[400px]:inline">Receipt</span><span className="sr-only min-[400px]:hidden">Scan a receipt</span>
          </Link>
        )}
      </form>

      {!draft && !error && !saved && !compact && (
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => { setText(ex); inputRef.current?.focus(); }}
              className="h-8 px-3 rounded-full bg-sunken text-[13px] text-ink-2 hover:bg-line/60">{ex}</button>
          ))}
        </div>
      )}

      {saved && <p role="status" className="mt-3 text-[14px] text-success font-medium">✓ {saved}. Everyone can see their share now.</p>}
      {error && <div className="mt-3"><Notice tone="error" title={error} /></div>}
      {reading && <p className="mt-3 flex items-center gap-2 text-[14px] text-muted"><Spinner /> Reading that…</p>}

      {draft && resolved && (
        <div className="mt-4 rounded-[18px] bg-ground ring-1 ring-line p-4 sm:p-5 rise">
          {!resolved.ok ? (
            <div className="space-y-3">
              <p className="text-[15px] font-semibold">{resolved.question}</p>
              {resolved.field === "amount" && (
                <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const v = new FormData(e.currentTarget).get("amt"); setDraft({ ...draft, amount: String(v ?? "").replace(/[$,\s]/g, "") || null }); }}>
                  <input name="amt" inputMode="decimal" autoFocus placeholder="0.00" className="h-11 w-36 rounded-[12px] bg-surface px-3 text-[16px] ring-1 ring-inset ring-line-strong focus:outline-none focus:ring-2 focus:ring-brand-strong" />
                  <Button type="submit" size="sm" className="h-11">Use amount</Button>
                </form>
              )}
              {resolved.unknownNames?.map((u) => (
                <div key={u}>
                  <p className="text-[13px] text-muted mb-1.5">Who is &ldquo;{u}&rdquo;?</p>
                  <div className="flex flex-wrap gap-2">
                    {members.map((m) => (
                      <button key={m.id} type="button" onClick={() => pickFor(u, m.id)} className="inline-flex items-center gap-2 h-9 pl-1 pr-3 rounded-full bg-surface ring-1 ring-line hover:ring-brand-strong/50 text-[14px]">
                        <Avatar name={m.name} size={26} />{m.isMe ? "You" : m.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {resolved.field === "people" && !resolved.unknownNames && (
                <button type="button" onClick={() => setDraft({ ...draft, participants: "all" })} className="text-[14px] text-brand-ink underline underline-offset-4">Split with everyone</button>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] text-muted">{CATEGORY_LABEL[resolved.category]} · paid by {name(resolved.payerMemberId)?.isMe ? "you" : name(resolved.payerMemberId)?.name}</p>
                  <p className="text-[18px] font-semibold tracking-[-0.01em] truncate">{resolved.title}</p>
                </div>
                <span className="figure text-[30px] shrink-0">{formatUSD(resolved.amountCents)}</span>
              </div>

              {resolved.method === "equal" && hasSeveralAmounts(text) && (
                <div className="mt-4"><Notice tone="warning" title="Check this split">You gave more than one amount, but this is an equal split. Look at each person's share before you save, or use Edit details.</Notice></div>
              )}
              <p className="mt-4 mb-2 text-[13px] text-muted">{resolved.method === "equal" ? "Split equally. Tap a person to add or remove them." : draft.groups?.length ? "Each part is split between the people you named. Check each person's total. Tapping a person switches to an equal split." : "Split as you described."}</p>
              <ul className="flex flex-wrap gap-2">
                {members.map((m) => {
                  const share = resolved.shares.find((s) => s.memberId === m.id);
                  return (
                    <li key={m.id}>
                      <button type="button" onClick={() => togglePerson(m.id)} aria-pressed={!!share}
                        className={cx("inline-flex items-center gap-2 h-10 pl-1 pr-3.5 rounded-full text-[14px] transition-all active:scale-95",
                          share ? "bg-surface ring-2 ring-brand-strong/50 shadow-sm" : "bg-sunken text-muted ring-1 ring-line line-through decoration-muted/50")}>
                        <Avatar name={m.name} size={30} muted={!share} />
                        <span className="font-medium">{m.isMe ? "You" : m.name.split(" ")[0]}</span>
                        {share && <span className="num text-ink-2">{formatUSD(share.amountCents)}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-5 flex items-center gap-3">
                <Button size="lg" className="flex-1 sm:flex-none sm:min-w-[180px]" loading={saving} onClick={save}>Save</Button>
                <Link href={editHref} className="text-[14px] text-ink-2 underline underline-offset-4 decoration-line-strong hover:text-ink">Edit details</Link>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
