import type { Metadata } from "next";
import { getSpaceContext } from "@/lib/data";
import { SPACE_EMOJI } from "@/lib/domain/spaces";
import { todayISO } from "@/lib/domain/due";
import { ReceiptSplit } from "@/components/receipt-split";
import { AddingTo } from "@/components/new-bill-form";
import { ButtonLink, EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "Scan a receipt" };

export default async function ReceiptPage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params;
  const ctx = (await getSpaceContext(spaceId))!;
  if (!ctx.me) return <EmptyState title="You can't add bills here" action={<ButtonLink href={`/s/${spaceId}`} variant="secondary">Back</ButtonLink>}>You're no longer an active member of this Space.</EmptyState>;
  return (
    <div className="space-y-6">
      <div>
        <AddingTo name={ctx.space.name} emoji={SPACE_EMOJI[ctx.space.type]} />
        <h1 className="text-[clamp(28px,5vw,38px)] font-semibold tracking-[-0.04em] leading-tight">Scan a receipt</h1>
      </div>
      <ReceiptSplit spaceId={spaceId} today={todayISO()} meId={ctx.me.id} isOwner={ctx.me.role === "owner"}
        members={ctx.active.map((m) => ({ id: m.id, name: m.name, isMe: m.id === ctx.me!.id }))} />
    </div>
  );
}
