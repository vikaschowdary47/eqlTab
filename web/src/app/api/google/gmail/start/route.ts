import { createHmac, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";

const SCOPES = ["openid", "email", "https://www.googleapis.com/auth/gmail.readonly"];

function secret() {
  return process.env.GMAIL_OAUTH_STATE_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.INBOUND_WEBHOOK_SECRET ?? "";
}

export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));
  const spaceId = new URL(req.url).searchParams.get("spaceId") ?? "";
  const payload = Buffer.from(JSON.stringify({ nonce: randomBytes(18).toString("hex"), spaceId })).toString("base64url");
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  const state = `${payload}.${signature}`;
  const store = await cookies();
  store.set("gmail_oauth_state", state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", maxAge: 600, path: "/" });

  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? new URL("/api/google/gmail/callback", req.url).toString();
  const params = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID ?? "", redirect_uri: redirectUri, response_type: "code", access_type: "offline", prompt: "consent", include_granted_scopes: "true", scope: SCOPES.join(" "), state });
  // Preselect the account they signed in with (section 21.3); the callback enforces it.
  if (user.email) params.set("login_hint", user.email);
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
