import { notFound } from "next/navigation";
import { BalanceCards } from "@/components/balance-cards";
import { QuickAdd } from "@/components/quick-add";
import { ReceiptSplit } from "@/components/receipt-split";
import { SpaceSwitcher } from "@/components/shell/nav";
import { GoogleButton, OrDivider } from "@/components/auth/forms";
import { FacePile } from "@/components/ui";
import type { Receipt } from "@/lib/domain/receipt";
import { BillSources } from "@/components/bill-sources";
import { sourceFromChoice, type BillSource } from "@/lib/domain/providers";

/** Development-only gallery of the section 19–21 screens with sample data. Not served in production. */
export default async function Preview({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { v = "dashboard" } = await searchParams;
  const sid = "00000000-0000-0000-0000-000000000001";
  const members = [
    { id: "me", name: "Vikas Chowdary", isMe: true }, { id: "raj", name: "Raj Kumar", isMe: false },
    { id: "ana", name: "Ana Lopez", isMe: false }, { id: "priya", name: "Priya Shah", isMe: false },
  ];
  const space = { id: sid, name: "Maple Apartment", typeLabel: "Shared Home", emoji: "🏠" };
  const receipt: Receipt = {
    store: "Patel Brothers", date: "2026-10-26", taxCents: 0, tipCents: 0, feesCents: 0, orderDiscountCents: 0, printedTotalCents: 23000,
    items: [["Mango pickle", 1800], ["Paneer 14oz", 700], ["Basmati rice 20lb", 3299], ["Atta 20lb", 2499], ["Toor dal 4lb", 899], ["Vegetables", 4103], ["Ghee 32oz", 2199], ["Spices", 1500], ["Snacks", 3401], ["Milk 2 gal", 2600]]
      .map(([label, c], i) => ({ id: `i${i}`, label: label as string, quantity: 1, amountCents: c as number, unsure: i === 5 })),
  };

  return (
    <main className="heikei-shell min-h-dvh px-4 sm:px-8 py-6">
      <div className="mx-auto max-w-[1080px] space-y-8">
        {v === "dashboard" && (
          <>
            <SpaceSwitcher current={space} spaces={[space, { id: "x", name: "Goa Trip", typeLabel: "Group", emoji: "🎒" }]} />
            <header>
              <p className="text-[14px] text-muted">Good afternoon, Vikas</p>
              <h1 className="text-[clamp(28px,5vw,40px)] font-semibold tracking-[-0.04em] leading-tight">Maple Apartment</h1>
              <span className="mt-2 inline-flex items-center gap-2 text-[13px] text-muted"><FacePile names={members.map((m) => m.name)} size={26} />4 people</span>
            </header>
            <BalanceCards spaceId={sid} people={members}
              iOwe={[{ memberId: "raj", netCents: 4610, pendingCents: 0 }]}
              owedToMe={[{ memberId: "ana", netCents: 5200, pendingCents: 2000 }, { memberId: "priya", netCents: 4025, pendingCents: 0 }, { memberId: "raj", netCents: 0, pendingCents: 0 }].filter((r) => r.netCents > 0)}
              nextDueLabel="Nov 3" />
            <QuickAdd spaceId={sid} today="2026-10-27" members={members} />
          </>
        )}
        {v === "settled" && <BalanceCards spaceId={sid} people={members} iOwe={[]} owedToMe={[]} />}
        {v === "receipt" && <ReceiptSplit spaceId={sid} today="2026-10-27" members={members} meId="me" isOwner initialReceipt={receipt} />}
        {v === "companies" && <div className="max-w-[920px]"><BillSources spaceId={sid} state={null} sources={[]} /></div>}
        {v === "companies-saved" && (
          <div className="max-w-[920px]">
            <BillSources spaceId={sid} state="IL" sources={[sourceFromChoice("IL", "electricity", { providerId: "comed" }), sourceFromChoice("IL", "gas", { providerId: "peoples-gas" }), sourceFromChoice("IL", "internet", { providerId: "xfinity" })].filter((x): x is BillSource => !!x)} />
          </div>
        )}
        {v === "login" && <div className="max-w-[400px]"><GoogleButton next="/home" /><OrDivider /></div>}
      </div>
    </main>
  );
}
