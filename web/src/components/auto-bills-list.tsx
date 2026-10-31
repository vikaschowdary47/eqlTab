"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { deleteStatementsAction } from "@/lib/actions";
import { formatDate } from "@/lib/domain/due";
import { formatUSD } from "@/lib/domain/money";
import type { Statement } from "@/lib/data";
import { StatementChip } from "./status";
import { Card } from "./ui";

const deletable = (status: Statement["status"]) => ["ready", "needs_review", "needs_statement", "failed", "duplicate"].includes(status);

export function AutoBillsList({ statements, spaceId }: { statements: Statement[]; spaceId: string }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const removable = useMemo(() => statements.filter((s) => deletable(s.status)), [statements]);
  const allSelected = removable.length > 0 && removable.every((s) => selected.includes(s.id));

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }

  function toggleAll() {
    setSelected(allSelected ? [] : removable.map((s) => s.id));
  }

  function removeSelected() {
    if (!selected.length || !window.confirm(`Delete ${selected.length} imported statement${selected.length === 1 ? "" : "s"} permanently? This cannot be undone.`)) return;
    setError(null);
    start(async () => {
      const result = await deleteStatementsAction(spaceId, selected);
      if (!result.ok) return setError(result.error);
      window.location.reload();
    });
  }

  return (
    <>
      {removable.length > 0 && <div className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] bg-surface/90 px-3.5 py-3 ring-1 ring-line shadow-[0_8px_24px_rgba(26,25,24,0.04)]">
        <label className="flex items-center gap-2.5 text-[14px] font-medium text-ink-2 cursor-pointer">
          <input className="size-4 accent-brand-strong" type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all deletable statements" />
          Select all
          {selected.length > 0 && <span className="text-[12px] font-normal text-muted">{selected.length} selected</span>}
        </label>
        <div className="flex items-center gap-3">
          {error && <p role="alert" className="text-[13px] text-error">{error}</p>}
          {selected.length > 0 && <button type="button" onClick={removeSelected} disabled={pending} className="h-10 px-4 rounded-[11px] bg-error-wash text-error text-[13px] font-semibold ring-1 ring-inset ring-error/15 transition-transform hover:-translate-y-0.5 disabled:opacity-50">
            {pending ? "Deleting…" : "Delete selected"}
          </button>}
        </div>
      </div>}
      <Card className="divide-y divide-line overflow-hidden shadow-[0_10px_32px_rgba(26,25,24,0.05)]">
        {statements.map((s) => {
          const canDelete = deletable(s.status);
          return <div key={s.id} className="grid grid-cols-[20px_minmax(0,1fr)] sm:grid-cols-[20px_minmax(0,1fr)_auto] items-start gap-3 px-4 sm:px-5 py-4 hover:bg-sunken/60">
            {canDelete ? <input className="mt-3.5 size-4 accent-brand-strong" type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} aria-label={`Select ${s.provider ?? "unrecognized statement"}`} /> : <span />}
            <Link href={`/s/${spaceId}/auto-bills/${s.id}`} className="group grid grid-cols-[44px_minmax(0,1fr)_auto] items-start gap-3 min-w-0">
              <span className="grid place-items-center size-11 rounded-[14px] bg-brand-wash ring-1 ring-brand-strong/15 text-[11px] font-bold tracking-[.08em] text-brand-ink transition-transform duration-200 group-hover:rotate-[-6deg] group-hover:scale-105" aria-hidden="true">{s.source === "email" ? "@" : s.parser_version?.startsWith("vision") ? "IMG" : "PDF"}</span>
              <div className="min-w-0 pt-0.5">
                <p className="text-[15px] font-semibold text-ink truncate">{s.provider ?? "Unrecognized provider"}</p>
                <p className="mt-1 text-[13px] leading-5 text-muted break-words">{s.amount_cents !== null ? formatUSD(s.amount_cents) : "Amount unknown"} <span aria-hidden="true">·</span> {s.due_date ? `due ${formatDate(s.due_date)}` : "due date unknown"} <span aria-hidden="true">·</span> {s.source === "email" ? "forwarded" : "uploaded"} {formatDate(s.received_at.slice(0, 10))}</p>
                <div className="mt-2 sm:hidden"><StatementChip status={s.status} /></div>
              </div>
              <div className="hidden sm:block"><StatementChip status={s.status} /></div>
            </Link>
          </div>;
        })}
      </Card>
    </>
  );
}
