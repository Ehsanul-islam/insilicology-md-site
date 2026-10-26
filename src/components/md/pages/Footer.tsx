import Link from "next/link";
import { listAnalysisTypes } from "../../../lib/data/analysis-type-store";
import { listSimulationTypes } from "../../../lib/data/simulation-type-store";

export async function MdFooter() {
  const [simulationTypes, analysisTypes] = await Promise.all([listSimulationTypes(), listAnalysisTypes()]);
  return (
    <footer className="md-footer">
      <div className="md-wrap">
        <div className="md-footer__grid">
          <div>
            <p className="md-brand" style={{ margin: 0 }}>
              <span className="md-brand-mark" aria-hidden="true">─◆─</span> Insilicology
            </p>
            <p className="md-footer__about">
              Molecular dynamics simulation service and an open, searchable database of simulation results.
            </p>
          </div>
          <nav aria-label="Explore">
            <h2>Explore</h2>
            <ul>
              <li><Link href="/simulations">Simulations</Link></li>
              <li><Link href="/simulation-types">Simulation types</Link></li>
              <li><Link href="/analysis">Analysis types</Link></li>
              <li><Link href="/tutorials">Tutorials</Link></li>
              <li><Link href="/blog">Blog</Link></li>
            </ul>
          </nav>
          <nav aria-label="Simulation types">
            <h2>Simulation types</h2>
            <ul>
              {simulationTypes.slice(0, 5).map((t) => (
                <li key={t.slug}><Link href={`/simulation-types/${t.slug}`}>{t.name}</Link></li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Analyses">
            <h2>Analyses</h2>
            <ul>
              {analysisTypes.slice(0, 5).map((t) => (
                <li key={t.slug}><Link href={`/analysis/${t.slug}`}>{t.name}</Link></li>
              ))}
            </ul>
          </nav>
          <nav aria-label="Company">
            <h2>Company</h2>
            <ul>
              <li><Link href="/about">About</Link></li>
              <li><Link href="/contact">Contact</Link></li>
              <li><Link href="/data-license">Data license</Link></li>
              <li><Link href="/terms">Terms</Link></li>
              <li><Link href="/privacy">Privacy</Link></li>
            </ul>
          </nav>
        </div>
        <p className="md-footer__legal">© {new Date().getFullYear()} Insilicology. All rights reserved.</p>
      </div>
    </footer>
  );
}
