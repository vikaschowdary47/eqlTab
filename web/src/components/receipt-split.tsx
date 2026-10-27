"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { createBillAction, scanReceiptAction } from "@/lib/actions";
import { formatUSD, parseDollars, centsToInput } from "@/lib/domain/money";
import { guessCategory, type QuickMember } from "@/lib/domain/quick-add";
import { computedTotal, extrasCents, receiptNote, reconcileDifference, splitReceipt, type ExtrasMode, type Receipt, type ReceiptItem } from "@/lib/domain/receipt";
import { FilePicker, type PickedFile } from "./upload/file-picker";
import { Avatar, Button, Notice, Spinner, cx } from "./ui";
import { uuid } from "@/lib/uuid";

/**
 * Section 19.3, one screen: everything starts shared by everyone; the user only touches exceptions.
 * Fast path: tap a person, then tap their items. The AI only read the receipt; the math is splitReceipt.
 */
export function ReceiptSplit({ spaceId, today, members, meId, isOwner, initialReceipt }: { spaceId: string; today: string; members: QuickMember[]; meId: string; isOwner: boolean; initialReceipt?: Receipt }) {
  const router = useRouter();
  const [files, setFiles] = useState<PickedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(initialReceipt ?? null);
  const [assign, setAssign] = useState<Record<string, string[]>>(() => Object.fromEntries((initialReceipt?.items ?? []).map((i) => [i.id, members.map((m) => m.id)])));
  const [focusPerson, setFocusPerson] = useState<string | null>(null);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [mode, setMode] = useState<ExtrasMode>("proportional");
  const [payer, setPayer] = useState(meId);
  const [showMath, setShowMath] = useState(false);
  const [reading, startReading] = useTransition();
  const [saving, startSaving] = useTransition();
  const requestId = useRef(uuid());

  const everyone = members.map((m) => m.id);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.name ?? "Someone";
  const short = (id: string) => (id === meId ? "You" : nameOf(id).split(" ")[0]);

  function read() {
    const f = files[0]?.file;
    if (!f) return;
    setError(null);
    startReading(async () => {
      const form = new FormData();
      form.set("receipt", f);
      const r = await scanReceiptAction(spaceId, form);
      if (!r.ok) return setError(r.error);
      setReceipt(r.data);
      setAssign(Object.fromEntries(r.data.items.map((i) => [i.id, [...everyone]])));
    });
  }

  function startBlank() {
    const blank: Receipt = { store: null, date: null, items: [{ id: "m0", label: "Item 1", quantity: 1, amountCents: 0, unsure: true }], taxCents: 0, tipCents: 0, feesCents: 0, orderDiscountCents: 0, printedTotalCents: null };
    setReceipt(blank);
    setAssign({ m0: [...everyone] });
  }

  const split = useMemo(() => (receipt ? splitReceipt(receipt, assign, everyone, mode) : null), [receipt, assign, mode, everyone.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const diff = receipt ? reconcileDifference(receipt) : null;

  function tapItem(item: ReceiptItem) {
    if (!focusPerson) return setOpenItem((o) => (o === item.id ? null : item.id));
    // Assign mode: first tap makes a shared item this person's; tapping again gives it back to everyone.
    setAssign((a) => {
      const cur = a[item.id] ?? [];
      const isEveryone = cur.length === everyone.length;
      let next: string[];
      if (isEveryone) next = [focusPerson];
      else if (cur.includes(focusPerson)) next = cur.filter((x) => x !== focusPerson);
      else next = everyone.filter((m) => cur.includes(m) || m === focusPerson);
      return { ...a, [item.id]: next.length ? next : [...everyone] };
    });
  }

  function togglePersonOnItem(itemId: string, memberId: string) {
    setAssign((a) => {
      const cur = a[itemId] ?? [];
      return { ...a, [itemId]: cur.includes(memberId) ? cur.filter((x) => x !== memberId) : everyone.filter((m) => cur.includes(m) || m === memberId) };
    });
  }

  function editItem(id: string, patch: Partial<ReceiptItem>) {
    setReceipt((r) => (r ? { ...r, items: r.items.map((i) => (i.id === id ? { ...i, ...patch, unsure: false } : i)) } : r));
  }

  function addLine() {
    const id = `m${Date.now()}`;
    setReceipt((r) => (r ? { ...r, items: [...r.items, { id, label: "Missing item", quantity: 1, amountCents: diff && diff > 0 ? diff : 0, unsure: true }] } : r));
    setAssign((a) => ({ ...a, [id]: [...everyone] }));
    setOpenItem(id);
  }

  function save() {
    if (!receipt || !split?.ok) return;
    setError(null);
    const title = receipt.store ? receipt.store : "Receipt";
    startSaving(async () => {
      const r = await createBillAction({
        spaceId, title: title.slice(0, 80), category: receipt.store ? (guessCategory(receipt.store) === "other" ? "groceries" : guessCategory(receipt.store)) : "groceries",
        amountCents: split.totalCents, payerMemberId: payer, billDate: receipt.date && receipt.date <= today ? receipt.date : today, dueDate: null,
        note: receiptNote(receipt, assign, nameOf, everyone.length), method: "exact",
        participants: split.shares.map((s) => ({ memberId: s.memberId, value: s.amountCents })), clientRequestId: requestId.current,
      });
      if (!r.ok) return setError(r.error);
      router.push(`/s/${spaceId}/bills/${r.data.id}?created=1`);
    });
  }

  // ---------- step 1: pick ----------
  if (!receipt) {
    return (
      <div className="space-y-4 max-w-[560px]">
        {reading ? (
          <div className="rounded-[20px] ring-1 ring-line bg-surface p-8 text-center">
            <Spinner />
            <p className="mt-3 text-[15px] font-medium">Reading every line…</p>
            <p className="text-[14px] text-muted">Usually a few seconds. The photo isn't stored.</p>
          </div>
        ) : (
          <>
            <FilePicker files={files} onChange={setFiles} onError={setError} kinds={["image"]} camera label="Receipt" hint="A photo or screenshot of the receipt or order. Up to 10 MB." />
            {files.length > 0 && <Button size="lg" full onClick={read}>Read receipt</Button>}
          </>
        )}
        {error && <Notice tone="error" title={error} action={<button type="button" onClick={startBlank} className="text-[14px] font-medium text-brand-ink underline underline-offset-4">Enter items by hand</button>} />}
        <p className="text-[13px] text-muted">We read the items. You pick who had what. Nothing is shared until you tap Save.</p>
      </div>
    );
  }

  // ---------- step 2: assign (one screen) ----------
  const extras = extrasCents(receipt);
  const blocked = split && !split.ok ? split.itemId : null;
  return (
    <div className="pb-40 lg:pb-0 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8 lg:items-start">
      <div className="min-w-0 space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] text-muted">{receipt.items.length} items{receipt.date ? ` · ${receipt.date}` : ""}</p>
            <h2 className="text-[22px] font-semibold tracking-[-0.02em] truncate">{receipt.store ?? "Your receipt"}</h2>
          </div>
          <span className="figure text-[32px] shrink-0">{formatUSD(computedTotal(receipt))}</span>
        </div>

        {diff !== null && diff !== 0 && (
          <Notice tone="warning" title={`Items don't add up to the receipt total (${formatUSD(Math.abs(diff))} ${diff > 0 ? "missing" : "extra"}).`}
            action={<button type="button" onClick={addLine} className="text-[14px] font-medium text-brand-ink underline underline-offset-4">{diff > 0 ? "Add the missing line" : "Check the highlighted lines"}</button>}>
            Check the highlighted lines, or tap a price to fix it. You can't save until it matches.
          </Notice>
        )}

        {/* People: tap someone, then tap their items */}
        <div className="sticky top-16 lg:top-4 z-20 -mx-4 px-4 py-2 bg-ground/90 backdrop-blur-xl lg:mx-0 lg:px-0 lg:rounded-[16px]">
          <p className="text-[13px] text-ink-2 mb-2">
            {focusPerson ? <>Now tap <strong>{short(focusPerson) === "You" ? "your" : `${short(focusPerson)}'s`}</strong> items. Tap them again to share with everyone.</> : <>Everything is shared by everyone. <strong>Tap a person, then tap their items.</strong></>}
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 -mb-1" role="radiogroup" aria-label="Assign items to">
            {members.map((m) => {
              const on = focusPerson === m.id;
              return (
                <button key={m.id} type="button" role="radio" aria-checked={on} onClick={() => { setFocusPerson(on ? null : m.id); setOpenItem(null); }}
                  className={cx("shrink-0 inline-flex items-center gap-2 h-11 pl-1 pr-4 rounded-full text-[14px] font-medium transition-all active:scale-95",
                    on ? "bg-ink text-white shadow-[0_6px_16px_-8px_rgba(33,58,50,.7)]" : "bg-surface ring-1 ring-line hover:ring-ink/30")}>
                  <Avatar name={m.name} size={34} />{m.isMe ? "You" : m.name.split(" ")[0]}
                </button>
              );
            })}
            {focusPerson && <button type="button" onClick={() => setFocusPerson(null)} className="shrink-0 h-11 px-4 rounded-full text-[14px] text-ink-2 hover:bg-sunken">Done</button>}
          </div>
        </div>

        <ul className="rounded-[20px] bg-surface ring-1 ring-line divide-y divide-line overflow-hidden">
          {receipt.items.map((item) => {
            const who = assign[item.id] ?? [];
            const shared = who.length === everyone.length;
            const mine = focusPerson ? who.includes(focusPerson) && !shared : false;
            const open = openItem === item.id;
            return (
              <li key={item.id} className={cx(item.unsure && "bg-warning-wash/50", blocked === item.id && "bg-error-wash/60", mine && "bg-brand-wash/70")}>
                <button type="button" onClick={() => tapItem(item)} aria-expanded={focusPerson ? undefined : open}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-sunken/70">
                  <span aria-hidden="true" className={cx("grid place-items-center size-6 rounded-full shrink-0 text-[12px] transition-colors",
                    mine ? "bg-ink text-white" : shared ? "bg-sunken text-muted" : "bg-brand-wash text-brand-ink")}>{mine ? "✓" : shared ? "=" : "•"}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15px] truncate">{item.label}{item.quantity > 1 ? <span className="text-muted"> ×{item.quantity}</span> : null}</span>
                    <span className="block text-[13px] text-muted truncate">
                      {item.unsure ? "Check this price · " : ""}{shared ? "Everyone" : who.length === 0 ? "Nobody picked" : `Only ${who.map(short).join(", ")}`}
                    </span>
                  </span>
                  {!shared && who.length > 0 && <span className="flex -space-x-2 shrink-0">{who.slice(0, 3).map((m) => <span key={m} className="ring-2 ring-surface rounded-full"><Avatar name={nameOf(m)} size={22} /></span>)}</span>}
                  <span className="num text-[15px] font-medium shrink-0">{formatUSD(item.amountCents)}</span>
                </button>
                {open && !focusPerson && (
                  <div className="px-4 pb-4 space-y-3 rise">
                    <div className="flex flex-wrap gap-2">
                      {members.map((m) => {
                        const on = who.includes(m.id);
                        return (
                          <button key={m.id} type="button" onClick={() => togglePersonOnItem(item.id, m.id)} aria-pressed={on}
                            className={cx("inline-flex items-center gap-1.5 h-9 pl-1 pr-3 rounded-full text-[14px]", on ? "bg-surface ring-2 ring-brand-strong/50" : "bg-sunken text-muted ring-1 ring-line")}>
                            <Avatar name={m.name} size={26} muted={!on} />{m.isMe ? "You" : m.name.split(" ")[0]}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[13px]">
                      <button type="button" className="h-8 px-3 rounded-full bg-sunken" onClick={() => setAssign((a) => ({ ...a, [item.id]: [...everyone] }))}>Everyone</button>
                      <button type="button" className="h-8 px-3 rounded-full bg-sunken" onClick={() => setAssign((a) => ({ ...a, [item.id]: [meId] }))}>Only me</button>
                      <label className="ml-auto flex items-center gap-1.5">
                        <span className="text-muted">Name</span>
                        <input defaultValue={item.label} maxLength={80} onBlur={(e) => editItem(item.id, { label: e.target.value.trim() || item.label })} className="h-8 w-32 rounded-[8px] bg-surface px-2 ring-1 ring-inset ring-line-strong focus:outline-none focus:ring-2 focus:ring-brand-strong" />
                      </label>
                      <label className="flex items-center gap-1.5">
                        <span className="text-muted">Price $</span>
                        <input inputMode="decimal" defaultValue={centsToInput(item.amountCents)} onBlur={(e) => { const c = parseDollars(e.target.value); if (c !== null) editItem(item.id, { amountCents: c }); }}
                          className="h-8 w-20 rounded-[8px] bg-surface px-2 ring-1 ring-inset ring-line-strong focus:outline-none focus:ring-2 focus:ring-brand-strong num" />
                      </label>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
          {extras !== 0 && (
            <li className="flex items-center gap-3 px-4 py-3 text-[14px] text-ink-2">
              <span aria-hidden="true" className="grid place-items-center size-6 rounded-full bg-sunken text-muted text-[12px]">+</span>
              <span className="flex-1">{[receipt.taxCents && "Tax", receipt.tipCents && "Tip", receipt.feesCents && "Fees", receipt.orderDiscountCents && "Discount"].filter(Boolean).join(", ")}</span>
              <span className="num">{extras < 0 ? "−" : ""}{formatUSD(Math.abs(extras))}</span>
            </li>
          )}
        </ul>
        <button type="button" onClick={addLine} className="text-[14px] text-brand-ink underline underline-offset-4">+ Add a line we missed</button>
      </div>

      {/* Live totals. Mobile: pinned to the bottom above the tab bar. Desktop: a side panel. */}
      <aside aria-label="Who pays what" className="fixed lg:sticky inset-x-0 bottom-[calc(62px+env(safe-area-inset-bottom))] lg:bottom-auto lg:top-8 z-30 lg:z-auto bg-surface/95 lg:bg-surface backdrop-blur-xl border-t lg:border-0 border-line lg:rounded-[20px] lg:ring-1 lg:ring-line p-4 lg:p-5">
        {split?.ok ? (
          <ul className="grid grid-cols-2 lg:grid-cols-1 gap-x-4 gap-y-1.5 lg:gap-y-2">
            {split.shares.map((s) => (
              <li key={s.memberId} className="min-w-0 flex items-center gap-2">
                <Avatar name={nameOf(s.memberId)} size={24} />
                <span className="text-[14px] flex-1 min-w-0 truncate">{short(s.memberId)}</span>
                <span className="num text-[15px] font-semibold">{formatUSD(s.amountCents)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[14px] text-error">{split && !split.ok ? split.error : ""}</p>
        )}

        {extras !== 0 && (
          <div className="mt-2 text-[12px] text-muted">
            <button type="button" className="underline underline-offset-2" onClick={() => setShowMath((v) => !v)}>How was this calculated?</button>
            {showMath && (
              <div className="mt-1.5 space-y-1.5">
                <p>Each item is split between the people picked for it. {formatUSD(Math.abs(extras))} of tax, tip, fees or discounts is shared {mode === "proportional" ? "by how much each person bought" : "equally"}.</p>
                <button type="button" className="underline underline-offset-2 text-brand-ink" onClick={() => setMode((m) => (m === "proportional" ? "equal" : "proportional"))}>
                  {mode === "proportional" ? "Split tax and fees equally instead" : "Split tax and fees by what people bought"}
                </button>
              </div>
            )}
          </div>
        )}

        {isOwner && (
          <label className="mt-3 flex items-center gap-2 text-[13px] text-ink-2">
            Paid by
            <select value={payer} onChange={(e) => setPayer(e.target.value)} className="h-8 rounded-[8px] bg-surface px-2 ring-1 ring-inset ring-line-strong text-[13px]">
              {members.map((m) => <option key={m.id} value={m.id}>{m.isMe ? "You" : m.name}</option>)}
            </select>
          </label>
        )}

        {error && <p role="alert" className="mt-2 text-[13px] text-error">{error}</p>}
        <div className="mt-3 flex items-center gap-3">
          <Button size="lg" className="flex-1" loading={saving} disabled={!split?.ok || (diff !== null && diff !== 0)} onClick={save}>
            Save{split?.ok ? ` · ${formatUSD(split.totalCents)}` : ""}
          </Button>
          <Link href={`/s/${spaceId}`} className="text-[14px] text-ink-2 hover:text-ink">Cancel</Link>
        </div>
      </aside>
    </div>
  );
}
