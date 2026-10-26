"use client";

import { useActionState, useState } from "react";
import { createDraft, type CreateState } from "../../../app/dashboard/simulations/actions";
import type { SimulationOption } from "../../../lib/dashboard/server";
import { Field } from "../pages/Field";

export function NewSimulationForm({ types }: { types: SimulationOption[] }) {
  const [state, action, pending] = useActionState<CreateState, FormData>(createDraft, {});
  const [slug, setSlug] = useState(state.values?.simulationType ?? "");
  const type = types.find((t) => t.slug === slug);
  const v = state.values ?? {};

  return (
    <form className="md-form md-form--wide" action={action}>
      <div className="md-field">
        <label className="md-field-label" htmlFor="f-simulationType">Simulation type</label>
        <select id="f-simulationType" name="simulationType" className="md-input" value={slug} onChange={(e) => setSlug(e.target.value)} required>
          <option value="">Choose…</option>
          {types.map((t) => <option key={t.slug} value={t.slug}>{t.name}</option>)}
        </select>
        <p className="md-hint">{type ? type.summary : "What is simulated or which method is used. Not in the list? Request a new type from the Requests page."}</p>
      </div>
      <Field label="Title" name="title" defaultValue={v.title} required maxLength={200} hint="For example: Testosterone in 3-alpha-hydroxysteroid dehydrogenase, 100 ns." />
      <Field
        label={`PDB ID${type?.requiresStructure ? "" : " (optional)"}`}
        name="pdbId"
        defaultValue={v.pdbId}
        maxLength={4}
        placeholder="1AFS"
        required={!!type?.requiresStructure}
      />
      <Field label="Ligand residue name (optional)" name="ligand" defaultValue={v.ligand} maxLength={5} placeholder="TES" hint="The short code in your structure file. You can add full molecule details on the next page." />
      <p className="md-hint">The web address is built from the PDB ID and ligand (for example /simulations/1afs-tes), or from the title when there is no PDB ID, and it cannot be changed later.</p>
      {state.error && <p className="md-error" role="alert">{state.error}</p>}
      <div className="md-form__row">
        <button type="submit" className="md-btn md-btn-primary" disabled={pending}>{pending ? "Creating…" : "Create draft"}</button>
      </div>
    </form>
  );
}
