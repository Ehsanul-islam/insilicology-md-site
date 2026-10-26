"use client";

import { useActionState } from "react";
import { updateProfile, type ProfileState } from "../../../app/dashboard/simulations/actions";
import { Field } from "../pages/Field";

export function ProfileForm({ profile }: { profile: { display_name: string; affiliation: string | null; orcid: string | null } }) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(updateProfile, {});
  return (
    <form className="md-form" action={action}>
      <Field label="Name" name="display_name" defaultValue={profile.display_name} autoComplete="name" hint="Shown as the contributor on published records and articles." />
      <Field label="Affiliation" name="affiliation" defaultValue={profile.affiliation ?? ""} autoComplete="organization" />
      <Field label="ORCID" name="orcid" defaultValue={profile.orcid ?? ""} placeholder="0000-0002-1825-0097" />
      {state.error && <p className="md-error" role="alert">{state.error}</p>}
      {state.ok && <p className="md-ok" role="status">Saved.</p>}
      <div className="md-form__row">
        <button type="submit" className="md-btn md-btn-secondary" disabled={pending}>{pending ? "Saving…" : "Save profile"}</button>
      </div>
    </form>
  );
}
