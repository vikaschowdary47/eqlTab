import "server-only";
import { decryptGmailToken } from "@/lib/gmail";

type TokenRow = { refresh_token_ciphertext: string };
type GmailHeader = { name?: string; value?: string };
type GmailPart = { mimeType?: string; filename?: string; headers?: GmailHeader[]; body?: { data?: string; attachmentId?: string }; parts?: GmailPart[] };
type GmailMessage = { id: string; payload?: GmailPart };

function decode(value: string) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export async function gmailAccessToken(connection: TokenRow) {
  const refreshToken = decryptGmailToken(connection.refresh_token_ciphertext);
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ refresh_token: refreshToken, client_id: process.env.GOOGLE_CLIENT_ID ?? "", client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "", grant_type: "refresh_token" }),
  });
  const data = await response.json() as { access_token?: string };
  if (!response.ok || !data.access_token) throw new Error("gmail_token_revoked");
  return data.access_token;
}

async function gmailJson<T>(path: string, token: string) {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`gmail_api_${response.status}`);
  return response.json() as Promise<T>;
}

/** Only mail from the companies the household chose (see providers.ts). Never a whole-inbox search. */
export async function findBillMessages(token: string, query: string) {
  const data = await gmailJson<{ messages?: { id: string }[] }>(`/messages?maxResults=25&q=${encodeURIComponent(query)}`, token);
  return data.messages ?? [];
}

/** Reads only the From header, so a message can be skipped without downloading its body or attachments. */
export async function readMessageSender(messageId: string, token: string) {
  const message = await gmailJson<GmailMessage>(`/messages/${messageId}?format=metadata&metadataHeaders=From`, token);
  return message.payload?.headers?.find((h) => h.name?.toLowerCase() === "from")?.value ?? "";
}

async function partContent(part: GmailPart, token: string, messageId: string) {
  if (part.body?.data) return decode(part.body.data);
  if (part.body?.attachmentId) {
    const data = await gmailJson<{ data?: string }>(`/messages/${messageId}/attachments/${part.body.attachmentId}`, token);
    return data.data ? decode(data.data) : Buffer.alloc(0);
  }
  return Buffer.alloc(0);
}

async function collectParts(part: GmailPart, token: string, messageId: string, out: { text: string[]; pdf?: { name: string; bytes: Buffer } }) {
  if (part.parts?.length) for (const child of part.parts) await collectParts(child, token, messageId, out);
  if (part.mimeType === "text/plain" || part.mimeType === "text/html") {
    const bytes = await partContent(part, token, messageId);
    out.text.push(bytes.toString("utf8"));
  }
  if (part.mimeType === "application/pdf" && !out.pdf) {
    const bytes = await partContent(part, token, messageId);
    if (bytes.subarray(0, 5).toString() === "%PDF-") out.pdf = { name: part.filename || "statement.pdf", bytes };
  }
}

export async function readBillMessage(messageId: string, token: string) {
  const message = await gmailJson<GmailMessage>(`/messages/${messageId}?format=full`, token);
  const out: { text: string[]; pdf?: { name: string; bytes: Buffer } } = { text: [] };
  if (message.payload) await collectParts(message.payload, token, messageId, out);
  const headers = Object.fromEntries((message.payload?.headers ?? []).map((h) => [h.name?.toLowerCase() ?? "", h.value ?? ""]));
  return { text: out.text.join("\n"), subject: headers.subject ?? "", from: headers.from ?? "", pdf: out.pdf };
}
