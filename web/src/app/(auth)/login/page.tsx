import Link from "next/link";
import type { Metadata } from "next";
import { GoogleButton, OrDivider, SignInForm } from "@/components/auth/forms";
import { APP_NAME } from "@/lib/brand";
import { Notice } from "@/components/ui";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next = "/home", error } = await searchParams;
  return (
    <>
      <h1 className="text-[32px] font-semibold tracking-[-0.035em] leading-tight">Welcome back</h1>
      <p className="text-muted mt-2 mb-8">Sign in to see what's due in your Spaces.</p>
      {error && (
        <div className="mb-5">
          <Notice tone="error" title={error === "google" ? "Google sign-in didn't finish" : "That sign-in link didn't work"}>
            {error === "google" ? "Try again, or use your email below." : "It may have expired or been used already. Sign in again."}
          </Notice>
        </div>
      )}
      <GoogleButton next={next} />
      <OrDivider />
      <SignInForm next={next} />
      <p className="mt-8 text-[15px] text-ink-2">New to {APP_NAME}? <Link href={`/signup?next=${encodeURIComponent(next)}`} className="font-medium text-brand-ink underline underline-offset-4 decoration-brand-strong/30 hover:decoration-brand-strong">Create an account</Link></p>
    </>
  );
}
