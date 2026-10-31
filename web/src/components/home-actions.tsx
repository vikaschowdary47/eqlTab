import Link from "next/link";
import { ArtIcon, type ArtIconName } from "./icons";
import { CopyField } from "./copy-field";

/**
 * Every way to add something, visible on Home (no menus, no pop-ups).
 * The forwarding address leads, because forwarding a bill is the main way bills arrive.
 */
export function HomeActions({ spaceId, address, isOwner }: { spaceId: string; address: string; isOwner: boolean }) {
  const tiles: { href: string; t: string; d: string; art: ArtIconName }[] = [
    { href: `/s/${spaceId}/auto-bills#up`, t: "Upload a bill", d: "PDF or photo", art: "receipt" },
    { href: `/s/${spaceId}/receipt`, t: "Scan a receipt", d: "Split item by item", art: "receipt" },
    { href: `/s/${spaceId}/bills/new`, t: "Type it in", d: "Amount and who shares", art: "coin" },
    { href: `/s/${spaceId}/space#invite`, t: "Invite people", d: "Send a private link", art: "splitwise" },
    ...(isOwner ? [{ href: `/import?from=${spaceId}`, t: "From Splitwise", d: "Bring balances over", art: "newSpace" as const }] : []),
  ];
  return (
    <section aria-labelledby="add-h" className="rise-2">
      <h2 id="add-h" className="text-[17px] font-semibold tracking-[-0.01em] mb-3">Add a bill</h2>
      <div className="rounded-[20px] bg-surface ring-1 ring-line p-4 sm:p-5">
        <div className="flex items-start gap-3.5">
          <ArtIcon name="mail" size={44} className="shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">Forward a bill email</p>
            <p className="text-[13px] text-muted">Send ComEd, gas or internet emails here. You check each one before anyone sees it.</p>
          </div>
        </div>
        <div className="mt-3"><CopyField label="Your home's address" value={address} mono /></div>
        <Link href={`/s/${spaceId}/auto-bills#forwarding`} className="mt-2 inline-block text-[13px] font-medium text-brand-ink underline underline-offset-4 decoration-brand-strong/30 hover:decoration-brand-strong">
          Make it automatic every month
        </Link>
      </div>
      <ul className="mt-2.5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {tiles.map((i) => (
          <li key={i.t}>
            <Link href={i.href} className="flex h-full items-center gap-3 rounded-[16px] bg-surface ring-1 ring-line px-3 py-3 hover:ring-line-strong hover:bg-sunken/40 transition-colors">
              <ArtIcon name={i.art} size={34} className="shrink-0" />
              <span className="min-w-0"><span className="block text-[14px] font-medium leading-tight">{i.t}</span><span className="block text-[12px] text-muted leading-tight mt-0.5">{i.d}</span></span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
