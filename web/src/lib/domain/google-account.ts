/**
 * Section 21.3: the Gmail inbox a user connects must be the same Google account they signed in with.
 * Pure function so the rule is tested without Google.
 */
export interface SignedInUser {
  email: string | null;
  /** Google account id ("sub") when the user signed in with Google. */
  googleSub: string | null;
}
export interface ConsentedAccount {
  email: string | null;
  emailVerified: boolean;
  sub: string | null;
}

export type AccountCheck = { ok: true } | { ok: false; reason: "different_account" | "unverified" | "no_identity" };

export function checkSameGoogleAccount(user: SignedInUser, consented: ConsentedAccount): AccountCheck {
  if (!consented.sub && !consented.email) return { ok: false, reason: "no_identity" };
  // Signed in with Google: the account id is the reliable comparison (emails can be reused or changed).
  if (user.googleSub) return consented.sub === user.googleSub ? { ok: true } : { ok: false, reason: "different_account" };
  // Signed in with email: the Google account must have the same, verified address.
  if (!user.email || !consented.email) return { ok: false, reason: "no_identity" };
  if (!consented.emailVerified) return { ok: false, reason: "unverified" };
  return normalize(user.email) === normalize(consented.email) ? { ok: true } : { ok: false, reason: "different_account" };
}

function normalize(email: string) {
  return email.trim().toLowerCase();
}

/**
 * Reads the claims of an ID token received directly from Google's token endpoint over TLS.
 * OpenID Connect allows skipping signature checks for tokens obtained this way.
 */
export function idTokenClaims(idToken: string | undefined): ConsentedAccount {
  try {
    const part = idToken?.split(".")[1];
    if (!part) return { email: null, emailVerified: false, sub: null };
    const c = JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as { email?: string; email_verified?: boolean | string; sub?: string };
    return { email: c.email ?? null, emailVerified: c.email_verified === true || c.email_verified === "true", sub: c.sub ?? null };
  } catch {
    return { email: null, emailVerified: false, sub: null };
  }
}
