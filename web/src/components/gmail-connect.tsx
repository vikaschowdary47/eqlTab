import Link from "next/link";
import { ButtonLink, Card, Notice } from "./ui";

export function GmailConnect({ spaceId, address, status }: { spaceId: string; address?: string; status?: string }) {
  const message = status === "connected" ? "Gmail connected. You can scan for new bills now." : status === "sync_success" ? `Gmail scan finished${address ? "" : ""}. Review any new statements below.` : status === "disconnected" ? "Gmail disconnected. eqlTab can no longer access that inbox." : status === "cancelled" ? "Gmail connection was cancelled. No access was granted." : status === "invalid_state" ? "The Gmail connection expired. Start again." : status === "revoked" ? "Google revoked access. Reconnect Gmail to scan bills." : status === "not_configured" ? "Gmail is not configured on this server yet." : status ? "Gmail could not be connected. Check the Google setup and try again." : null;
  return (
    <Card className="p-5 space-y-4">
      {message && <Notice tone={status === "connected" ? "success" : "error"} title={status === "connected" ? "Gmail connected" : "Gmail connection failed"}>{message}</Notice>}
      {address ? <p className="text-[14px] text-ink-2">Connected as <strong>{address}</strong>.</p> : <p className="text-[14px] text-ink-2">Connect Gmail so eqlTab can look for bill emails after you approve read-only access.</p>}
      {!address && <ButtonLink href={`/api/google/gmail/start?spaceId=${encodeURIComponent(spaceId)}`} size="md">Connect Gmail</ButtonLink>}
      {address && <div className="flex items-center gap-4"><form action={`/api/google/gmail/sync?spaceId=${encodeURIComponent(spaceId)}`} method="post"><button className="h-10 px-4 rounded-[10px] bg-ink text-white text-[14px] font-medium">Scan Gmail</button></form><Link href={`/api/google/gmail/start?spaceId=${encodeURIComponent(spaceId)}`} className="text-[14px] text-brand-ink underline underline-offset-4">Reconnect</Link><form action={`/api/google/gmail/disconnect?spaceId=${encodeURIComponent(spaceId)}`} method="post"><button className="text-[14px] text-error underline underline-offset-4">Disconnect</button></form></div>}
      <p className="text-[12px] text-muted">Read-only access. We save parsed bill details, not your Gmail inbox.</p>
    </Card>
  );
}
