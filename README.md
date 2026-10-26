# Insilicology — MD Simulation Service site

Hero section with a live halftone ASCII protein (PDB 1HVR, HIV-1 protease + XK2).

Built with Next.js (App Router) + React 19, deployed on Vercel.

```
npm install
npm run dev        # http://localhost:8080
npm run build      # production build in .next/
npm run start      # serve the production build
npm run typecheck
npm test           # unit tests (vitest)
```

Env vars (see `.env.example`): `NEXT_PUBLIC_SITE_URL` (canonical site URL, defaults to https://insilicology.com) and `NEXT_PUBLIC_CONTACT_EMAIL`.

## Where things are

- `src/app/` — Next.js routes (`layout.tsx`, `page.tsx`); pages are server-rendered
- `src/app/` routes: `/` home, `/analysis` and `/analysis/[slug]` (category hubs), `/pdb/[id]`, `/simulations` and `/simulations/[slug]`, `/tutorials`, `/blog`, `/contact`, plus `sitemap.ts`, `robots.ts` and OG images
- `content/tutorials/*.md` — tutorials (frontmatter + Markdown); add a file to publish one
- `src/lib/data/` — server-side data reads (analysis types, records, tutorials, posts); sample data until Supabase is connected
- `src/lib/seo.ts` — metadata, canonical and JSON-LD helpers; sample/placeholder pages are `noindex` and left out of the sitemap
- `src/components/md/MdShell.tsx` — client shell: theme state, skip link, nav
- `src/components/md/MdHero.tsx` — hero section (headline, CTAs, ASCII frame)
- `src/components/md/MdNav.tsx` — top navigation, theme toggle, mobile menu
- `src/components/md/AsciiMolecule.tsx` — `<AsciiMolecule pdbId ligandResn focus zoom size autoSpin />`
- `src/components/md/asciiEngine.ts` — 3Dmol.js → glyph renderer (lazy-loaded, ~30 fps, pauses off-screen)
- `src/components/md/md.css` — design tokens (12-step grey, light/dark), layout, components
- `public/structures/` — PDB files and the static no-WebGL fallback frame

## Adding another protein

1. Put the PDB file in `public/structures/<id>.pdb` (lower-case id).
2. Use `<AsciiMolecule pdbId="<ID>" ligandResn="<RESN>" />`.
3. Optional: add a static fallback frame at `public/structures/<id>-whole.txt`
   (or `-pocket.txt`), 140 × 140 characters.
