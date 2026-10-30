"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { signInAction, signInWithGoogleAction, signUpAction, sendResetAction, updatePasswordAction } from "@/lib/actions";
import { Button, Field, Input, Notice } from "@/components/ui";

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signInAction, null);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      {state && !state.ok && <Notice tone="error" title={state.error} />}
      <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
      <Field label="Password" htmlFor="password"><Input id="password" name="password" type="password" autoComplete="current-password" required /></Field>
      <div className="flex justify-end -mt-1"><Link href="/forgot" className="text-[14px] text-brand-ink underline underline-offset-4 decoration-brand-strong/30 hover:decoration-brand-strong">Forgot password?</Link></div>
      <Button type="submit" size="lg" full loading={pending}>Sign in</Button>
    </form>
  );
}

export function SignUpForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signUpAction, null);
  const [show, setShow] = useState(false);
  if (state?.ok) {
    return (
      <Notice tone="brand" title="Check your inbox">
        We sent a confirmation link to <strong>{state.data.email}</strong>. Open it on this device to continue.
      </Notice>
    );
  }
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      {state && !state.ok && <Notice tone="error" title={state.error} />}
      <Field label="Your name" htmlFor="name" hint="This is how people in your Space will see you."><Input id="name" name="name" autoComplete="name" required maxLength={80} /></Field>
      <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
      <Field label="Password" htmlFor="password" hint="At least 8 characters.">
        <div className="relative">
          <Input id="password" name="password" type={show ? "text" : "password"} autoComplete="new-password" required minLength={8} className="pr-16" />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 h-8 px-2.5 rounded-lg text-[13px] text-ink-2 hover:bg-sunken" aria-pressed={show}>
            {show ? "Hide" : "Show"}
          </button>
        </div>
      </Field>
      <Button type="submit" size="lg" full loading={pending}>Create account</Button>
      <p className="text-[13px] text-muted">By continuing you agree to the <Link className="underline underline-offset-2" href="/terms">Terms</Link> and <Link className="underline underline-offset-2" href="/privacy">Privacy Policy</Link>.</p>
    </form>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState(sendResetAction, null);
  if (state?.ok) return <Notice tone="brand" title="Check your email">If an account exists for that address, a reset link is on its way.</Notice>;
  return (
    <form action={action} className="space-y-4">
      <Field label="Email" htmlFor="email"><Input id="email" name="email" type="email" autoComplete="email" required /></Field>
      <Button type="submit" size="lg" full loading={pending}>Send reset link</Button>
    </form>
  );
}

export function ResetForm() {
  const [state, action, pending] = useActionState(updatePasswordAction, null);
  return (
    <form action={action} className="space-y-4">
      {state && !state.ok && <Notice tone="error" title={state.error} />}
      <Field label="New password" htmlFor="password" hint="At least 8 characters."><Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} /></Field>
      <Button type="submit" size="lg" full loading={pending}>Save password</Button>
    </form>
  );
}

/** Primary sign-in (section 21.2). No password to create. */
export function GoogleButton({ next, label = "Continue with Google" }: { next: string; label?: string }) {
  return (
    <form action={signInWithGoogleAction}>
      <input type="hidden" name="next" value={next} />
      <GoogleSubmit label={label} />
    </form>
  );
}

function GoogleSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" full variant="secondary" loading={pending} className="bg-surface">
      {!pending && (
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
      )}
      {label}
    </Button>
  );
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3 my-6 text-[13px] text-muted" role="separator">
      <span className="h-px flex-1 bg-line" />or use email<span className="h-px flex-1 bg-line" />
    </div>
  );
}
