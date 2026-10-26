import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { encryptGmailToken } from "@/lib/gmail";

function verifyState(value: string, expected: string) {
  const [payload, signature] = value.split(".");
  const expectedSignature = createHmac("sha256", process.env.GMAIL_OAUTH_STATE_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.INBOUND_WEBHOOK_SECRET ?? "").update(payload).digest("base64url");
  return signature?.length === expectedSignature.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature)) && value === expected;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const store = await cookies();
  const state = url.searchParams.get("state") ?? "";
  const saved = store.get("gmail_oauth_state")?.value ?? "";
  store.delete("gmail_oauth_state");
  const fallback = "/home";
  if (!state || !saved || !verifyState(state, saved)) return NextResponse.redirect(new URL(`${fallback}?gmail=invalid_state`, req.url));
  const payload = JSON.parse(Buffer.from(state.split(".")[0], "base64url").toString("utf8")) as { spaceId?: string };
  const target = payload.spaceId ? `/s/${payload.spaceId}/auto-bills` : fallback;
  if (url.searchParams.get("error")) return NextResponse.redirect(new URL(`${target}?gmail=cancelled`, req.url));
  const code = url.searchParams.get("code");
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !code) return NextResponse.redirect(new URL(`${target}?gmail=not_signed_in`, req.url));

  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? new URL("/api/google/gmail/callback", req.url).toString();
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID ?? "", client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "", redirect_uri: redirectUri, grant_type: "authorization_code" }) });
  const tokens = await tokenResponse.json() as { refresh_token?: string; access_token?: string; scope?: string; error?: string };
  if (!tokenResponse.ok || !tokens.access_token || !tokens.refresh_token) {
    console.error("gmail_oauth_token_exchange_failed", { status: tokenResponse.status, error: tokens.error });
    return NextResponse.redirect(new URL(`${target}?gmail=token_error`, req.url));
  }

  const profileResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", { headers: { authorization: `Bearer ${tokens.access_token}` } });
  const profile = await profileResponse.json() as { emailAddress?: string };
  const admin = supabaseAdmin();
  if (!admin || !profile.emailAddress) return NextResponse.redirect(new URL(`${target}?gmail=server_not_configured`, req.url));
  const { error } = await admin.from("gmail_connections").upsert({ user_id: user.id, gmail_address: profile.emailAddress, refresh_token_ciphertext: encryptGmailToken(tokens.refresh_token), scopes: (tokens.scope ?? "").split(" ").filter(Boolean), status: "active", last_error: null, updated_at: new Date().toISOString() }, { onConflict: "user_id,gmail_address" });
  if (error) {
    console.error("gmail_connection_save_failed", { code: error.code, message: error.message });
    return NextResponse.redirect(new URL(`${target}?gmail=save_error`, req.url));
  }
  return NextResponse.redirect(new URL(`${target}?gmail=connected`, req.url));
}
