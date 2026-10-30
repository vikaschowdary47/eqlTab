import type { Metadata } from "next";
import { getSpaceContext } from "@/lib/data";
import { SPACE_EMOJI } from "@/lib/domain/spaces";
import { todayISO } from "@/lib/domain/due";
import { QuickAdd } from "@/components/quick-add";
import { AddingTo } from "@/components/new-bill-form";
import { ButtonLink, EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Quick add" };

export default async function QuickAddPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const ctx = (await getSpaceContext(spaceId))!;
  if (!ctx.me) return <EmptyState title="You can't add bills here" action={<ButtonLink href={`/s/${spaceId}`} variant="secondary">Back</ButtonLink>}>You're no longer an active member of this Space.</EmptyState>;
  return (
    <div className="max-w-[720px] space-y-6">
      <div>
        <AddingTo name={ctx.space.name} emoji={SPACE_EMOJI[ctx.space.type]} />
        <h1 className="text-[clamp(28px,5vw,38px)] font-semibold tracking-[-0.04em] leading-tight">Quick add</h1>
        <p className="mt-2 text-[15px] text-muted">Type it the way you'd text your roommates. You check it before anything is saved.</p>
      </div>
      <QuickAdd spaceId={spaceId} today={todayISO()} members={ctx.active.map((m) => ({ id: m.id, name: m.name, isMe: m.id === ctx.me!.id }))} />
    </div>
  );
}
