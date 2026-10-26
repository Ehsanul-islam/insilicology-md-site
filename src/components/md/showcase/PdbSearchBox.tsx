import { useId, useMemo, useRef, useState } from "react";
import { usePublishedPdbs } from "./data/hooks";
import { isValidPdbId, normalisePdbId } from "./data/api";
import { displayResn } from "./ResultsView";

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSearch: (pdbId: string) => void;
};

/** PDB ID input with suggestions from published runs (ARIA combobox + listbox). */
export function PdbSearchBox({ value, onChange, onSearch }: Props) {
  const uid = useId().replace(/:/g, "");
  const inputId = `pdb-${uid}`;
  const listId = `pdb-list-${uid}`;
  const { data: published = [] } = usePublishedPdbs();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const blurTimer = useRef<number>();

  const q = normalisePdbId(value);
  const matches = useMemo(() => {
    const list = q ? published.filter((p) => p.pdb_id.startsWith(q)) : published;
    return list.slice(0, 8);
  }, [published, q]);
  const showList = open && (matches.length > 0 || q.length > 0);

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

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const n = matches.length;
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
    } else if (e.key === "Enter" && open && active >= 0 && matches[active]) {
      e.preventDefault();
      submit(matches[active].pdb_id);
    }
  };

  return (
    <form
      className="md-search"
      role="search"
      aria-label="Search simulations by PDB ID"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit(value);
      }}
    >
      <label htmlFor={inputId} className="md-field-label">
        PDB ID
      </label>
      <div className="md-search__row">
        <div className="md-combo">
          <input
            id={inputId}
            className="md-input md-input--mono md-input--lg"
            role="combobox"
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
            aria-invalid={!!error}
            aria-describedby={`${inputId}-hint`}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={4}
            placeholder="e.g. 1AFS"
            value={value}
            onChange={(e) => {
              onChange(e.target.value.toUpperCase());
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
          {showList && (
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
          Four characters, as listed on rcsb.org. Suggestions show IDs we have published.
        </p>
      )}
    </form>
  );
}
