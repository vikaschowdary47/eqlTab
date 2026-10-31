import { useId, type ReactNode } from "react";

/**
 * Icons from the Equal Tab v6.1 design.
 * Line icons are 24px strokes that follow the text colour. Art icons are the small 3D pictures
 * used for bill types and ways to add; they are decoration, so they are always aria-hidden.
 */

const LINE = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20h14V9.5" /><path d="M10 20v-6h4v6" /></>,
  bills: <><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" /><path d="M9 8h6M9 12h6M9 16h3" /></>,
  activity: <path d="M3 12h4l2.5-6 5 12 2.5-6H21" />,
  space: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7" /><path d="M18 14a6.5 6.5 0 0 1 3.5 6" /></>,
  mail: <><path d="M4 7l8 6 8-6" /><rect x="3" y="5" width="18" height="14" rx="2.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  back: <path d="M15 6 9 12l6 6" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="m5 12 5 5 9-10" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  warning: <><path d="M12 3 2 20h20z" /><path d="M12 10v4M12 17h.01" /></>,
  share: <><path d="M12 3v12" /><path d="m7 8 5-5 5 5" /><path d="M5 13v7h14v-7" /></>,
  camera: <><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
  upload: <><path d="M12 15V4" /><path d="m7 9 5-5 5 5" /><path d="M4 15v4h16v-4" /></>,
  external: <><path d="M14 4h6v6" /><path d="M20 4 10 14" /><path d="M18 14v6H4V6h6" /></>,
  copy: <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></>,
  signOut: <><path d="M14 4H6v16h8" /><path d="M10 12h10" /><path d="m17 9 3 3-3 3" /></>,
  person: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  trash: <><path d="M4 7h16M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13M9 7V4h6v3" /></>,
} satisfies Record<string, ReactNode>;

export type LineIconName = keyof typeof LINE;

export function Icon({ name, size = 20, strokeWidth = 1.7, className }: { name: LineIconName; size?: number; strokeWidth?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {LINE[name]}
    </svg>
  );
}

type U = (k: string) => string;
const ART = {
  gas: (u) => (<><defs><radialGradient id={u("sh")}><stop offset="0" stopColor="#6b1f33" stopOpacity=".30"/><stop offset="1" stopColor="#6b1f33" stopOpacity="0"/></radialGradient><linearGradient id={u("b")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFB347"/><stop offset="1" stopColor="#F0432B"/></linearGradient><linearGradient id={u("i")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFF2A0"/><stop offset="1" stopColor="#FFC13A"/></linearGradient></defs><ellipse cx="32" cy="57" rx="19" ry="3.6" fill={"url(#"+u("sh")+")"}/><path d="M32 5 C34 17 48 23 48 38 C48 48 41 56 32 56 C23 56 16 48 16 38 C16 30 22 26 24 18 C28 22 28 26 28 30 C30 24 30 14 32 5Z" fill={"url(#"+u("b")+")"}/><path d="M32 30 C33 36 40 38 40 45 C40 51 36 54 32 54 C28 54 24 51 24 45 C24 40 30 37 32 30Z" fill={"url(#"+u("i")+")"}/><path d="M21 38 Q22 32 26 28" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity=".5"/></>),
  electricity: (u) => (<><defs><radialGradient id={u("sh")}><stop offset="0" stopColor="#6b1f33" stopOpacity=".30"/><stop offset="1" stopColor="#6b1f33" stopOpacity="0"/></radialGradient><linearGradient id={u("b")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFE56B"/><stop offset="1" stopColor="#FFA21F"/></linearGradient></defs><ellipse cx="32" cy="57" rx="19" ry="3.6" fill={"url(#"+u("sh")+")"}/><path d="M37 5 L14 36 H29 L25 58 L50 25 H34 Z" fill={"url(#"+u("b")+")"} stroke="#FFB93A" strokeWidth="2" strokeLinejoin="round"/><path d="M36 10 L20 33" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity=".6"/></>),
  internet: (u) => (<><defs><radialGradient id={u("sh")}><stop offset="0" stopColor="#6b1f33" stopOpacity=".30"/><stop offset="1" stopColor="#6b1f33" stopOpacity="0"/></radialGradient><linearGradient id={u("b")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5BE0E8"/><stop offset="1" stopColor="#2F7FE0"/></linearGradient></defs><ellipse cx="32" cy="57" rx="19" ry="3.6" fill={"url(#"+u("sh")+")"}/><g fill="none" stroke={"url(#"+u("b")+")"} strokeWidth="6" strokeLinecap="round"><path d="M9 27 Q32 6 55 27"/><path d="M17 36 Q32 22 47 36"/><path d="M25 44.5 Q32 38 39 44.5"/></g><circle cx="32" cy="52" r="4.6" fill="#2F7FE0"/><circle cx="30.8" cy="50.6" r="1.4" fill="#fff" opacity=".6"/></>),
  water: (u) => (<><defs><radialGradient id={u("sh")}><stop offset="0" stopColor="#6b1f33" stopOpacity=".30"/><stop offset="1" stopColor="#6b1f33" stopOpacity="0"/></radialGradient><linearGradient id={u("b")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8FE3F5"/><stop offset="1" stopColor="#2F86E0"/></linearGradient></defs><ellipse cx="32" cy="57" rx="19" ry="3.6" fill={"url(#"+u("sh")+")"}/><path d="M32 6 C38 16 48 26 48 38 C48 48 41 55 32 55 C23 55 16 48 16 38 C16 26 26 16 32 6Z" fill={"url(#"+u("b")+")"}/><path d="M23 36 Q23 28 29 21" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".55"/></>),
  mail: (u) => (<><defs><radialGradient id={u("sh")}><stop offset="0" stopColor="#6b1f33" stopOpacity=".30"/><stop offset="1" stopColor="#6b1f33" stopOpacity="0"/></radialGradient><linearGradient id={u("b")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFFFFF"/><stop offset="1" stopColor="#FBE7E3"/></linearGradient><linearGradient id={u("f")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFC9BF"/><stop offset="1" stopColor="#F47A6A"/></linearGradient><radialGradient id={u("s")} cx="0.3" cy="0.2" r="1"><stop offset="0" stopColor="#FF9D8F"/><stop offset="1" stopColor="#D9473A"/></radialGradient></defs><ellipse cx="32" cy="57" rx="19" ry="3.6" fill={"url(#"+u("sh")+")"}/><g transform="rotate(-5 32 32)"><rect x="8" y="16" width="48" height="36" rx="8" fill={"url(#"+u("b")+")"}/><path d="M10 20 Q32 38 54 20" fill="none" stroke="#F6B8AD" strokeWidth="1.5"/><path d="M9 19 Q9 16 12 16 H52 Q55 16 55 19 L34.5 36 Q32 38 29.5 36 Z" fill={"url(#"+u("f")+")"}/><circle cx="32" cy="35" r="6" fill={"url(#"+u("s")+")"}/><ellipse cx="30" cy="33" rx="2" ry="1.3" fill="#fff" opacity=".6"/></g></>),
  receipt: (u) => (<><defs><radialGradient id={u("sh")}><stop offset="0" stopColor="#6b1f33" stopOpacity=".30"/><stop offset="1" stopColor="#6b1f33" stopOpacity="0"/></radialGradient><linearGradient id={u("p")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFFFFF"/><stop offset="1" stopColor="#F1E6E1"/></linearGradient><radialGradient id={u("a")} cx="0.3" cy="0.2" r="1"><stop offset="0" stopColor="#FF9D8F"/><stop offset="1" stopColor="#D9473A"/></radialGradient></defs><ellipse cx="32" cy="57" rx="19" ry="3.6" fill={"url(#"+u("sh")+")"}/><g transform="rotate(-6 32 32)"><path d="M16 8 H48 V52 L44 49 40 52 36 49 32 52 28 49 24 52 20 49 16 52 Z" fill={"url(#"+u("p")+")"}/><rect x="22" y="15" width="20" height="3.4" rx="1.7" fill="#D6C9C3"/><rect x="22" y="22" width="14" height="3.4" rx="1.7" fill="#E4D9D4"/><rect x="22" y="29" width="17" height="3.4" rx="1.7" fill="#E4D9D4"/><rect x="22" y="36" width="12" height="6" rx="3" fill={"url(#"+u("a")+")"}/><path d="M19 11 V40" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity=".7"/></g></>),
  coin: (u) => (<><defs><radialGradient id={u("sh")}><stop offset="0" stopColor="#6b1f33" stopOpacity=".30"/><stop offset="1" stopColor="#6b1f33" stopOpacity="0"/></radialGradient><radialGradient id={u("c")} cx="0.3" cy="0.25" r="1"><stop offset="0" stopColor="#FFE992"/><stop offset="0.5" stopColor="#F7B92E"/><stop offset="1" stopColor="#D68A0C"/></radialGradient></defs><ellipse cx="32" cy="57" rx="19" ry="3.6" fill={"url(#"+u("sh")+")"}/><circle cx="32" cy="36" r="22" fill="#C27E0A"/><circle cx="32" cy="32" r="22" fill={"url(#"+u("c")+")"}/><circle cx="32" cy="32" r="16.5" fill="none" stroke="#D68A0C" strokeWidth="1.6" opacity=".55"/><rect x="29.2" y="20" width="5.6" height="24" rx="2.8" fill="#B26F08"/><rect x="20" y="29.2" width="24" height="5.6" rx="2.8" fill="#B26F08"/><path d="M15 24 A19 19 0 0 1 28 13" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".55"/></>),
  splitwise: (u) => (<><defs><radialGradient id={u("sh")}><stop offset="0" stopColor="#6b1f33" stopOpacity=".30"/><stop offset="1" stopColor="#6b1f33" stopOpacity="0"/></radialGradient><radialGradient id={u("h")} cx="0.35" cy="0.25" r="1"><stop offset="0" stopColor="#FFE0CC"/><stop offset="1" stopColor="#F0A585"/></radialGradient><radialGradient id={u("g")} cx="0.3" cy="0.2" r="1"><stop offset="0" stopColor="#6AD19A"/><stop offset="1" stopColor="#238253"/></radialGradient><radialGradient id={u("p")} cx="0.3" cy="0.2" r="1"><stop offset="0" stopColor="#FF9DB1"/><stop offset="1" stopColor="#DC2D58"/></radialGradient><radialGradient id={u("c")} cx="0.3" cy="0.25" r="1"><stop offset="0" stopColor="#FFE992"/><stop offset="1" stopColor="#E09A12"/></radialGradient></defs><ellipse cx="32" cy="57" rx="19" ry="3.6" fill={"url(#"+u("sh")+")"}/><circle cx="44" cy="21" r="8" fill={"url(#"+u("h")+")"}/><path d="M31 50 Q31 32 44 32 Q57 32 57 50 Z" fill={"url(#"+u("g")+")"}/><circle cx="25" cy="24" r="9.5" fill={"url(#"+u("h")+")"}/><path d="M8 52 Q8 35 25 35 Q42 35 42 52 Z" fill={"url(#"+u("p")+")"}/><circle cx="51" cy="48" r="9" fill={"url(#"+u("c")+")"}/><rect x="50" y="43" width="2" height="10" rx="1" fill="#9A5E05"/><rect x="46" y="47" width="10" height="2" rx="1" fill="#9A5E05"/></>),
  house: (u) => (<><defs><radialGradient id={u("sh")}><stop offset="0" stopColor="#6b1f33" stopOpacity=".30"/><stop offset="1" stopColor="#6b1f33" stopOpacity="0"/></radialGradient><linearGradient id={u("w")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFF8EE"/><stop offset="1" stopColor="#F6DCC4"/></linearGradient><radialGradient id={u("r")} cx="0.3" cy="0.2" r="1"><stop offset="0" stopColor="#FF9DB1"/><stop offset="1" stopColor="#DC2D58"/></radialGradient><linearGradient id={u("d")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6AD19A"/><stop offset="1" stopColor="#238253"/></linearGradient></defs><ellipse cx="32" cy="57" rx="19" ry="3.6" fill={"url(#"+u("sh")+")"}/><rect x="12" y="28" width="40" height="27" rx="5" fill={"url(#"+u("w")+")"}/><path d="M5 31 L30 8 Q32 6.4 34 8 L59 31 Q60 33 58 33 H6 Q4 33 5 31Z" fill={"url(#"+u("r")+")"}/><rect x="27" y="40" width="10" height="15" rx="4" fill={"url(#"+u("d")+")"}/><rect x="16" y="38" width="7" height="7" rx="2" fill="#BFE6F5"/><rect x="41" y="38" width="7" height="7" rx="2" fill="#BFE6F5"/><path d="M14 18 L28 9" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity=".5" transform="translate(4 8)"/></>),
  trip: (u) => (<><defs><radialGradient id={u("sh")}><stop offset="0" stopColor="#6b1f33" stopOpacity=".30"/><stop offset="1" stopColor="#6b1f33" stopOpacity="0"/></radialGradient><linearGradient id={u("b")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F8D79F"/><stop offset="1" stopColor="#D79A58"/></linearGradient><linearGradient id={u("l")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#6AD19A"/><stop offset="1" stopColor="#238253"/></linearGradient></defs><ellipse cx="32" cy="57" rx="19" ry="3.6" fill={"url(#"+u("sh")+")"}/><path d="M24 24 Q24 12 32 12 Q40 12 40 24" fill="none" stroke="#B9803F" strokeWidth="2.4" strokeLinecap="round"/><path d="M26 22 Q22 8 14 8 Q14 20 26 22Z" fill={"url(#"+u("l")+")"}/><path d="M38 22 Q42 10 50 10 Q50 20 38 22Z" fill={"url(#"+u("l")+")"}/><path d="M13 24 H51 L48 55 Q48 56 46 56 H18 Q16 56 16 55 Z" fill={"url(#"+u("b")+")"}/><path d="M18 28 V50" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity=".5"/></>),
  newSpace: (u) => (<><defs><radialGradient id={u("sh")}><stop offset="0" stopColor="#6b1f33" stopOpacity=".30"/><stop offset="1" stopColor="#6b1f33" stopOpacity="0"/></radialGradient><radialGradient id={u("t")} cx="0.3" cy="0.2" r="1.1"><stop offset="0" stopColor="#FF9A8B"/><stop offset="0.55" stopColor="#F26B5B"/><stop offset="1" stopColor="#D6473A"/></radialGradient><radialGradient id={u("d")} cx="0.35" cy="0.2" r="1"><stop offset="0" stopColor="#FFFFFF"/><stop offset="1" stopColor="#FFE4DF"/></radialGradient><linearGradient id={u("b")} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#F47A6A"/><stop offset="1" stopColor="#E4503F"/></linearGradient></defs><ellipse cx="32" cy="57" rx="19" ry="3.6" fill={"url(#"+u("sh")+")"}/><rect x="6" y="6" width="52" height="52" rx="15" fill={"url(#"+u("t")+")"}/><circle cx="32" cy="32" r="19" fill={"url(#"+u("d")+")"}/><rect x="6" y="23" width="52" height="6.4" fill={"url(#"+u("b")+")"}/><rect x="6" y="35.6" width="52" height="6.4" fill={"url(#"+u("b")+")"}/><path d="M13 12 Q24 8 40 9" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".45"/></>),
} satisfies Record<string, (u: U) => ReactNode>;

export type ArtIconName = keyof typeof ART;

/** A small 3D picture. Gradient ids are unique per instance so several can share a page. */
export function ArtIcon({ name, size = 40, className }: { name: ArtIconName; size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  const u: U = (k) => `${id}${k}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className={className}>
      {ART[name](u)}
    </svg>
  );
}

/** Picks the art for a bill or utility from its kind or title. Falls back to a receipt. */
export function artForBill(kindOrTitle: string | null | undefined): ArtIconName {
  const t = (kindOrTitle ?? "").toLowerCase();
  if (/electric|power|comed|energy/.test(t)) return "electricity";
  if (/gas|heat|nicor|peoples/.test(t)) return "gas";
  if (/internet|wi-?fi|xfinity|comcast|spectrum|at&t|rcn|astound|broadband/.test(t)) return "internet";
  if (/water|sewer/.test(t)) return "water";
  return "receipt";
}
