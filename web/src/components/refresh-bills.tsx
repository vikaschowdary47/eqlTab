"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui";

/**
 * A Refresh button, plus a quiet check for new bills every 15 seconds while this tab is visible,
 * so a bill forwarded a moment ago shows up without reloading. Nothing runs when the tab is hidden.
 */
export function RefreshBills({ pollMs = 15_000 }: { pollMs?: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);

  const refresh = useCallback(() => {
    start(() => {
      router.refresh();
      setCheckedAt(new Date());
    });
  }, [router]);

  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") refresh(); };
    const id = setInterval(tick, pollMs);
    // Check right away when coming back to the tab (after copying the address, forwarding, and returning).
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", tick); };
  }, [refresh, pollMs]);

  return (
    <div className="flex items-center gap-3">
      {checkedAt && <span className="hidden sm:inline text-[12px] text-muted" aria-live="polite">Checked {checkedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>}
      <Button variant="secondary" size="sm" loading={pending} onClick={refresh}>Refresh</Button>
    </div>
  );
}
