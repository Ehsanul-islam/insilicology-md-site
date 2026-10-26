import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "../components/md/md.css";
import { MdShell } from "../components/md/MdShell";
import { THEME_INIT_SCRIPT } from "../components/md/useMdTheme";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://insilicology.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Molecular Dynamics Simulation Service | Insilicology",
  description:
    "Protein–ligand, apo/mutant, protein–protein and membrane MD simulations with GROMACS and CHARMM36, delivered with analysis, publication figures and a citable methods section.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body style={{ margin: 0 }}>
        <MdShell>{children}</MdShell>
      </body>
    </html>
  );
}
