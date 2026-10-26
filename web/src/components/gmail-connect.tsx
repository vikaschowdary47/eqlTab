import Link from "next/link";
import { ButtonLink, Card, Notice } from "./ui";

export function GmailConnect({ spaceId, address, status, count }: { spaceId: string; address?: string; status?: string; count?: string }) {
  const result = (() => {
    switch (status) {
      case "connected": return { tone: "success" as const, title: "Gmail connected", message: "Gmail connected. You can scan for new bills now." };
      case "sync_success": return { tone: "success" as const, title: "Gmail scan finished", message: `${count ? `${count} new statement${count === "1" ? "" : "s"} imported. ` : ""}Review the statements below before confirming anything.` };
      case "disconnected": return { tone: "neutral" as const, title: "Gmail disconnected", message: "eqlTab can no longer access that inbox. Your existing statements are unchanged." };
      case "cancelled": return { tone: "warning" as const, title: "Gmail connection cancelled", message: "No access was granted. Connect Gmail when you're ready." };
      case "invalid_state": return { tone: "warning" as const, title: "Gmail connection expired", message: "The Google sign-in took too long or was opened twice. Start again." };
      case "revoked": return { tone: "error" as const, title: "Gmail access revoked", message: "Google revoked eqlTab's access. Reconnect Gmail to scan bills." };
      case "not_configured": return { tone: "error" as const, title: "Gmail isn't configured", message: "The server is missing its Gmail configuration. Check the server environment variables." };
      case "server_not_configured": return { tone: "error" as const, title: "Gmail connection couldn't be saved", message: "Google authorized eqlTab, but the server could not finish setting up the connection." };
      case "token_error": return { tone: "error" as const, title: "Google authorization failed", message: "Google did not return a usable token. Confirm the client secret and redirect URI, then try again." };
      case "save_error": return { tone: "error" as const, title: "Gmail connection couldn't be saved", message: "Google authorized eqlTab, but the connection could not be saved. Apply the Supabase migration and try again." };
      case "not_signed_in": return { tone: "warning" as const, title: "Sign in required", message: "Your eqlTab session expired. Sign in again, then reconnect Gmail." };
      case "gmail_not_connected": return { tone: "warning" as const, title: "Gmail isn't connected", message: "Connect Gmail before starting a scan." };
      case "forbidden": return { tone: "error" as const, title: "You can't scan this Space", message: "Ask an active Space member to connect Gmail or check that you have access." };
      case "sync_error": return { tone: "error" as const, title: "Gmail scan failed", message: "We couldn't read Gmail this time. Reconnect Gmail and try again. Your existing statements are safe." };
      default: return status ? { tone: "error" as const, title: "Gmail connection failed", message: "Check the Google setup and try again." } : null;
    }
  })();
  return (
    <Card className="p-5 space-y-4">
      {result && <Notice tone={result.tone} title={result.title}>{result.message}</Notice>}
      {address ? <p className="text-[14px] text-ink-2">Connected as <strong>{address}</strong>.</p> : <p className="text-[14px] text-ink-2">Connect Gmail so eqlTab can look for bill emails after you approve read-only access.</p>}
      {!address && <ButtonLink href={`/api/google/gmail/start?spaceId=${encodeURIComponent(spaceId)}`} size="md">Connect Gmail</ButtonLink>}
      {address && <div className="flex items-center gap-4"><form action={`/api/google/gmail/sync?spaceId=${encodeURIComponent(spaceId)}`} method="post"><button className="h-10 px-4 rounded-[10px] bg-ink text-white text-[14px] font-medium">Scan Gmail</button></form><Link href={`/api/google/gmail/start?spaceId=${encodeURIComponent(spaceId)}`} className="text-[14px] text-brand-ink underline underline-offset-4">Reconnect</Link><form action={`/api/google/gmail/disconnect?spaceId=${encodeURIComponent(spaceId)}`} method="post"><button className="text-[14px] text-error underline underline-offset-4">Disconnect</button></form></div>}
      <p className="text-[12px] text-muted">Read-only access. We save parsed bill details, not your Gmail inbox.</p>
    </Card>
  );
}
