"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { deleteStatementAction, publishStatementAction, rejectStatementAction } from "@/lib/actions";
import { centsToInput, parseDollars } from "@/lib/domain/money";
import type { SplitMethod } from "@/lib/domain/split";
import { CATEGORY_LABEL } from "./status";
import { SplitEditor, SplitPreview, useSplit, type SplitMember } from "./split-editor";
import { Button, Field, Input, Notice, Select } from "./ui";
import { uuid } from "@/lib/uuid";

export function ReviewStatement(props: {
  spaceId: string; statementId: string;
  initial: { title: string; category: string; amount: number | null; dueDate: string | null; periodStart: string | null; periodEnd: string | null };
  revisionPayerId: string | null; defaultMethod: SplitMethod; meId: string; isOwner: boolean; members: SplitMember[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(props.initial.title);
  const [category, setCategory] = useState(props.initial.category);
  // Missing values stay empty: the person fills them from the statement, we never guess
  const [amount, setAmount] = useState(props.initial.amount !== null ? centsToInput(props.initial.amount) : "");
  const [due, setDue] = useState(props.initial.dueDate ?? "");
  const [ps, setPs] = useState(props.initial.periodStart ?? "");
  const [pe, setPe] = useState(props.initial.periodEnd ?? "");
  const [payer, setPayer] = useState(props.revisionPayerId ?? props.meId);
  const [error, setError] = useState<string | null>(null);
  const [confirmDismiss, setConfirmDismiss] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const reqId = useRef(uuid());
  const cents = parseDollars(amount);
  const split = useSplit(props.members, cents, props.defaultMethod);
  const detailsErrors = {
    title: !title.trim() ? "Add a title so everyone knows what this bill is." : null,
    amount: cents === null ? "Enter the amount due, for example 85.81." : cents <= 0 ? "The amount must be more than $0.00." : null,
    due: !due ? "Add the payment due date from the statement." : null,
  };
  const splitError = split.result && !split.result.ok ? split.result.error : null;
  const problems = [detailsErrors.title, detailsErrors.amount, detailsErrors.due, splitError].filter((x): x is string => !!x);
  const ready = problems.length === 0;

  function publish() {
    if (!ready || !cents) return;
    setError(null);
    start(async () => {
      const r = await publishStatementAction({
        spaceId: props.spaceId, statementId: props.statementId, title, category, amountCents: cents, payerMemberId: payer, dueDate: due,
        periodStart: ps || null, periodEnd: pe || null, method: split.method, participants: split.inputs, clientRequestId: reqId.current,
      });
      if (!r.ok) return setError(r.error);
      router.push(`/s/${props.spaceId}/bills/${r.data.billId}?created=1`);
    });
  }

  function dismiss() {
    start(async () => {
      const r = await rejectStatementAction(props.spaceId, props.statementId);
      if (!r.ok) return setError(r.error);
      router.push(`/s/${props.spaceId}/auto-bills`);
    });
  }

  function deleteStatement() {
    start(async () => {
      const r = await deleteStatementAction(props.spaceId, props.statementId);
      if (!r.ok) return setError(r.error);
      router.push(`/s/${props.spaceId}/auto-bills`);
    });
  }

  const flag = (v: string, original: unknown) => (original === null || original === undefined ? (v ? "Entered by you" : "Not on the statement. Enter it from the bill.") : undefined);

  return (
    <form className="space-y-8" onSubmit={(e) => { e.preventDefault(); publish(); }} noValidate>
      {error && <Notice tone="error" title={error} />}
      <section className="space-y-4">
        <h2 className="text-[17px] font-semibold tracking-[-0.01em]">Bill details</h2>
        <div className="grid sm:grid-cols-[1fr_200px] gap-4">
          <Field label="Title" htmlFor="r-title" error={detailsErrors.title}><Input id="r-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Electricity · ComEd" aria-invalid={!!detailsErrors.title} /></Field>
          <Field label="Category" htmlFor="r-cat"><Select id="r-cat" value={category} onChange={(e) => setCategory(e.target.value)}>{Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Amount due" htmlFor="r-amt" hint={!detailsErrors.amount ? flag(amount, props.initial.amount) : undefined} error={detailsErrors.amount}>
            <Input id="r-amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="0.00" aria-invalid={!!detailsErrors.amount} />
          </Field>
          <Field label="Due date" htmlFor="r-due" hint={!detailsErrors.due ? flag(due, props.initial.dueDate) : undefined} error={detailsErrors.due}><Input id="r-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} required aria-invalid={!!detailsErrors.due} /></Field>
          <Field label="Period start" htmlFor="r-ps"><Input id="r-ps" type="date" value={ps} onChange={(e) => setPs(e.target.value)} /></Field>
          <Field label="Period end" htmlFor="r-pe"><Input id="r-pe" type="date" value={pe} onChange={(e) => setPe(e.target.value)} /></Field>
        </div>
        <Field label="Who pays the provider?" htmlFor="r-payer" hint="They pay the provider, and everyone else pays them back.">
          <Select id="r-payer" value={payer} onChange={(e) => setPayer(e.target.value)} disabled={!props.isOwner || !!props.revisionPayerId}>
            {props.members.map((m) => <option key={m.id} value={m.id}>{m.isMe ? `You (${m.name})` : m.name}</option>)}
          </Select>
        </Field>
      </section>

      <section className="space-y-4">
        <h2 className="text-[17px] font-semibold tracking-[-0.01em]">Split</h2>
        <SplitEditor s={split} payerId={payer} />
        <SplitPreview s={split} payerId={payer} title={title} />
      </section>

      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2 border-t border-line">
        {confirmDismiss ? (
          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-[14px] text-ink-2">Dismiss without creating a bill?</span>
            <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmDismiss(false)}>No</Button>
            <Button type="button" size="sm" variant="danger" loading={pending} onClick={dismiss}>Dismiss</Button>
          </div>
        ) : <Button type="button" variant="ghost" size="lg" onClick={() => setConfirmDismiss(true)}>Dismiss</Button>}
        <Button type="submit" size="lg" className="sm:ml-auto sm:min-w-[220px]" loading={pending} disabled={!ready}>Confirm bill</Button>
      </div>
      {confirmDelete ? (
        <Notice tone="error" title="Delete this statement permanently?">
          This removes the imported statement and its uploaded file. It cannot be undone.
          <div className="mt-3 flex gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button type="button" size="sm" variant="danger" loading={pending} onClick={deleteStatement}>Delete permanently</Button>
          </div>
        </Notice>
      ) : <button type="button" className="text-[13px] text-error underline underline-offset-4" onClick={() => setConfirmDelete(true)}>Delete this statement permanently</button>}
      {!ready && <Notice tone="warning" title="Finish these items before confirming">
        <ul className="list-disc pl-5 space-y-1">
          {problems.map((problem) => <li key={problem}>{problem}</li>)}
        </ul>
      </Notice>}
    </form>
  );
}
