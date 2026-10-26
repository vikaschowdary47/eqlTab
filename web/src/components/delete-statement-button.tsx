"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteStatementAction } from "@/lib/actions";

export function DeleteStatementButton({ spaceId, statementId }: { spaceId: string; statementId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function remove() {
    if (!window.confirm("Delete this imported statement permanently? This cannot be undone.")) return;
    setError(null);
    start(async () => {
      const result = await deleteStatementAction(spaceId, statementId);
      if (!result.ok) return setError(result.error);
      router.refresh();
    });
  }

  return (
    <div className="shrink-0 text-right">
      <button type="button" onClick={remove} disabled={pending} className="text-[12px] text-error underline underline-offset-4 disabled:opacity-50">
        {pending ? "Deleting…" : "Delete"}
      </button>
      {error && <p role="alert" className="text-[11px] text-error mt-1 max-w-[140px]">{error}</p>}
    </div>
  );
}
