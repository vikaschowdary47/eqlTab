import { ArtIcon, type ArtIconName } from "./icons";
import { Chip } from "./ui";
import type { DueState } from "@/lib/domain/due";
import { daysUntil, todayISO } from "@/lib/domain/due";
import type { SplitPosition } from "@/lib/domain/balances";
import type { Statement, UtilityStatus } from "@/lib/data";

export function DueChip({ state, dueDate }: { state: DueState; dueDate: string | null }) {
  if (state === "settled") return <Chip tone="success">Settled</Chip>;
  if (state === "overdue") return <Chip tone="error">Overdue</Chip>;
  if (state === "no_due_date") return <Chip>No due date</Chip>;
  if (state === "due_soon" && dueDate) {
    const d = daysUntil(dueDate, todayISO());
    return <Chip tone="warning">{d === 0 ? "Due today" : d === 1 ? "Due tomorrow" : `Due in ${d} days`}</Chip>;
  }
  return <Chip tone="brand">Upcoming</Chip>;
}

/** Status of one person's share, from anyone's point of view. */
export function ShareChip({ position, disputed }: { position: SplitPosition; disputed?: boolean }) {
  if (position.isPayerOwnShare) return <Chip>Paid upfront</Chip>;
  if (disputed || position.disputed) return <Chip tone="error">Disputed</Chip>;
  if (position.outstandingCents === 0) return <Chip tone="success">Confirmed received</Chip>;
  if (position.pendingCents > 0) return <Chip tone="warning">Payment reported</Chip>;
  if (position.confirmedCents > 0) return <Chip tone="brand">Partly paid</Chip>;
  return <Chip>Awaiting payment</Chip>;
}

export function UtilityChip({ status }: { status: UtilityStatus }) {
  if (status === "not_applicable") return null;
  if (status === "provider_verified") return <Chip tone="success">Provider confirmed paid</Chip>;
  if (status === "payment_reported") return <Chip tone="warning">Utility payment unverified</Chip>;
  return <Chip>Provider not yet paid</Chip>;
}

export const STATEMENT_LABEL: Record<Statement["status"], { label: string; tone: "neutral" | "brand" | "success" | "warning" | "error" }> = {
  ready: { label: "Ready to confirm", tone: "brand" },
  needs_review: { label: "Needs review", tone: "warning" },
  needs_statement: { label: "Statement details needed", tone: "warning" },
  duplicate: { label: "Duplicate", tone: "neutral" },
  failed: { label: "Couldn't read", tone: "error" },
  published: { label: "Shared as bill", tone: "success" },
  rejected: { label: "Dismissed", tone: "neutral" },
};

export function StatementChip({ status }: { status: Statement["status"] }) {
  const s = STATEMENT_LABEL[status];
  return <Chip tone={s.tone}>{s.label}</Chip>;
}

export const CATEGORY_LABEL: Record<string, string> = {
  electricity: "Electricity", gas: "Gas", water: "Water", internet: "Internet", rent: "Rent", phone: "Phone",
  groceries: "Groceries", travel: "Travel", dining: "Dining", other: "Other",
};

const CATEGORY_ART: Record<string, ArtIconName> = {
  electricity: "electricity", gas: "gas", water: "water", internet: "internet",
  rent: "house", travel: "trip", groceries: "receipt", dining: "receipt", phone: "internet", other: "receipt",
};

/** The v6.1 3D picture for a bill's category, on a soft tile. */
export function CategoryGlyph({ category, size = 40 }: { category: string; size?: number }) {
  return (
    <span className="grid place-items-center rounded-[12px] bg-surface shrink-0 ring-1 ring-line shadow-[0_1px_2px_rgba(26,25,24,.04)]" style={{ width: size, height: size }} aria-hidden="true">
      <ArtIcon name={CATEGORY_ART[category] ?? "receipt"} size={Math.round(size * 0.78)} />
    </span>
  );
}
