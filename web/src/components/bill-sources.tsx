"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveBillSourcesAction } from "@/lib/actions";
import { BILL_CATEGORIES, CATEGORY_COPY, OTHER_STATE, STATE_OPTIONS, STATES, providersFor, type BillCategory, type BillSource } from "@/lib/domain/providers";
import { Button, Notice, Select, cx, inputClass } from "./ui";

const SOMEONE_ELSE = "__other";
const NONE = "__none";

type Choice = { value: string; typed: string };

/**
 * "Who sends your bills?" (spec sections 17.2 and 21.4). Four plain questions: state, then the
 * electricity, gas and internet company. The Gmail scan only looks at mail from these.
 */
export function BillSources({ spaceId, state: savedState, sources }: { spaceId: string; state: string | null; sources: BillSource[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(sources.length === 0);
  const [state, setState] = useState(savedState ?? "");
  const [choices, setChoices] = useState<Record<BillCategory, Choice>>(() => initialChoices(sources));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const picked = useMemo(() => BILL_CATEGORIES.filter((c) => choices[c].value && choices[c].value !== NONE && (choices[c].value !== SOMEONE_ELSE || choices[c].typed.trim())), [choices]);

  function pickState(code: string) {
    setState(code);
    // Keep typed companies; reset picks that don't exist in the new state's list.
    setChoices((cur) => Object.fromEntries(BILL_CATEGORIES.map((c) => {
      const ch = cur[c];
      const still = ch.value === SOMEONE_ELSE || ch.value === NONE || providersFor(code, c).some((p) => p.id === ch.value);
      return [c, still ? ch : { value: "", typed: "" }];
    })) as Record<BillCategory, Choice>);
  }

  function save() {
    setError(null);
    if (!state) return setError("Pick your state first.");
    if (picked.length === 0) return setError("Pick at least one company, so we know which emails to look at.");
    start(async () => {
      const r = await saveBillSourcesAction(spaceId, state, picked.map((c) => ({
        category: c, providerId: choices[c].value === SOMEONE_ELSE ? null : choices[c].value, typed: choices[c].value === SOMEONE_ELSE ? choices[c].typed : null,
      })));
      if (!r.ok) return setError(r.error);
      setEditing(false);
      router.refresh();
    });
  }

  // ---------- saved: one calm line ----------
  if (!editing) {
    return (
      <div className="rounded-[20px] bg-surface ring-1 ring-line p-4 sm:p-5 flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-muted">We only look for bills from</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {sources.map((s) => (
              <li key={s.category} className="inline-flex items-center gap-1.5 h-9 pl-1.5 pr-3 rounded-full bg-brand-wash/70 ring-1 ring-brand-strong/15 text-[14px] font-medium">
                <span aria-hidden="true" className="grid place-items-center size-6 rounded-full bg-surface text-[13px]">{CATEGORY_COPY[s.category].emoji}</span>
                {s.name}
              </li>
            ))}
          </ul>
        </div>
        <button type="button" onClick={() => setEditing(true)} className="h-10 px-4 rounded-full text-[14px] font-medium text-ink-2 ring-1 ring-line-strong hover:bg-sunken">Change</button>
      </div>
    );
  }

  // ---------- picking ----------
  const note = STATES[state]?.note;
  return (
    <div className="rounded-[24px] bg-surface ring-1 ring-line shadow-[0_10px_32px_rgba(33,58,50,0.06)] overflow-hidden">
      <div className="px-5 sm:px-7 pt-6 pb-5 bg-[linear-gradient(135deg,var(--brand-wash),transparent_70%)]">
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-brand-ink">Step 1 of 2</p>
        <h2 className="mt-1.5 text-[22px] font-semibold tracking-[-0.02em]">Who sends your bills?</h2>
        <p className="mt-1 text-[15px] text-ink-2">We'll only look at emails from these companies. Nothing else in your inbox is opened.</p>
      </div>

      <div className="divide-y divide-line">
        <Row emoji="📍" label="Which state do you live in?" htmlFor="bs-state">
          <Select id="bs-state" value={state} onChange={(e) => pickState(e.target.value)} className={cx(!state && "text-muted")}>
            <option value="" disabled>Choose your state</option>
            {STATE_OPTIONS.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
            <option value={OTHER_STATE}>Another state</option>
          </Select>
        </Row>

        {BILL_CATEGORIES.map((c) => {
          const list = state ? providersFor(state, c) : [];
          const ch = choices[c];
          return (
            <Row key={c} emoji={CATEGORY_COPY[c].emoji} label={CATEGORY_COPY[c].question} htmlFor={`bs-${c}`} disabled={!state}
              hint={ch.value === NONE ? "We won't look for this one." : undefined}>
              <Select id={`bs-${c}`} disabled={!state} value={ch.value}
                onChange={(e) => setChoices((cur) => ({ ...cur, [c]: { value: e.target.value, typed: e.target.value === SOMEONE_ELSE ? cur[c].typed : "" } }))}
                className={cx("disabled:opacity-50", !ch.value && "text-muted")}>
                <option value="" disabled>{state ? "Choose a company" : "Pick your state first"}</option>
                {list.map((p) => <option key={p.id} value={p.id}>{p.name}{p.hint ? ` · ${p.hint}` : ""}</option>)}
                <option value={SOMEONE_ELSE}>Someone else…</option>
                <option value={NONE}>Not my bill (landlord pays / included in rent)</option>
              </Select>
              {ch.value === SOMEONE_ELSE && (
                <input autoFocus value={ch.typed} maxLength={60} placeholder="Company name on your bill"
                  onChange={(e) => setChoices((cur) => ({ ...cur, [c]: { value: SOMEONE_ELSE, typed: e.target.value } }))}
                  className={cx(inputClass, "mt-2")} aria-label={`${CATEGORY_COPY[c].label} company name`} />
              )}
            </Row>
          );
        })}
      </div>

      <div className="px-5 sm:px-7 py-5 bg-sunken/40 space-y-3">
        {note && <p className="text-[13px] text-ink-2">💡 {note}</p>}
        {error && <Notice tone="error" title={error} />}
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={save} loading={pending} disabled={!state || picked.length === 0} className="flex-1 sm:flex-none sm:min-w-[220px]">
            {picked.length ? `Look for ${picked.length} ${picked.length === 1 ? "bill" : "bills"}` : "Save"}
          </Button>
          {sources.length > 0 && <button type="button" onClick={() => setEditing(false)} className="text-[14px] text-ink-2 hover:text-ink">Cancel</button>}
        </div>
      </div>
    </div>
  );
}

function Row({ emoji, label, htmlFor, hint, disabled, children }: { emoji: string; label: string; htmlFor: string; hint?: string; disabled?: boolean; children: React.ReactNode }) {
  return (
    <div className={cx("px-5 sm:px-7 py-4 grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-x-6 gap-y-2 sm:items-center transition-opacity", disabled && "opacity-60")}>
      <label htmlFor={htmlFor} className="flex items-center gap-3 text-[15px] font-medium">
        <span aria-hidden="true" className="grid place-items-center size-10 shrink-0 rounded-[14px] bg-sunken text-[19px]">{emoji}</span>
        {label}
      </label>
      <div className="min-w-0">
        {children}
        {hint && <p className="mt-1.5 text-[13px] text-muted">{hint}</p>}
      </div>
    </div>
  );
}

function initialChoices(sources: BillSource[]): Record<BillCategory, Choice> {
  const out = { electricity: { value: "", typed: "" }, gas: { value: "", typed: "" }, internet: { value: "", typed: "" } } as Record<BillCategory, Choice>;
  for (const s of sources) out[s.category] = s.providerId ? { value: s.providerId, typed: "" } : { value: SOMEONE_ELSE, typed: s.name };
  return out;
}
