import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { decryptGmailToken } from "@/lib/gmail";

export async function POST(req: Request) {
  const spaceId = new URL(req.url).searchParams.get("spaceId");
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = supabaseAdmin();
  if (user && admin) {
    const { data: connection } = await admin.from("gmail_connections").select("refresh_token_ciphertext").eq("user_id", user.id).maybeSingle();
    if (connection) {
      try { await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(decryptGmailToken(connection.refresh_token_ciphertext))}`, { method: "POST" }); } catch { /* local deletion still protects the app */ }
    }
    await admin.from("gmail_connections").delete().eq("user_id", user.id);
  }
  return NextResponse.redirect(new URL(spaceId ? `/s/${spaceId}/auto-bills?gmail=disconnected` : "/home", req.url));
}
