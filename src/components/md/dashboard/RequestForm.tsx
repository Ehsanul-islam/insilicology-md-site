"use client";

import { useActionState } from "react";
import { requestType, type RequestState } from "../../../app/dashboard/simulations/actions";
import { Field } from "../pages/Field";

export function RequestForm() {
  const [state, action, pending] = useActionState<RequestState, FormData>(requestType, {});
  return (
    <form className="md-form" action={action}>
      <div className="md-field">
        <label className="md-field-label" htmlFor="f-kind">Kind of category</label>
        <select id="f-kind" name="kind" className="md-input" defaultValue="simulation">
          <option value="simulation">Simulation type (what is simulated, or the method)</option>
          <option value="analysis">Analysis (what you measured, such as RMSD)</option>
        </select>
      </div>
      <Field label="Name" name="name" required maxLength={120} placeholder="QM/MM" />
      <div className="md-field">
        <label className="md-field-label" htmlFor="f-reason">Why is it needed? (optional)</label>
        <textarea id="f-reason" name="reason" className="md-input" maxLength={2000} />
      </div>
      {state.error && <p className="md-error" role="alert">{state.error}</p>}
      {state.ok && <p className="md-ok" role="status">Thanks, an administrator will review your request.</p>}
      <div className="md-form__row">
        <button type="submit" className="md-btn md-btn-primary" disabled={pending}>{pending ? "Sending…" : "Send request"}</button>
      </div>
    </form>
  );
}
