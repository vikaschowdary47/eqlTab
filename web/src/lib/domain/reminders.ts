import { splitPosition, type SplitLike } from "./balances";

export const DEFAULT_REMINDER_DAYS = [5, 2, 1];

/** Whole days from `today` to `due`, both as YYYY-MM-DD (UTC, so no time-zone drift). */
export function daysUntil(due: string, today: string): number {
  return Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

/**
 * Should this person get a due-date reminder today? Only when their own share is still open, they haven't
 * already reported paying it, they haven't opted out, and today is one of the days they picked.
 */
export function shouldSendDueReminder(i: { split: SplitLike; daysLeft: number; reminderDays: number[] | null; optOut: boolean }): boolean {
  if (i.optOut || i.daysLeft < 0) return false;
  const p = splitPosition(i.split);
  if (p.isPayerOwnShare || p.outstandingCents <= 0 || p.pendingCents >= p.outstandingCents) return false;
  return (i.reminderDays ?? DEFAULT_REMINDER_DAYS).includes(i.daysLeft);
}
