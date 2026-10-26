"use client";

import { Button, EmptyState } from "@/components/ui";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-dvh grid place-items-center px-5">
      <EmptyState
        title="We couldn't finish loading this page"
        action={<Button onClick={reset}>Try again</Button>}
      >
        Your saved bills are safe. Check your connection and try again. If the problem continues, return to your Spaces and open the page again.
      </EmptyState>
    </main>
  );
}
