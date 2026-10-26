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

## Backend (Supabase)

The site runs without a backend, on sample data. Connect Supabase to get accounts, moderated simulation
records and blog posts, a working contact form and real search.

### 1. Create the project and load the database

1. Create a project at [supabase.com](https://supabase.com).
2. On your computer, in this repo:

   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>   # the id in your project URL
   npx supabase db push                                  # applies supabase/migrations/*
   ```

   Migration files are named `<timestamp>_<name>.sql`. If your project was set up through the Supabase connector in
   Claude Code, the files already match the versions recorded on the project, so `db push` only applies what is new.

3. Load the default analysis types and blog categories: open the SQL Editor, paste the contents of
   `supabase/seed.sql` and run it (safe to run again).
4. Make yourself the first administrator. Sign up on the site first, then in the SQL Editor:

   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'you@example.org');
   ```

### 2. Environment variables

Copy `.env.example` to `.env.local` and set the Supabase URL, publishable key and **service role key**
(Project Settings > API). Set the same variables in Vercel (Project > Settings > Environment Variables).
The service role key bypasses row-level security: keep it server-side and never paste it into chat or commit it.

### 3. Auth settings (Authentication > URL Configuration)

- Site URL: your production URL.
- Redirect URLs: `https://<your-domain>/auth/callback` and `http://localhost:8080/auth/callback`.

### 4. Refresh public pages on approval (Database > Webhooks)

Public pages are cached for an hour. So that an approval shows up immediately, create a webhook for each of
the tables `records`, `posts`, `analysis_types` and `blog_categories` (events: insert, update, delete):
type *HTTP Request*, method `POST`, URL `https://<your-domain>/api/revalidate`, and an HTTP header
`x-revalidate-secret` equal to `REVALIDATE_SECRET`.

### 5. Storage limits

Supabase's project-wide upload limit also applies (50 MB on the free plan). Raise it under Project Settings >
Storage if you want to accept trajectory files.

### How publication works

- Records and posts are written by users and reviewed by an administrator. Nothing is public until approved.
- The public site reads the **approved snapshot** (`public_records`, `public_posts` views), never the author's
  working copy. Editing something that is live sends the edit back to review; the approved version stays up
  until the edit is approved.
- There are two category lists, both managed only by administrators. **Simulation types** say what is simulated or
  which method is used (apo protein, protein–ligand complex, membrane protein, umbrella sampling ...) and drive the
  home page, the search switch and `/simulation-types`. **Analysis types** say which analyses a record contains
  (RMSD, RMSF, SASA ...) and live under `/analysis`. Every record has one simulation type and its analyses.
  Both lists are defined in `src/lib/data/*-types.ts` and seeded with `npm run db:seed`.
- Only administrators create analysis types. Users can request one. Names, slugs and aliases are unique across
  types ("RMSD", "RMSD analysis" and "Protein RMSD" cannot become separate categories).
- Status changes go through database functions (`submit_*`, `approve_*`, `request_changes_*`, `reject_*`,
  `unpublish_*`) that check who is calling. Rules live in the database, not only in the UI.

Supabase's security advisor will flag the public views as "security definer" (an ERROR-level lint) and a few helper
functions as callable by signed-in users (WARN). Both are intentional: the views run with the owner's rights so
anonymous visitors can read approved content without any access to the underlying tables, and the helper and
review functions each check who is calling. Trigger and internal functions are locked down (`advisor_fixes` migration).

### Dashboard: uploading simulations

Signed-in users open **Dashboard > My simulations > New simulation**. A record has one simulation type and any
number of analyses (RMSD, RMSF ...), each with its own files. The editor shows a checklist that mirrors the rules
the database enforces on submit. Uploads go from the browser straight to Storage (a server action checks the file
first and issues a one-time upload URL), then the server reads `.xvg`/`.csv` data to build the plots shown on the
public record page. The record's web address is fixed when it is created (PDB ID + ligand, or the title).

Until the admin dashboard (Milestone 6) exists, approve a submitted record in the SQL Editor. The review functions
read the administrator from the JWT claim, so set it first:

```sql
select set_config('request.jwt.claim.sub', '<your admin user id>', true);
select public.approve_record('<record id>');
-- or: select public.request_changes_record('<record id>', 'what to fix');
```

Pending records: `select id, title, owner_id from public.records where status = 'pending';`

### Database tests

```bash
npm run db:test      # needs a Postgres 15+ superuser connection, e.g. PGHOST=localhost PGUSER=postgres
npm run db:seed      # regenerate supabase/seed.sql after editing src/lib/data/analysis-types.ts
npm run db:fixtures  # regenerate tests/fixtures after changing a public view
```

`db:test` builds a fresh database for every file in `supabase/tests/`, using a small stand-in for Supabase's roles
and `auth`/`storage` schemas (`supabase/tests/00_shim.sql`), and checks row-level security, the moderation
workflow, storage rules and the public views.
