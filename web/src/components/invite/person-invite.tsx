"use client";

import { useEffect, useState } from "react";
import { emailInviteAction, type Result } from "@/lib/actions";
import { Button, Field, Input, Notice, cx } from "@/components/ui";
import { APP_NAME } from "@/lib/brand";

/** "Join me on eqlTab for 12 elm street and Lakeview". 2-person Spaces read as "our balance". */
export function inviteMessage(spaceNames: string[]): string {
  const groups = spaceNames.filter((n) => !/^you & /i.test(n));
  const parts = [...groups, ...(groups.length < spaceNames.length ? ["our balance"] : [])];
  const list = parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
  return list ? `Join me on ${APP_NAME} for ${list}` : `Join me on ${APP_NAME}`;
}

/** Clipboard API needs https; fall back to a hidden textarea so Copy works on http too. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

/**
 * One person's personal invite. The link is created on the first tap, then shared from a
 * second tap so the share sheet opens from a fresh user gesture (Safari requires it).
 * Phone and email live only in memory, to address the text or email.
 */
export function PersonInvite({ name, spaceNames, url, onCreate, contact }: {
  name: string;
  spaceNames: string[];
  url: string | null;
  onCreate: () => Promise<Result<{ url: string }>>;
  contact?: { phone?: string; email?: string };
}) {
  const [link, setLink] = useState(url);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  // How to reach them is typed here when it isn't already known. It stays in this tab's memory only: never stored.
  const [ask, setAsk] = useState<"phone" | "email" | null>(null);
  const [typed, setTyped] = useState({ phone: contact?.phone ?? "", email: contact?.email ?? "" });
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  useEffect(() => { setLink(url); }, [url]);
  useEffect(() => { setCanShare(typeof navigator.share === "function"); }, []);
  const text = inviteMessage(spaceNames);

  async function create() {
    setBusy(true); setError(null);
    const r = await onCreate();
    setBusy(false);
    if (!r.ok) return setError(r.error);
    setLink(r.data.url);
  }
  async function share() {
    try {
      await navigator.share({ title: APP_NAME, text, url: link! });
    } catch (e) {
      if ((e as Error).name !== "AbortError") await copy();
    }
  }
  async function sendEmail() {
    setSending(true); setSendError(null); setSentTo(null);
    const r = await emailInviteAction(link!, typed.email);
    setSending(false);
    if (!r.ok) return setSendError(r.error);
    setSentTo(typed.email.trim());
  }
  async function copy() {
    setCopied(await copyText(`${text}: ${link}`));
    setTimeout(() => setCopied(false), 1800);
  }

  if (!link) return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="secondary" loading={busy} onClick={create}>Invite</Button>
      {error && <p className="text-[12px] text-error max-w-[220px] text-right">{error}</p>}
    </div>
  );
  const body = `${text}: ${link}`;
  const smsHref = `sms:${typed.phone.replace(/[^\d+]/g, "")}${/iP(hone|ad)/.test(navigator.userAgent) ? "&" : "?"}body=${encodeURIComponent(body)}`;
  const mailHref = `mailto:${encodeURIComponent(typed.email.trim())}?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(body)}`;
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {canShare && <Button size="sm" onClick={share}>Share</Button>}
      <Button size="sm" variant={canShare ? "secondary" : "primary"} onClick={copy} aria-live="polite">{copied ? "Copied" : "Copy link"}</Button>
      <Button size="sm" variant="secondary" aria-pressed={ask === "phone"} onClick={() => setAsk(ask === "phone" ? null : "phone")}>Text</Button>
      <Button size="sm" variant="secondary" aria-pressed={ask === "email"} onClick={() => setAsk(ask === "email" ? null : "email")}>Email</Button>
      <span className="sr-only">Personal link for {name}</span>
      {ask === "phone" && (
        <div className="w-full flex flex-wrap items-center justify-end gap-2">
          <Input aria-label={`${name}'s phone number`} type="tel" inputMode="tel" autoComplete="off" placeholder={`${name}'s phone number`} className="max-w-[220px]" value={typed.phone} onChange={(e) => setTyped({ ...typed, phone: e.target.value })} />
          {typed.phone.replace(/\D/g, "").length >= 7 ? <a className={pill} href={smsHref}>Open Messages</a> : <span className="text-[12px] text-muted">Opens your Messages app with the invite ready to send.</span>}
        </div>
      )}
      {ask === "email" && (
        <div className="w-full flex flex-wrap items-center justify-end gap-2">
          <Input aria-label={`${name}'s email address`} type="email" autoComplete="off" placeholder={`${name}'s email`} className="max-w-[240px]" value={typed.email} onChange={(e) => { setTyped({ ...typed, email: e.target.value }); setSentTo(null); }} />
          {/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(typed.email.trim()) && (
            <>
              <Button size="sm" loading={sending} onClick={sendEmail}>Send for me</Button>
              <a className={pill} href={mailHref}>Open my email app</a>
            </>
          )}
          {sentTo && <p role="status" className="w-full text-right text-[12px] text-success">Sent to {sentTo}. We don't keep the address.</p>}
          {sendError && <p role="alert" className="w-full text-right text-[12px] text-error">{sendError}</p>}
        </div>
      )}
    </div>
  );
}
const pill = "inline-flex items-center h-9 px-3.5 rounded-[10px] text-[14px] font-medium ring-1 ring-inset ring-line-strong bg-surface hover:bg-sunken";

type ContactsManager = { select: (props: string[], opts: { multiple: boolean }) => Promise<{ name?: string[]; tel?: string[]; email?: string[] }[]> };

/**
 * "Add someone new": only a name is needed. On browsers with the Contact Picker (Android Chrome)
 * the name can come from contacts. Phone and email are optional, never uploaded or stored:
 * they're only handed back to address the invite.
 */
export function AddPersonForm({ onAdd, onCancel, submitLabel = "Add" }: {
  onAdd: (name: string, contact: { phone?: string; email?: string }) => Promise<string | null>;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  useEffect(() => { setPicker("contacts" in navigator && "ContactsManager" in window); }, []);

  async function pick() {
    try {
      const props = more ? ["name", "tel", "email"] : ["name"];
      const [c] = await (navigator as unknown as { contacts: ContactsManager }).contacts.select(props, { multiple: false });
      if (!c) return;
      if (c.name?.[0]) setName(c.name[0].slice(0, 80));
      if (more && c.tel?.[0]) setPhone(c.tel[0]);
      if (more && c.email?.[0]) setEmail(c.email[0]);
    } catch {
      // closed the picker or permission denied: nothing to do
    }
  }

  return (
    <form className="space-y-3" onSubmit={async (e) => {
      e.preventDefault();
      if (!name.trim()) return setError("Add a name.");
      setBusy(true); setError(null);
      const err = await onAdd(name.trim(), { phone: phone.trim() || undefined, email: email.trim() || undefined });
      setBusy(false);
      if (err) setError(err);
    }}>
      {error && <Notice tone="error" title={error} />}
      <Field label="Name" htmlFor="new-person"><Input id="new-person" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="off" placeholder="e.g. Alex" /></Field>
      <div className="flex flex-wrap gap-2">
        {picker && <Button type="button" size="sm" variant="secondary" onClick={pick}>Pick from contacts</Button>}
        <button type="button" className="text-[14px] text-ink-2 underline underline-offset-4" onClick={() => setMore((m) => !m)} aria-expanded={more}>
          {more ? "Hide phone and email" : "Add phone or email (optional)"}
        </button>
      </div>
      {more && (
        <div className={cx("grid gap-3 sm:grid-cols-2")}>
          <Field label="Phone" htmlFor="new-phone"><Input id="new-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="off" /></Field>
          <Field label="Email" htmlFor="new-email"><Input id="new-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" /></Field>
          <p className="sm:col-span-2 text-[13px] text-muted">Only used to address the invite from your phone. Not saved.</p>
        </div>
      )}
      <div className="flex gap-2">
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" loading={busy}>{submitLabel}</Button>
      </div>
    </form>
  );
}
