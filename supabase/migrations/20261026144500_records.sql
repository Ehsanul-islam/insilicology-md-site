-- Simulation records, their files and tags, and the public read model.
--
-- Publication model (shared with blog posts in 0004):
--   * the row is the author's WORKING COPY; `status` describes where that copy is in review;
--   * `published_snapshot` is what the public sees, written only when an administrator approves;
--   * `is_public` says whether a snapshot is currently live.
-- Editing a live record sets it back to draft (revision) but leaves the snapshot untouched, so the
-- public page keeps showing the approved version until the revision is approved.
-- Anonymous visitors never read `records` directly; they read the public_records view.

create type public.moderation_status as enum
  ('draft', 'pending', 'changes_requested', 'published', 'rejected', 'unpublished');

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 200),
  description text check (char_length(description) <= 5000),
  doi text check (doi ~ '^10\.\d{4,9}/\S+$'),
  paper_url text check (paper_url ~* '^https?://'),
  citation text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_owner_idx on public.projects (owner_id);
create trigger projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

create table public.records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  type_id uuid references public.analysis_types (id),
  slug text not null unique,
  title text not null check (char_length(title) between 3 and 200),
  description text check (char_length(description) <= 5000),
  pdb_id text check (pdb_id ~ '^[0-9][A-Za-z0-9]{3}$'),
  protein_name text check (char_length(protein_name) <= 300),
  -- [{"kind":"ligand","name":"Testosterone","resn":"TES","pubchem_cid":6013}, ...]
  molecules jsonb not null default '[]'::jsonb check (jsonb_typeof(molecules) = 'array'),
  software text check (char_length(software) <= 100),
  software_version text check (char_length(software_version) <= 50),
  force_field text check (char_length(force_field) <= 100),
  length_ns numeric check (length_ns > 0),
  replicas int check (replicas >= 1),
  methodology text check (char_length(methodology) <= 10000),
  authors text[] not null default '{}',
  doi text check (doi ~ '^10\.\d{4,9}/\S+$'),
  paper_url text check (paper_url ~* '^https?://'),
  citation_bibtex text check (char_length(citation_bibtex) <= 5000),
  license text not null default 'CC-BY-4.0'
    check (license in ('CC-BY-4.0', 'CC-BY-SA-4.0', 'CC-BY-NC-4.0', 'CC0-1.0')),

  status public.moderation_status not null default 'draft',
  admin_feedback text,
  submitted_at timestamptz,
  is_public boolean not null default false,
  published_at timestamptz,
  published_snapshot jsonb,
  public_search tsvector,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_public or published_snapshot is not null)
);
create index records_owner_idx on public.records (owner_id, updated_at desc);
create index records_status_idx on public.records (status, submitted_at);
create index records_pdb_idx on public.records (pdb_id);
create index records_type_idx on public.records (type_id);
create index records_public_idx on public.records (published_at desc) where is_public;
create index records_search_idx on public.records using gin (public_search);
create index records_title_trgm_idx on public.records using gin ((published_snapshot ->> 'title') extensions.gin_trgm_ops);

create trigger records_touch before update on public.records
  for each row execute function public.touch_updated_at();

create table public.record_files (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references public.records (id) on delete cascade,
  kind text not null check (kind in
    ('xvg','csv','txt','dat','xpm','pdb','gro','xtc','trr','tpr','mol2','itp','png','svg','pdf','zip','other')),
  filename text not null check (char_length(filename) between 1 and 255),
  storage_path text not null,
  size_bytes bigint not null check (size_bytes > 0),
  sha256 text check (sha256 ~ '^[0-9a-f]{64}$'),
  caption text check (char_length(caption) <= 500),
  figure_kind text,
  -- downsampled series for the server-rendered SVG plot (see src/lib/xvg.ts)
  parsed jsonb,
  created_at timestamptz not null default now(),
  unique (record_id, storage_path)
);
create index record_files_record_idx on public.record_files (record_id);

create table public.record_tags (
  record_id uuid not null references public.records (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (record_id, tag_id)
);

-- Triggers ------------------------------------------------------------------------------------

create or replace function public.records_before_write() returns trigger
language plpgsql set search_path = '' as $$
declare
  base text;
  candidate text;
  n int := 1;
begin
  if new.pdb_id is not null then new.pdb_id := upper(new.pdb_id); end if;

  if tg_op = 'INSERT' then
    -- permanent URL slug: <pdb>-<ligand>, else the title; numbered if taken
    base := public.slugify(
      case when new.pdb_id is not null
        then new.pdb_id || '-' || coalesce(nullif(new.molecules -> 0 ->> 'resn', ''), new.title)
        else new.title end);
    if base = '' then base := 'record'; end if;
    candidate := base;
    while exists (select 1 from public.records where slug = candidate) loop
      n := n + 1;
      candidate := base || '-' || n;
    end loop;
    new.slug := candidate;
    return new;
  end if;

  -- UPDATE. Direct client calls run as `authenticated`; the review functions run as their owner.
  if current_user in ('authenticated', 'anon') then
    if new.owner_id is distinct from old.owner_id
       or new.slug is distinct from old.slug
       or new.status is distinct from old.status
       or new.admin_feedback is distinct from old.admin_feedback
       or new.submitted_at is distinct from old.submitted_at
       or new.is_public is distinct from old.is_public
       or new.published_at is distinct from old.published_at
       or new.published_snapshot is distinct from old.published_snapshot
       or new.public_search is distinct from old.public_search then
      raise exception 'status, publication and ownership can only be changed through the review functions'
        using errcode = '42501';
    end if;
    -- editing a live record starts a revision that must be approved before it replaces the snapshot
    if old.status = 'published' then
      new.status := case when public.is_admin() then 'pending' else 'draft' end;
    end if;
  end if;
  return new;
end $$;

create trigger records_before_write before insert or update on public.records
  for each row execute function public.records_before_write();

-- File and tag changes on a live record are revisions too.
create or replace function public.record_child_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  rid uuid := coalesce(new.record_id, old.record_id);
begin
  update public.records
     set status = case when public.is_admin() then 'pending'::public.moderation_status else 'draft'::public.moderation_status end,
         updated_at = now()
   where id = rid and status = 'published';
  return coalesce(new, old);
end $$;

create trigger record_files_changed after insert or update or delete on public.record_files
  for each row execute function public.record_child_changed();
create trigger record_tags_changed after insert or delete on public.record_tags
  for each row execute function public.record_child_changed();

-- Uploaded files must live under <owner>/<record>/ in the record-files bucket.
create or replace function public.record_files_check() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  owner uuid;
begin
  select r.owner_id into owner from public.records r where r.id = new.record_id;
  if new.storage_path not like owner::text || '/' || new.record_id::text || '/%' then
    raise exception 'file path must start with %/%/', owner, new.record_id using errcode = '23514';
  end if;
  return new;
end $$;
create trigger record_files_check before insert or update of storage_path on public.record_files
  for each row execute function public.record_files_check();

-- Row-level security -------------------------------------------------------------------------

-- Can the caller change this record's working copy right now?
create or replace function public.can_edit_record(rid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists (
    select 1 from public.records r
    where r.id = rid and r.owner_id = auth.uid() and public.is_active()
      and r.status in ('draft', 'changes_requested', 'rejected', 'unpublished', 'published')
  )
$$;

alter table public.projects enable row level security;
alter table public.records enable row level security;
alter table public.record_files enable row level security;
alter table public.record_tags enable row level security;

create policy projects_own on public.projects for all to authenticated
  using (owner_id = auth.uid() and public.is_active()) with check (owner_id = auth.uid() and public.is_active());
create policy projects_admin_read on public.projects for select to authenticated using (public.is_admin());

create policy records_read on public.records for select to authenticated
  using (owner_id = auth.uid() or public.is_admin());
create policy records_insert on public.records for insert to authenticated
  with check (owner_id = auth.uid() and public.is_active() and status = 'draft' and not is_public
              and published_snapshot is null and admin_feedback is null);
create policy records_update_own on public.records for update to authenticated
  using (owner_id = auth.uid() and public.is_active() and status in ('draft', 'changes_requested', 'rejected', 'unpublished', 'published'))
  with check (owner_id = auth.uid());
create policy records_update_admin on public.records for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy records_delete_own on public.records for delete to authenticated
  using (owner_id = auth.uid() and public.is_active() and not is_public and status in ('draft', 'rejected'));
create policy records_delete_admin on public.records for delete to authenticated using (public.is_admin());

create policy files_read on public.record_files for select to authenticated
  using (exists (select 1 from public.records r where r.id = record_id and (r.owner_id = auth.uid() or public.is_admin())));
create policy files_write on public.record_files for insert to authenticated with check (public.can_edit_record(record_id));
create policy files_update on public.record_files for update to authenticated
  using (public.can_edit_record(record_id)) with check (public.can_edit_record(record_id));
create policy files_delete on public.record_files for delete to authenticated using (public.can_edit_record(record_id));

create policy rtags_read on public.record_tags for select to authenticated
  using (exists (select 1 from public.records r where r.id = record_id and (r.owner_id = auth.uid() or public.is_admin())));
create policy rtags_write on public.record_tags for insert to authenticated with check (public.can_edit_record(record_id));
create policy rtags_delete on public.record_tags for delete to authenticated using (public.can_edit_record(record_id));

-- Anonymous visitors get no direct access to any of these tables.
revoke all on public.projects, public.records, public.record_files, public.record_tags from anon;

-- Tags are free-form: create the missing ones and return all of them.
create or replace function public.ensure_tags(names text[]) returns setof public.tags
language plpgsql security definer set search_path = '' as $$
declare
  n text;
begin
  if not public.is_active() then raise exception 'sign in to add tags' using errcode = '42501'; end if;
  foreach n in array names loop
    if public.slugify(n) <> '' then
      insert into public.tags (name, slug) values (left(trim(n), 60), public.slugify(n)) on conflict (slug) do nothing;
    end if;
  end loop;
  return query select t.* from public.tags t where t.slug = any (select public.slugify(x) from unnest(names) x);
end $$;

-- Public read model ---------------------------------------------------------------------------
-- Built from the approved snapshot, never from the working copy. Runs with the view owner's rights
-- (no security_invoker) so anonymous visitors can read it without any access to `records`.

create or replace view public.public_records as
select
  r.id,
  r.slug,
  s ->> 'title' as title,
  s ->> 'description' as description,
  s #>> '{type,slug}' as type_slug,
  s #>> '{type,name}' as type_name,
  s ->> 'pdb_id' as pdb_id,
  s ->> 'protein_name' as protein_name,
  coalesce(s -> 'molecules', '[]'::jsonb) as molecules,
  s ->> 'software' as software,
  s ->> 'software_version' as software_version,
  s ->> 'force_field' as force_field,
  (s ->> 'length_ns')::numeric as length_ns,
  (s ->> 'replicas')::int as replicas,
  s ->> 'methodology' as methodology,
  array(select jsonb_array_elements_text(coalesce(s -> 'authors', '[]'::jsonb))) as authors,
  s ->> 'doi' as doi,
  s ->> 'paper_url' as paper_url,
  s ->> 'citation_bibtex' as citation_bibtex,
  s ->> 'license' as license,
  s -> 'project' as project,
  array(select jsonb_array_elements_text(coalesce(s -> 'tags', '[]'::jsonb))) as tags,
  -- the plot series (`parsed`) is left out here to keep list queries small; see public_record_series
  coalesce((select jsonb_agg(fl - 'parsed') from jsonb_array_elements(s -> 'files') fl), '[]'::jsonb) as files,
  s ->> 'contributor' as contributor,
  r.published_at,
  (s ->> 'snapshot_at')::timestamptz as updated_at
from public.records r
cross join lateral (select r.published_snapshot as s) x
where r.is_public;

-- Plot data for the files of published records, fetched one record at a time by the record page.
create or replace view public.public_record_series as
select r.id as record_id, (fl ->> 'id')::uuid as file_id, fl -> 'parsed' as parsed
from public.records r
cross join lateral jsonb_array_elements(r.published_snapshot -> 'files') fl
where r.is_public and jsonb_typeof(fl -> 'parsed') = 'object';

create or replace view public.published_pdbs as
select
  pdb_id,
  max(protein_name) as protein_name,
  count(*)::int as complexes,
  array_agg(distinct lig) filter (where lig is not null) as ligands
from (
  select
    pr.pdb_id,
    pr.protein_name,
    (select string_agg(upper(m.v ->> 'resn'), '+' order by m.n)
       from jsonb_array_elements(pr.molecules) with ordinality as m(v, n)
      where m.v ->> 'kind' = 'ligand' and coalesce(m.v ->> 'resn', '') <> '') as lig
  from public.public_records pr
  where pr.pdb_id is not null
) q
group by pdb_id;

grant select on public.public_records, public.public_record_series, public.published_pdbs to anon, authenticated;

create or replace function public.search_records(
  q text default null, p_pdb text default null, p_type text default null, p_tag text default null,
  lim int default 24, off int default 0
) returns setof public.public_records
language sql stable security definer set search_path = '' as $$
  select pr.*
  from public.public_records pr
  join public.records r on r.id = pr.id
  where (p_pdb is null or pr.pdb_id = upper(p_pdb))
    and (p_type is null or pr.type_slug = (select (public.resolve_analysis_type(p_type)).slug))
    and (p_tag is null or public.slugify(p_tag) = any (pr.tags))
    and (coalesce(trim(q), '') = '' or r.public_search @@ websearch_to_tsquery('simple', q))
  order by
    case when coalesce(trim(q), '') = '' then null else ts_rank(r.public_search, websearch_to_tsquery('simple', q)) end desc nulls last,
    pr.published_at desc
  limit least(greatest(lim, 1), 100) offset greatest(off, 0)
$$;
