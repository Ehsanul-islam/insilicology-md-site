"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { safeNext } from "../../lib/safe-next";
import { createBrowserSupabase } from "../../lib/supabase/client";
import { Field } from "./pages/Field";

type Mode = "sign-in" | "sign-up";

/** Email and password sign-in or sign-up, plus an emailed sign-in link. */
export function AuthForm({ mode, next, notice }: { mode: Mode; next?: string; notice?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(notice ?? null);
  const [done, setDone] = useState<string | null>(null);
  const target = safeNext(next);
  const nextQuery = next ? `?next=${encodeURIComponent(target)}` : "";

  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(target)}`;

  async function submit(formEl: HTMLFormElement, magic: boolean) {
    const supabase = createBrowserSupabase();
    if (!supabase) return setError("Accounts are not available yet.");
    const form = new FormData(formEl);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    setError(null);
    setDone(null);

    if (!email) return setError("Enter your email address.");
    if (mode === "sign-up" && !magic && password.length < 8) return setError("Use a password of at least 8 characters.");
    if (!magic && !password) return setError("Enter your password.");

    setBusy(true);
    try {
      if (magic) {
        const { error: err } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } });
        if (err) throw err;
        setDone("If that address can sign in, a link is on its way. Open it on this device.");
      } else if (mode === "sign-in") {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        router.replace(target);
        router.refresh();
      } else {
        const display_name = String(form.get("display_name") ?? "").trim();
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo(), data: { display_name } },
        });
        if (err) throw err;
        if (data.session) {
          router.replace(target);
          router.refresh();
        } else {
          setDone("Check your email to confirm your address, then sign in.");
        }
      }
    } catch (err) {
      // never reveal whether an address is registered
      const message = (err as Error).message || "";
      setError(/invalid login|credentials/i.test(message) ? "That email and password do not match." : message || "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const signUp = mode === "sign-up";
  return (
    <form
      className="md-form"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(e.currentTarget, false);
      }}
      noValidate
    >
      {signUp && <Field label="Name" name="display_name" autoComplete="name" hint="Shown on your published articles and records." />}
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete={signUp ? "new-password" : "current-password"}
        hint={signUp ? "At least 8 characters." : undefined}
      />
      {error && <p className="md-error" role="alert">{error}</p>}
      {done && <p className="md-ok" role="status">{done}</p>}
      <div className="md-form__row">
        <button type="submit" className="md-btn md-btn-primary" disabled={busy}>
          {busy ? "Please wait…" : signUp ? "Create account" : "Sign in"}
        </button>
        <button
          type="button"
          className="md-linkbtn"
          disabled={busy}
          onClick={(e) => void submit(e.currentTarget.form!, true)}
        >
          Email me a sign-in link
        </button>
      </div>
      <p className="md-hint">
        {signUp ? (
          <>Already registered? <Link href={`/auth/sign-in${nextQuery}`}>Sign in</Link>.</>
        ) : (
          <>New here? <Link href={`/auth/sign-up${nextQuery}`}>Create an account</Link>.</>
        )}
      </p>
    </form>
  );
}
