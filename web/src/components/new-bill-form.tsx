"use client";

import { Icon } from "./icons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { createBillAction, type BillInput } from "@/lib/actions";
import { formatUSD, parseDollars } from "@/lib/domain/money";
import type { SplitMethod } from "@/lib/domain/split";
import { CATEGORY_LABEL } from "./status";
import { SplitEditor, SplitPreview, useSplit, type SplitMember } from "./split-editor";
import { Button, Field, Input, Notice, Select, cx } from "./ui";
import { uuid } from "@/lib/uuid";
import { APP_NAME } from "@/lib/brand";

export function NewBillForm(props: {
  spaceId: string; spaceName: string; spaceEmoji: string; noun: string; defaultCategory: string; defaultMethod: SplitMethod; meId: string; isOwner: boolean; today: string; members: SplitMember[];
  initial?: { title?: string; amount?: string; category?: string; payer?: string; split?: { method: "equal" | "exact"; selected: string[]; amounts: Record<string, string> } | null };
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [title, setTitle] = useState(props.initial?.title ?? "");
  const [category, setCategory] = useState(props.initial?.category && props.initial.category in CATEGORY_LABEL ? props.initial.category : props.defaultCategory);
  const [amount, setAmount] = useState(props.initial?.amount ?? "");
  const [payer, setPayer] = useState(props.initial?.payer ?? props.meId);
  const [billDate, setBillDate] = useState(props.today);
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // One id per form: retries and double clicks can never create two bills
  const requestId = useRef(uuid());

  const cents = parseDollars(amount);
  const split = useSplit(props.members, cents, props.defaultMethod, props.initial?.split);
  const detailsErrors = {
    title: !title.trim() ? "Add a title" : null,
    amount: cents === null ? "Enter an amount like 184.40" : cents <= 0 ? "The amount must be more than $0.00" : null,
    due: dueDate && dueDate < billDate ? "The due date is before the bill date" : null,
  };
  const detailsOk = !detailsErrors.title && !detailsErrors.amount && !detailsErrors.due;

  function next() {
    setTouched(true);
    if (step === 1 && detailsOk && split.result?.ok) setStep(2);
  }

  function save() {
    if (!split.result?.ok || cents === null) return;
    setError(null);
    start(async () => {
      const r = await createBillAction({
        spaceId: props.spaceId, title, category: category as BillInput["category"], amountCents: cents, payerMemberId: payer, billDate, dueDate: dueDate || null, note,
        method: split.method, participants: split.inputs.map((i) => ({ memberId: i.memberId, value: i.value })), clientRequestId: requestId.current,
      });
      if (!r.ok) return setError(r.error);
      router.push(`/s/${props.spaceId}/bills/${r.data.id}?created=1`);
    });
  }

  const steps = ["Details and split", "Review"];
  const payerName = props.members.find((m) => m.id === payer);

  return (
    <div className="max-w-[1000px]">
      <div className="flex items-center justify-between mb-4">
        <Link href={`/s/${props.spaceId}/bills`} className="text-[14px] text-ink-2 hover:text-ink">← Cancel</Link>
        <ol className="flex items-center gap-2 text-[13px]" aria-label="Progress">
          {steps.map((s, i) => (
            <li key={s} aria-current={step === i + 1 ? "step" : undefined} className={cx("flex items-center gap-2", step === i + 1 ? "text-ink font-medium" : step > i + 1 ? "text-brand-ink" : "text-muted")}>
              <span className={cx("grid place-items-center size-6 rounded-full text-[12px] num", step === i + 1 ? "bg-ink text-white" : step > i + 1 ? "bg-brand-wash" : "bg-sunken")}>{step > i + 1 ? "✓" : i + 1}</span>
              <span className="hidden sm:inline">{s}</span>
            </li>
          ))}
        </ol>
      </div>
      <AddingTo name={props.spaceName} emoji={props.spaceEmoji} />
      <h1 className="text-[clamp(28px,5vw,38px)] font-semibold tracking-[-0.04em] leading-tight mb-5">Add {props.noun === "bill" ? "a bill" : "an expense"}</h1>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">
        <form className="space-y-4 min-w-0" onSubmit={(e) => { e.preventDefault(); if (step === 2) save(); else next(); }} noValidate>
          {error && <Notice tone="error" title={error} />}

          {step === 1 && (
            <div className="space-y-4 rise">
              <div>
                <label htmlFor="amount" className="block text-[13px] font-medium text-ink-2 mb-1">Total amount <span className="font-normal text-muted">· US dollars</span></label>
                <div className={cx("flex items-baseline gap-1 border-b-2 pb-1 transition-colors focus-within:border-brand-strong", touched && detailsErrors.amount ? "border-error" : "border-line-strong")}>
                  <span className="figure text-[30px] text-muted" aria-hidden="true">$</span>
                  <input id="amount" inputMode="decimal" autoComplete="off" autoFocus value={amount} placeholder="0.00"
                    aria-invalid={touched && !!detailsErrors.amount} aria-describedby="amount-error"
                    onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))}
                    className="figure text-[40px] w-full bg-transparent focus:outline-none placeholder:text-line-strong" />
                </div>
                {touched && detailsErrors.amount && <p id="amount-error" className="mt-1.5 text-[13px] text-error">{detailsErrors.amount}</p>}
              </div>
              <div className="grid sm:grid-cols-[1fr_200px] gap-3">
                <Field label="What is it?" htmlFor="title" error={touched ? detailsErrors.title : null}>
                  <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Electricity · October" aria-invalid={touched && !!detailsErrors.title} />
                </Field>
                <Field label="Category" htmlFor="category">
                  <Select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>
                    {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </Select>
                </Field>
              </div>
              <Field label="Who paid upfront?" htmlFor="payer" hint={props.isOwner ? undefined : "Members add bills they paid. The Space owner can add bills for anyone."}>
                <Select id="payer" value={payer} onChange={(e) => setPayer(e.target.value)} disabled={!props.isOwner}>
                  {props.members.map((m) => <option key={m.id} value={m.id}>{m.isMe ? `You (${m.name})` : m.name}</option>)}
                </Select>
              </Field>
              <div className="border-t border-line pt-4"><SplitEditor s={split} payerId={payer} /></div>
              <div className="border-t border-line pt-3">
                <button type="button" onClick={() => setMoreOpen((o) => !o)} aria-expanded={moreOpen || !!(touched && detailsErrors.due)} className="flex w-full items-center justify-between gap-3 text-[14px] text-ink-2 hover:text-ink">
                  <span className="truncate">Dates and note <span className="text-muted">· {billDate}{dueDate ? `, due ${dueDate}` : ", no due date"}</span></span>
                  <svg className={cx("shrink-0 text-muted transition-transform", (moreOpen || (touched && detailsErrors.due)) && "rotate-180")} width="12" height="8" viewBox="0 0 12 8" aria-hidden="true"><path d="M1 1.5l5 5 5-5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg>
                </button>
                {(moreOpen || (touched && detailsErrors.due)) && (
                  <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Bill date" htmlFor="billDate"><Input id="billDate" type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} /></Field>
                    <Field label="Due date (optional)" htmlFor="dueDate" error={touched ? detailsErrors.due : null}><Input id="dueDate" type="date" value={dueDate} min={billDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
                  </div>
                  <Field label="Note (optional)" htmlFor="note">
                    <textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2}
                      className="block w-full rounded-[12px] bg-surface p-3.5 text-[16px] ring-1 ring-inset ring-line-strong focus:outline-none focus:ring-2 focus:ring-brand-strong" placeholder="Account ending 7890, Sept usage" />
                  </Field>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 2 && split.result?.ok && cents !== null && (
            <div className="rise space-y-4">
              <dl className="rounded-[20px] ring-1 ring-line bg-surface divide-y divide-line">
                {[
                  ["What", title], ["Total", formatUSD(cents)], ["Paid upfront by", payerName?.isMe ? "You" : payerName?.name ?? ""],
                  ["Bill date", billDate], ["Due", dueDate || "No due date"], ["Split", { equal: "Equally", exact: "Exact amounts", percent: "Percentages" }[split.method]],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 px-5 py-3.5 text-[15px]"><dt className="text-muted">{k}</dt><dd className="font-medium text-right truncate">{v}</dd></div>
                ))}
              </dl>
              <p className="text-[14px] text-muted">When you save, everyone in this split can see the bill and their share. {APP_NAME} doesn't move money. People pay {payerName?.isMe ? "you" : payerName?.name.split(" ")[0]} however you usually do.</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            {step > 1 && <Button type="button" variant="secondary" size="lg" onClick={() => setStep(1)}>Back</Button>}
            <Button type="submit" size="lg" className="flex-1" loading={pending} disabled={step === 1 && cents !== null && cents > 0 && !split.result?.ok}>
              {step === 2 ? `Save ${props.noun}` : "Continue"}
            </Button>
          </div>
        </form>

        <aside className="lg:sticky lg:top-8" aria-label="Split preview">
          <SplitPreview s={split} payerId={payer} title={title} />
        </aside>
      </div>
    </div>
  );
}

/** Section 20.2: every add screen says which Space the bill goes to. The pill above changes it. */
export function AddingTo({ name }: { name: string; emoji?: string }) {
  return (
    <p className="inline-flex items-center gap-2 mb-3 h-8 pl-1.5 pr-3 rounded-full bg-sunken text-[13px] text-ink-2">
      <span aria-hidden="true" className="grid place-items-center size-6 rounded-full bg-surface text-ink-2"><Icon name="home" size={14} /></span>
      Adding to <strong className="font-semibold text-ink">{name}</strong>
    </p>
  );
}
