import { AsciiMolecule } from "./AsciiMolecule";

export function MdHero({ theme }: { theme: string }) {
  return (
    <section className="md-hero" aria-labelledby="md-hero-title">
      <div className="md-wrap md-grid">
        <div className="md-hero-copy">
          <p className="md-label">─◆─ 00 · MD simulation service</p>
          <h1 id="md-hero-title" className="md-display">Molecular Dynamics Simulation Service</h1>
          <p className="md-lead">
            Set up, run and analyse your protein–ligand system end to end, delivered as trajectories, publication
            figures and a methods section you can cite.
          </p>
          <div className="md-ctas">
            <a className="md-btn md-btn-primary" href="#contact">
              Get a quote <span className="md-arr" aria-hidden="true">→</span>
            </a>
            <a className="md-btn md-btn-secondary" href="#showcase">Explore the showcase</a>
          </div>
          <ul className="md-strip" aria-label="Default setup">
            <li>GROMACS</li>
            <li>CHARMM36</li>
            <li>100 ns default</li>
          </ul>
        </div>

        <figure className="md-hero-art">
          <AsciiMolecule
            pdbId="1HVR"
            ligandResn="XK2"
            focus="whole"
            zoom={1.4}
            size={[140, 140]}
            cell={4}
            autoSpin
            theme={theme}
            label="HIV-1 protease dimer with the cyclic urea inhibitor XK2, PDB 1HVR"
          />
          <figcaption className="md-sr">
            HIV-1 protease homodimer bound to the cyclic urea inhibitor XK2 (PDB 1HVR), rendered as halftone ASCII.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
