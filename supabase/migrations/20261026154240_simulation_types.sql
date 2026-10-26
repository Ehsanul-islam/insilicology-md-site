-- Simulation types: WHAT is simulated or which method is used (apo protein, protein–ligand complex,
-- membrane protein, umbrella sampling ...). This is a second list next to analysis_types, which says
-- WHICH ANALYSES a record contains (RMSD, RMSF, ...). A record has one simulation type and its analyses.
--
-- Written without DROP statements, and with the advisor findings from the first deployment in mind:
-- admin write policies are separate from the read policy, trigger functions are not executable by
-- clients, and foreign keys are indexed.

-- Simulation types ---------------------------------------------------------------------------------

create table public.simulation_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 120),
  aliases text[] not null default '{}',
  summary text not null default '',
  -- Page copy for the /simulation-types/[slug] hub, one paragraph per element. Edited by admins.
  intro text[] not null default '{}',
  requires_structure boolean not null default true,
  status public.type_status not null default 'active',
  sort_order int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger simulation_types_touch before update on public.simulation_types
  for each row execute function public.touch_updated_at();

-- Every slug, name and alias, normalised. The primary key stops two types claiming the same alias, so
-- "Apo", "Apo protein" and "Unbound protein" can never become separate categories.
create table public.simulation_type_keys (
  key text primary key,
  type_id uuid not null references public.simulation_types (id) on delete cascade
);
create index simulation_type_keys_type_idx on public.simulation_type_keys (type_id);

create or replace function public.simulation_types_sync_keys() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  k text;
begin
  delete from public.simulation_type_keys where type_id = new.id;
  for k in
    select distinct public.normalise_key(x) from unnest(array[new.slug, new.name] || new.aliases) as x
  loop
    if k <> '' then
      begin
        insert into public.simulation_type_keys (key, type_id) values (k, new.id);
      exception when unique_violation then
        raise exception 'the name, slug or alias "%" is already used by another simulation type', k using errcode = '23505';
      end;
    end if;
  end loop;
  return new;
end $$;

create trigger simulation_types_sync_keys after insert or update of slug, name, aliases on public.simulation_types
  for each row execute function public.simulation_types_sync_keys();

-- Free text (slug, name or alias) to its canonical simulation type.
create or replace function public.resolve_simulation_type(q text) returns public.simulation_types
language sql stable security definer set search_path = '' as $$
  select t.* from public.simulation_type_keys k
  join public.simulation_types t on t.id = k.type_id
  where k.key = public.normalise_key(q) and t.status = 'active'
$$;

-- Trigger functions are not meant to be called through the API.
revoke execute on function public.simulation_types_sync_keys() from public, anon, authenticated;

-- Row-level security ---------------------------------------------------------------------------------
alter table public.simulation_types enable row level security;
alter table public.simulation_type_keys enable row level security;

create policy simulation_types_read on public.simulation_types for select to anon, authenticated
  using (status = 'active' or public.is_admin());
create policy simulation_types_admin_insert on public.simulation_types for insert to authenticated
  with check (public.is_admin());
create policy simulation_types_admin_update on public.simulation_types for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy simulation_types_admin_delete on public.simulation_types for delete to authenticated
  using (public.is_admin());

-- Lookup keys are internal; only the SECURITY DEFINER functions touch them.
revoke all on public.simulation_type_keys from anon, authenticated;
create policy simulation_type_keys_no_access on public.simulation_type_keys for all to anon, authenticated
  using (false);

create trigger simulation_types_audit after insert or update or delete on public.simulation_types
  for each row execute function public.audit_row_change();

-- Records and requests ----------------------------------------------------------------------------------

alter table public.records
  add column simulation_type_id uuid references public.simulation_types (id) on delete set null;
create index records_simulation_type_idx on public.records (simulation_type_id);

-- Users can ask for either kind of category.
alter table public.type_requests
  add column kind text not null default 'simulation' check (kind in ('simulation', 'analysis'));

-- The approved snapshot carries the simulation type too.
create or replace function public._record_snapshot(r public.records) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'title', r.title,
    'description', r.description,
    'type', (select jsonb_build_object('slug', t.slug, 'name', t.name) from public.analysis_types t where t.id = r.type_id),
    'simulation_type', (select jsonb_build_object('slug', s.slug, 'name', s.name) from public.simulation_types s where s.id = r.simulation_type_id),
    'pdb_id', r.pdb_id,
    'protein_name', r.protein_name,
    'molecules', r.molecules,
    'software', r.software,
    'software_version', r.software_version,
    'force_field', r.force_field,
    'length_ns', r.length_ns,
    'replicas', r.replicas,
    'methodology', r.methodology,
    'authors', to_jsonb(r.authors),
    'doi', r.doi,
    'paper_url', r.paper_url,
    'citation_bibtex', r.citation_bibtex,
    'license', r.license,
    'project', (select jsonb_build_object('title', p.title, 'doi', p.doi, 'paper_url', p.paper_url)
                  from public.projects p where p.id = r.project_id),
    'tags', (select coalesce(jsonb_agg(t.slug order by t.slug), '[]'::jsonb)
               from public.record_tags rt join public.tags t on t.id = rt.tag_id where rt.record_id = r.id),
    'files', (select coalesce(jsonb_agg(jsonb_build_object(
                'id', f.id, 'kind', f.kind, 'filename', f.filename, 'storage_path', f.storage_path,
                'size_bytes', f.size_bytes, 'caption', f.caption, 'figure_kind', f.figure_kind, 'parsed', f.parsed
              ) order by f.created_at, f.id), '[]'::jsonb)
                from public.record_files f where f.record_id = r.id),
    'contributor', (select p.display_name from public.profiles p where p.id = r.owner_id),
    'snapshot_at', now()
  )
$$;

-- A record needs a simulation type to be submitted, as well as its analysis type.
create or replace function public.submit_record(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.records;
  t public.analysis_types;
  need text;
begin
  select * into r from public.records where id = p_id for update;
  if not found or r.owner_id <> auth.uid() then raise exception 'record not found' using errcode = 'P0002'; end if;
  if not public.is_active() then raise exception 'this account is restricted' using errcode = '42501'; end if;
  if r.status not in ('draft', 'changes_requested', 'rejected', 'unpublished') then
    raise exception 'a record that is % cannot be submitted', r.status using errcode = '55000';
  end if;

  if r.simulation_type_id is null then raise exception 'choose a simulation type' using errcode = '23514'; end if;
  if not exists (select 1 from public.simulation_types where id = r.simulation_type_id and status = 'active') then
    raise exception 'this simulation type is no longer available' using errcode = '23514';
  end if;
  if r.type_id is null then raise exception 'choose an analysis type' using errcode = '23514'; end if;
  select * into t from public.analysis_types where id = r.type_id and status = 'active';
  if not found then raise exception 'this analysis type is no longer available' using errcode = '23514'; end if;
  if t.requires_structure and r.pdb_id is null then
    raise exception 'a PDB ID is required for % records', t.name using errcode = '23514';
  end if;
  if not exists (select 1 from public.record_files where record_id = r.id) then
    raise exception 'upload at least one data file' using errcode = '23514';
  end if;
  for need in select jsonb_array_elements_text(coalesce(t.file_rules -> 'required', '[]'::jsonb)) loop
    if not exists (select 1 from public.record_files where record_id = r.id and kind = need) then
      raise exception '% records need a .% file', t.name, need using errcode = '23514';
    end if;
  end loop;
  if t.field_schema ->> 'citation' = 'required' and r.doi is null and r.paper_url is null then
    raise exception 'add the DOI or link of the paper' using errcode = '23514';
  end if;
  if t.field_schema ->> 'molecules' = 'required' and jsonb_array_length(r.molecules) = 0 then
    raise exception 'describe the molecular system' using errcode = '23514';
  end if;

  update public.records set status = 'pending', submitted_at = now(), admin_feedback = null where id = p_id;
  perform public._log_review('record', p_id, 'submitted', null);
end $$;

-- Public read model: two columns appended at the end of the view (existing columns are unchanged).
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
  (s ->> 'snapshot_at')::timestamptz as updated_at,
  s #>> '{simulation_type,slug}' as sim_type_slug,
  s #>> '{simulation_type,name}' as sim_type_name
from public.records r
cross join lateral (select r.published_snapshot as s) x
where r.is_public;
