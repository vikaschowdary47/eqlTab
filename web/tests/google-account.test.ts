import { describe, expect, it } from "vitest";
import { checkSameGoogleAccount, idTokenClaims } from "@/lib/domain/google-account";

const token = (claims: object) => `x.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.sig`;

describe("same Google account rule", () => {
  it("accepts the account the user signed in with", () => {
    expect(checkSameGoogleAccount({ email: "a@gmail.com", googleSub: "111" }, { email: "a@gmail.com", emailVerified: true, sub: "111" })).toEqual({ ok: true });
  });
  it("rejects a different Google account", () => {
    expect(checkSameGoogleAccount({ email: "a@gmail.com", googleSub: "111" }, { email: "b@gmail.com", emailVerified: true, sub: "222" }).ok).toBe(false);
  });
  it("treats the same email with a different account id as a different account", () => {
    expect(checkSameGoogleAccount({ email: "a@gmail.com", googleSub: "111" }, { email: "a@gmail.com", emailVerified: true, sub: "999" })).toEqual({ ok: false, reason: "different_account" });
  });
  it("email sign-ups must connect the same verified address", () => {
    const user = { email: "A@Gmail.com", googleSub: null };
    expect(checkSameGoogleAccount(user, { email: "a@gmail.com", emailVerified: true, sub: "1" })).toEqual({ ok: true });
    expect(checkSameGoogleAccount(user, { email: "a@gmail.com", emailVerified: false, sub: "1" })).toEqual({ ok: false, reason: "unverified" });
    expect(checkSameGoogleAccount(user, { email: "other@gmail.com", emailVerified: true, sub: "1" })).toEqual({ ok: false, reason: "different_account" });
  });
  it("rejects when Google returns no identity", () => {
    expect(checkSameGoogleAccount({ email: "a@gmail.com", googleSub: null }, { email: null, emailVerified: false, sub: null }).ok).toBe(false);
  });
  it("reads ID token claims and survives garbage", () => {
    expect(idTokenClaims(token({ email: "a@gmail.com", email_verified: true, sub: "111" }))).toEqual({ email: "a@gmail.com", emailVerified: true, sub: "111" });
    expect(idTokenClaims("not-a-token")).toEqual({ email: null, emailVerified: false, sub: null });
    expect(idTokenClaims(undefined).sub).toBeNull();
  });
});
