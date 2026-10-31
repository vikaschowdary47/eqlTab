"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clearUtilityHolderAction, setUtilityHolderAction } from "@/lib/actions";
import { Button, Input, Notice, Select } from "./ui";
import { ArtIcon, Icon } from "./icons";

export const HOLDER_CATEGORIES = [
  { id: "electricity", label: "Electricity", emoji: "electricity" },
  { id: "gas", label: "Gas", emoji: "gas" },
  { id: "internet", label: "Internet", emoji: "internet" },
  { id: "water", label: "Water", emoji: "water" },
  { id: "trash", label: "Trash", emoji: "trash" },
] as const;

export type HolderRow = { category: string; memberId: string | null; name: string | null; last4: string | null };
type MemberOption = { id: string; name: string };

const OUTSIDE = "__outside";

/**
 * "Whose name is each utility in?" Visible to everyone in the Space, so people know who to ask and
 * who to reimburse. Records only: no account numbers beyond the last 4 digits, and no payments.
 */
export function UtilityHolders({ spaceId, members, holders }: { spaceId: string; members: MemberOption[]; holders: HolderRow[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div>
      <ul className="divide-y divide-line">
        {HOLDER_CATEGORIES.map((c) => {
          const row = holders.find((h) => h.category === c.id) ?? null;
          return (
            <li key={c.id} className="py-3 first:pt-0 last:pb-0">
              {editing === c.id ? (
                <HolderEditor spaceId={spaceId} category={c.id} label={c.label} members={members} row={row} onDone={() => setEditing(null)} />
              ) : (
                <HolderLine emoji={c.emoji} label={c.label} row={row} members={members} onEdit={() => setEditing(c.id)} />
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-[13px] text-muted mt-4">Everyone in this Space can see this. We keep only the last 4 digits of an account number, never the full number.</p>
    </div>
  );
}

function HolderLine({ emoji, label, row, members, onEdit }: { emoji: string; label: string; row: HolderRow | null; members: MemberOption[]; onEdit: () => void }) {
  const member = row?.memberId ? members.find((m) => m.id === row.memberId) : null;
  const who = row ? (member?.name ?? row.name ?? "Someone who left this Space") : null;
  return (
    <div className="flex items-center gap-3">
      <span className="grid place-items-center size-10 shrink-0 rounded-[12px] bg-surface ring-1 ring-line" aria-hidden="true">{emoji === "trash" ? <Icon name="trash" size={20} className="text-ink-2" /> : <ArtIcon name={emoji as "electricity" | "gas" | "internet" | "water"} size={30} />}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-muted">{label}</p>
        <p className="text-[15px] font-medium truncate">
          {who ? <>In {who}&rsquo;s name{row?.last4 ? <span className="text-muted font-normal"> · account ends {row.last4}</span> : null}</> : <span className="text-muted font-normal">Not set yet</span>}
        </p>
        {row && row.memberId && !member && <p className="text-[13px] text-warning">This person is no longer in the Space. Pick who holds it now.</p>}
      </div>
      <Button variant="secondary" size="sm" onClick={onEdit}>{row ? "Change" : "Set"}</Button>
    </div>
  );
}

function HolderEditor({ spaceId, category, label, members, row, onDone }: { spaceId: string; category: string; label: string; members: MemberOption[]; row: HolderRow | null; onDone: () => void }) {
  const router = useRouter();
  const startsOutside = !!row && !row.memberId && !!row.name;
  const [who, setWho] = useState<string>(startsOutside ? OUTSIDE : row?.memberId && members.some((m) => m.id === row.memberId) ? row.memberId : "");
  const [outside, setOutside] = useState(row?.name ?? "");
  const [last4, setLast4] = useState(row?.last4 ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    if (!who) return setError("Pick whose name it is in.");
    if (who === OUTSIDE && !outside.trim()) return setError("Type the person's name.");
    if (last4 && !/^[0-9]{4}$/.test(last4)) return setError("Account digits should be exactly 4 numbers, or leave it empty.");
    start(async () => {
      const r = await setUtilityHolderAction(spaceId, category, who === OUTSIDE ? { name: outside.trim() } : { memberId: who }, last4 || null);
      if (!r.ok) return setError(r.error);
      onDone();
      router.refresh();
    });
  }

  function clear() {
    setError(null);
    start(async () => {
      const r = await clearUtilityHolderAction(spaceId, category);
      if (!r.ok) return setError(r.error);
      onDone();
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <p className="text-[15px] font-medium">Whose name is the {label.toLowerCase()} account in?</p>
      <Select aria-label={`${label} account holder`} value={who} onChange={(e) => setWho(e.target.value)}>
        <option value="">Choose…</option>
        {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        <option value={OUTSIDE}>Someone outside this Space (landlord, former roommate)…</option>
      </Select>
      {who === OUTSIDE && <Input aria-label="Their name" placeholder="Their name" maxLength={60} value={outside} onChange={(e) => setOutside(e.target.value)} />}
      <Input aria-label="Last 4 digits of the account number (optional)" placeholder="Last 4 digits of the account number (optional)" inputMode="numeric" maxLength={4} value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, ""))} />
      {error && <Notice tone="error" title={error} />}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" loading={pending} onClick={save}>Save</Button>
        <Button size="sm" variant="secondary" disabled={pending} onClick={onDone}>Cancel</Button>
        {row && <Button size="sm" variant="secondary" disabled={pending} onClick={clear}>Clear</Button>}
      </div>
    </div>
  );
}
