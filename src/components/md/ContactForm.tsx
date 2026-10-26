"use client";

import Script from "next/script";
import { useActionState } from "react";
import { sendMessage, type ContactState } from "../../app/contact/actions";
import { Field } from "./pages/Field";

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

export function ContactForm({ pdb }: { pdb?: string }) {
  const [state, action, pending] = useActionState<ContactState, FormData>(sendMessage, {});
  const v = state.values;
  const e = state.errors ?? {};

  if (state.ok) {
    return <p className="md-ok" role="status">Thank you. Your message has been sent and we will reply by email.</p>;
  }

  return (
    <form className="md-form md-form--wide" action={action} noValidate>
      <Field label="Name" name="name" autoComplete="name" required defaultValue={v?.name} error={e.name} />
      <Field label="Email" name="email" type="email" autoComplete="email" required defaultValue={v?.email} error={e.email} />
      <Field label="Subject" name="subject" defaultValue={v?.subject} error={e.subject} hint="Optional." />
      <Field
        label="PDB ID"
        name="pdb"
        maxLength={4}
        className="md-input md-input--mono"
        defaultValue={v?.pdb ?? pdb}
        error={e.pdb}
        hint="Optional. The structure you want simulated or the record you are asking about."
      />
      <div className="md-field">
        <label className="md-field-label" htmlFor="f-message">Message</label>
        <textarea id="f-message" name="message" className="md-input" required defaultValue={v?.message} aria-invalid={!!e.message} aria-describedby={e.message ? "f-message-err" : undefined} />
        {e.message && <p id="f-message-err" className="md-error">{e.message}</p>}
      </div>
      <div className="md-hp" aria-hidden="true">
        <label>Leave this empty<input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>
      {SITE_KEY && (
        <>
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="lazyOnload" />
          <div className="cf-turnstile" data-sitekey={SITE_KEY} />
        </>
      )}
      {state.error && <p className="md-error" role="alert">{state.error}</p>}
      <div className="md-form__row">
        <button type="submit" className="md-btn md-btn-primary" disabled={pending}>{pending ? "Sending…" : "Send message"}</button>
      </div>
    </form>
  );
}
