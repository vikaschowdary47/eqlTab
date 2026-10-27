"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cx } from "@/components/ui";

const ICONS = {
  home: <path d="M4 10.5 12 4l8 6.5V20h-5v-6h-6v6H4z" />,
  bills: <><rect x="5" y="3.5" width="14" height="17" rx="2.5" /><path d="M9 8.5h6M9 12h6M9 15.5h3.5" /></>,
  activity: <path d="M3.5 12h4l2.5-6 4 12 2.5-6h4" />,
  space: <><circle cx="9" cy="9" r="3" /><circle cx="17" cy="10" r="2.3" /><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5M15 14.2c2.6-.4 4.6 1.2 5.3 4.3" /></>,
};

export function navItems(spaceId: string) {
  return [
    { href: `/s/${spaceId}`, label: "Home", icon: ICONS.home, exact: true },
    { href: `/s/${spaceId}/bills`, label: "Bills", icon: ICONS.bills },
    { href: `/s/${spaceId}/activity`, label: "Activity", icon: ICONS.activity },
    { href: `/s/${spaceId}/space`, label: "Space", icon: ICONS.space },
  ];
}

function isActive(path: string, href: string, exact?: boolean) {
  return exact ? path === href : path === href || path.startsWith(href + "/") || (href.endsWith("/bills") && path.includes("/auto-bills"));
}

export function SideNav({ spaceId }: { spaceId: string }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="grid gap-0.5">
      {navItems(spaceId).map((i) => {
        const on = isActive(path, i.href, i.exact);
        return (
          <Link key={i.href} href={i.href} aria-current={on ? "page" : undefined}
            className={cx("group flex items-center gap-3 h-10 px-3 rounded-[10px] text-[15px] transition-colors",
              on ? "bg-brand-wash text-brand-ink font-semibold ring-1 ring-brand-strong/15 shadow-[0_1px_2px_rgba(33,58,50,0.05)]" : "text-ink-2 hover:text-ink hover:bg-surface/60")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={on ? 1.9 : 1.6} strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">{i.icon}</svg>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function TabBar({ spaceId }: { spaceId: string }) {
  const path = usePathname();
  const items = navItems(spaceId);
  const render = (i: (typeof items)[number]) => {
    const on = isActive(path, i.href, i.exact);
    return (
      <Link key={i.href} href={i.href} aria-current={on ? "page" : undefined}
        className={cx("flex-1 flex flex-col items-center justify-center gap-0.5 h-full text-[11px] transition-colors", on ? "text-brand-ink font-semibold" : "text-muted")}>
        <span className={cx("grid place-items-center h-7 w-12 rounded-full transition-colors duration-300", on && "bg-brand-wash")}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={on ? 2 : 1.6} strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">{i.icon}</svg>
        </span>
        {i.label}
      </Link>
    );
  };
  return (
    <nav aria-label="Main" className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-surface/90 backdrop-blur-xl border-t border-line pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch h-[62px] max-w-lg mx-auto px-2">
        {items.slice(0, 2).map(render)}
        <div className="flex-1 grid place-items-center"><AddMenu spaceId={spaceId} compact /></div>
        {items.slice(2).map(render)}
      </div>
    </nav>
  );
}

export function AddMenu({ spaceId, compact }: { spaceId: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);
  const items = [
    { href: `/s/${spaceId}/quick`, t: "Quick add", d: "Type it: groceries 230 split with all" },
    { href: `/s/${spaceId}/receipt`, t: "Scan a receipt", d: "Pick who had what, item by item" },
    { href: `/s/${spaceId}/bills/new`, t: "Expense or bill", d: "Enter an amount and split it" },
    { href: `/s/${spaceId}/auto-bills`, t: "Upload a statement", d: "We read it, you confirm it" },
    { href: `/import?from=${spaceId}`, t: "Import from Splitwise", d: "Bring balances over from screenshots" },
  ];
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((o) => !o)}
        className={cx("inline-flex items-center justify-center gap-2 font-semibold text-white bg-ink hover:bg-brand-ink transition-all duration-300 ease-out-soft active:scale-95",
          compact ? "size-12 rounded-[16px] shadow-[0_8px_20px_-8px_rgba(33,58,50,0.6)] ring-4 ring-brand-wash" : "h-11 w-full rounded-[12px] text-[15px]")}>
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className={cx("transition-transform duration-300", open && "rotate-45")}><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
        {compact ? <span className="sr-only">Add</span> : "Add"}
      </button>
      {open && (
        <div role="menu" className={cx("absolute z-40 w-[280px] rounded-[16px] bg-surface ring-1 ring-line shadow-[0_24px_60px_-20px_rgba(11,26,24,0.35)] p-1.5 rise",
          compact ? "bottom-[64px] left-1/2 -translate-x-1/2" : "top-[52px] left-0")}>
          {items.map((i) => (
            <Link key={i.href} role="menuitem" href={i.href} onClick={() => setOpen(false)} className="block rounded-[12px] px-3.5 py-3 hover:bg-sunken focus:bg-sunken">
              <span className="block text-[15px] font-medium">{i.t}</span>
              <span className="block text-[13px] text-muted">{i.d}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

type SpaceItem = { id: string; name: string; typeLabel: string; emoji: string };

/**
 * Section 20.2: the current Space is always obvious. A highlighted pill (shape + icon + name,
 * never colour alone) that opens the list of Spaces. Switching is 2 taps.
 */
export function SpaceSwitcher({ current, spaces }: { current: SpaceItem; spaces: SpaceItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);
  return (
    <div ref={ref} className="relative min-w-0">
      <button type="button" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((o) => !o)}
        className={cx("flex items-center gap-2.5 max-w-full min-w-0 rounded-full pl-1.5 pr-3.5 py-1.5 text-left transition-all",
          "bg-brand-wash ring-1 ring-brand-strong/25 shadow-[0_1px_2px_rgba(33,58,50,0.06)] hover:ring-brand-strong/50 active:scale-[0.98]",
          open && "ring-2 ring-brand-strong/60")}>
        <span className="grid place-items-center size-8 rounded-full bg-surface text-[17px] shrink-0 ring-1 ring-brand-strong/15" aria-hidden="true">{current.emoji}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold truncate leading-tight text-ink">{current.name}</span>
          <span className="block text-[11.5px] text-brand-ink leading-tight">{current.typeLabel} · tap to switch</span>
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true" className={cx("text-brand-ink shrink-0 transition-transform", open && "rotate-180")}><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        <span className="sr-only">Switch Space</span>
      </button>
      {open && (
        <div role="menu" className="absolute z-40 top-[56px] left-0 w-[min(320px,calc(100vw-32px))] rounded-[20px] bg-surface ring-1 ring-line shadow-[0_24px_60px_-20px_rgba(11,26,24,0.35)] p-1.5 rise">
          <p className="px-3 pt-2 pb-1 text-[12px] text-muted">Your Spaces</p>
          {spaces.map((s) => (
            <Link key={s.id} role="menuitem" href={`/s/${s.id}`} onClick={() => setOpen(false)} aria-current={s.id === current.id ? "true" : undefined}
              className={cx("flex items-center gap-3 rounded-[14px] px-3 py-2.5 hover:bg-sunken", s.id === current.id && "bg-brand-wash/60")}>
              <span className="grid place-items-center size-9 rounded-full bg-sunken text-[17px]" aria-hidden="true">{s.emoji}</span>
              <span className="flex-1 min-w-0"><span className="block text-[15px] font-medium truncate">{s.name}</span><span className="block text-[12px] text-muted">{s.typeLabel}</span></span>
              {s.id === current.id && <svg width="16" height="16" viewBox="0 0 24 24" aria-label="Current Space"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="var(--brand-strong)" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            </Link>
          ))}
          <div className="h-px bg-line my-1.5" />
          <Link role="menuitem" href="/onboarding" className="flex items-center gap-3 rounded-[14px] px-3 py-2.5 hover:bg-sunken text-[14px] font-medium">
            <span className="grid place-items-center size-9 rounded-full ring-1 ring-dashed ring-line-strong text-[16px]" aria-hidden="true">+</span>New Space or join with a link
          </Link>
        </div>
      )}
    </div>
  );
}
