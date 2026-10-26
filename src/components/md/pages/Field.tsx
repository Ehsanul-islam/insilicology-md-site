import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string };

/** Labelled input with an optional hint and error, wired for screen readers. */
export function Field({ label, error, hint, id, ...input }: Props) {
  const fid = id ?? `f-${input.name}`;
  return (
    <div className="md-field">
      <label className="md-field-label" htmlFor={fid}>{label}</label>
      <input id={fid} className="md-input" aria-invalid={!!error} aria-describedby={error ? `${fid}-err` : hint ? `${fid}-hint` : undefined} {...input} />
      {error ? <p id={`${fid}-err`} className="md-error">{error}</p> : hint ? <p id={`${fid}-hint`} className="md-hint">{hint}</p> : null}
    </div>
  );
}
