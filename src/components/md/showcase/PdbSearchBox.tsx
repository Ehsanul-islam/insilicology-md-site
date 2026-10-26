"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState } from "react";
import { usePublishedPdbs } from "./data/hooks";
import { isValidPdbId, normalisePdbId } from "./data/api";
import { displayResn } from "../../../lib/data/format";
import { resolveAnalysisType, suggestAnalysisTypes, type AnalysisType } from "../../../lib/data/analysis-types";

type Props = {
  /** Analysis types for the "Analysis type" mode; defaults to the built-in list. */
  types?: AnalysisType[];
  value: string;
  onChange: (v: string) => void;
  onSearch: (pdbId: string) => void;
};

/** PDB ID input with suggestions from published runs (ARIA combobox + listbox). */
export function PdbSearchBox({ types, value, onChange, onSearch }: Props) {
  const uid = useId().replace(/:/g, "");
  const inputId = `pdb-${uid}`;
  const listId = `pdb-list-${uid}`;
  const { data: published = [] } = usePublishedPdbs();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const blurTimer = useRef<number | undefined>(undefined);
  const router = useRouter();
  const [mode, setMode] = useState<"pdb" | "type">("pdb");
  const [typeValue, setTypeValue] = useState("");
  const isType = mode === "type";
  const typeMatches = useMemo(() => suggestAnalysisTypes(typeValue, 8, types), [typeValue, types]);

  const q = normalisePdbId(value);
  const matches = useMemo(() => {
    const list = q ? published.filter((p) => p.pdb_id.startsWith(q)) : published;
    return list.slice(0, 8);
  }, [published, q]);
  const showList = open && (isType ? typeMatches.length > 0 : matches.length > 0 || q.length > 0);

  const submit = (id: string) => {
    const pdb = normalisePdbId(id);
    if (!isValidPdbId(pdb)) {
      setError("Enter a 4-character PDB ID that starts with a digit, such as 1AFS.");
      setOpen(false);
      return;
    }
    setError(null);
    setOpen(false);
    setActive(-1);
    onChange(pdb);
    onSearch(pdb);
  };

  const submitType = (text: string) => {
    const type = resolveAnalysisType(text, types) ?? (suggestAnalysisTypes(text, 8, types).length === 1 ? suggestAnalysisTypes(text, 8, types)[0] : undefined);
    if (!type) {
      setError("Pick an analysis type from the list, such as RMSD or hydrogen bonds.");
      setOpen(false);
      return;
    }
    setError(null);
    setOpen(false);
    router.push(`/analysis/${type.slug}`);
  };

  const switchMode = (m: "pdb" | "type") => {
    setMode(m);
    setError(null);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const n = isType ? typeMatches.length : matches.length;
    if (e.key === "ArrowDown" && n) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % n);
    } else if (e.key === "ArrowUp" && n) {
      e.preventDefault();
      setActive((a) => (a - 1 + n) % n);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    } else if (e.key === "Enter" && open && active >= 0) {
      if (isType && typeMatches[active]) {
        e.preventDefault();
        submitType(typeMatches[active].name);
      } else if (!isType && matches[active]) {
        e.preventDefault();
        submit(matches[active].pdb_id);
      }
    }
  };

  return (
    <form
      className="md-search"
      role="search"
      aria-label={isType ? "Search simulations by analysis type" : "Search simulations by PDB ID"}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (isType) submitType(typeValue);
        else submit(value);
      }}
    >
      <div className="md-seg" role="group" aria-label="Search by">
        <button type="button" className="md-seg__btn" aria-pressed={!isType} onClick={() => switchMode("pdb")}>
          PDB ID
        </button>
        <button type="button" className="md-seg__btn" aria-pressed={isType} onClick={() => switchMode("type")}>
          Analysis type
        </button>
      </div>
      <label htmlFor={inputId} className="md-sr">
        {isType ? "Analysis type" : "PDB ID"}
      </label>
      <div className="md-search__row">
        <div className="md-combo">
          <input
            id={inputId}
            className={`md-input md-input--lg${isType ? "" : " md-input--mono"}`}
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
            aria-invalid={!!error}
            aria-describedby={`${inputId}-hint`}
            autoComplete="off"
            autoCapitalize={isType ? "off" : "characters"}
            spellCheck={false}
            maxLength={isType ? 60 : 4}
            placeholder={isType ? "e.g. RMSD or hydrogen bonds" : "e.g. 1AFS"}
            value={isType ? typeValue : value}
            onChange={(e) => {
              if (isType) setTypeValue(e.target.value);
              else onChange(e.target.value.toUpperCase());
              setError(null);
              setActive(-1);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              blurTimer.current = window.setTimeout(() => setOpen(false), 120);
            }}
            onKeyDown={onKeyDown}
          />
          {showList && isType && (
            <div className="md-combo__pop">
              <ul id={listId} role="listbox" aria-label="Analysis types" className="md-combo__list">
                {typeMatches.map((ty, i) => (
                  <li
                    key={ty.slug}
                    id={`${listId}-${i}`}
                    role="option"
                    aria-selected={i === active}
                    className="md-combo__opt"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setTypeValue(ty.name);
                      submitType(ty.name);
                    }}
                    onMouseEnter={() => setActive(i)}
                  >
                    <span className="md-combo__text">
                      <span>{ty.name}</span>
                      <span className="md-combo__sub">{ty.summary}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {showList && !isType && (
            <div className="md-combo__pop">
              {!q && matches.length > 0 && <p className="md-combo__label md-mono">Recently published</p>}
              {matches.length > 0 && (
                <ul id={listId} role="listbox" aria-label="Published PDB IDs" className="md-combo__list">
                  {matches.map((p, i) => {
                    const hit = q && p.pdb_id.startsWith(q);
                    return (
                      <li
                        key={p.pdb_id}
                        id={`${listId}-${i}`}
                        role="option"
                        aria-selected={i === active}
                        className="md-combo__opt"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          submit(p.pdb_id);
                        }}
                        onMouseEnter={() => setActive(i)}
                      >
                        <span className="md-combo__id md-mono">
                          {hit ? (
                            <>
                              <strong>{p.pdb_id.slice(0, q.length)}</strong>
                              {p.pdb_id.slice(q.length)}
                            </>
                          ) : (
                            p.pdb_id
                          )}
                        </span>
                        <span className="md-combo__text">
                          <span>{p.protein_name || "Protein name not set"}</span>
                          <span className="md-combo__sub">
                            {p.complexes === 1 ? "1 complex" : `${p.complexes} complexes`}
                            {p.ligands?.length ? `: ${p.ligands.map(displayResn).join(", ")}` : ""}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
              {q && matches.length === 0 && (
                <p className="md-combo__empty">
                  No published runs start with <span className="md-mono">{q}</span>. Search anyway to request it.
                </p>
              )}
            </div>
          )}
        </div>
        <button type="submit" className="md-btn md-btn--solid md-btn--lg">
          Search
        </button>
      </div>
      {error ? (
        <p id={`${inputId}-hint`} className="md-error">
          {error}
        </p>
      ) : (
        <p id={`${inputId}-hint`} className="md-hint">
          {isType
            ? "Pick the analysis or simulation type. Aliases such as RMSD and protein RMSD find the same page."
            : "Four characters, as listed on rcsb.org. Suggestions show IDs we have published."}
        </p>
      )}
    </form>
  );
}
