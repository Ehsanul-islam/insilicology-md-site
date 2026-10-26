-- One record, many analyses. A record is one simulated system (one simulation type) with any number of
-- analyses (RMSD, RMSF, Rg ...). Each data file is tagged with the analysis it belongs to; a file with no
-- analysis is a supporting file (structure, trajectory, topology, document or archive).
--
-- Written without DROP statements, and advisor-clean: trigger functions are not executable by clients
-- and the new foreign key is indexed.

-- Files carry their analysis --------------------------------------------------------------------------

alter table public.record_files
  add column analysis_type_id uuid references public.analysis_types (id) on delete restrict;
create index record_files_analysis_idx on public.record_files (analysis_type_id);

-- The downsampled plot data is small by design (see src/lib/xvg.ts); refuse anything bigger.
alter table public.record_files
  add constraint record_files_parsed_size check (parsed is null or octet_length(parsed::text) <= 524288);

-- Upload rules, enforced here because clients can write record_files directly through the API.
--  * Client uploads must exist in Storage under the same path; the size Storage recorded wins over the
--    size the browser claimed.
--  * Analysis files must be a kind the analysis allows, within its size limit.
--  * Supporting files are structures, trajectories, topologies, documents and archives.
-- Direct SQL (migrations, the SQL editor, the service role) is trusted and skips the Storage check.
-- Runs as the caller (not security definer) so `current_user` tells client calls apart; the owner can read
-- their own Storage objects, and admins all of them.
create or replace function public.record_files_rules() returns trigger
language plpgsql set search_path = '' as $$
declare
  stored bigint;
  a public.analysis_types;
  max_mb numeric;
  supporting constant text[] := array['pdb','gro','xtc','trr','tpr','mol2','itp','png','svg','pdf','zip','txt','other'];
begin
  if current_user in ('authenticated', 'anon') then
    -- answer "not allowed" before saying anything about Storage (row-level security runs after this trigger)
    if not public.can_edit_record(new.record_id) then
      raise exception 'you cannot change the files of this record' using errcode = '42501';
    end if;
    select (o.metadata ->> 'size')::bigint into stored
      from storage.objects o where o.bucket_id = 'record-files' and o.name = new.storage_path;
    if not found then
      raise exception 'upload the file before adding it to the record' using errcode = '23514';
    end if;
    if stored is not null then new.size_bytes := stored; end if;
  end if;

  if new.analysis_type_id is null then
    if not new.kind = any (supporting) then
      raise exception '.% files belong to an analysis; choose which one', new.kind using errcode = '23514';
    end if;
    max_mb := 500;
  else
    select * into a from public.analysis_types where id = new.analysis_type_id and status = 'active';
    if not found then raise exception 'this analysis is not available' using errcode = '23514'; end if;
    if not (coalesce(a.file_rules -> 'allowed', '[]'::jsonb) ? new.kind) then
      raise exception '% does not accept .% files', a.name, new.kind using errcode = '23514';
    end if;
    max_mb := coalesce((a.file_rules ->> 'max_mb')::numeric, 50);
  end if;
  if new.size_bytes > max_mb * 1024 * 1024 then
    raise exception 'this file is larger than the % MB limit', max_mb using errcode = '23514';
  end if;
  return new;
end $$;

create trigger record_files_rules before insert or update of kind, size_bytes, analysis_type_id, storage_path
  on public.record_files for each row execute function public.record_files_rules();

-- Abuse guards: generous for real use, small enough to stop a script filling the database.
-- Runs as the caller: row-level security already limits the counts to the caller's own rows.
create or replace function public.record_limits() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if tg_table_name = 'records' then
    if (select count(*) from public.records where owner_id = new.owner_id) >= 200 then
      raise exception 'you have reached the limit of 200 records; contact us if you need more' using errcode = '54000';
    end if;
  elsif (select count(*) from public.record_files where record_id = new.record_id) >= 100 then
    raise exception 'a record can hold at most 100 files' using errcode = '54000';
  end if;
  return new;
end $$;

create trigger records_limit before insert on public.records
  for each row execute function public.record_limits();
create trigger record_files_limit before insert on public.record_files
  for each row execute function public.record_limits();

revoke execute on function public.record_files_rules(), public.record_limits() from public, anon, authenticated;

-- Snapshot: files name their analysis, and the record lists its analyses ------------------------------

create or replace function public._record_snapshot(r public.records) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'title', r.title,
    'description', r.description,
    'type', (select jsonb_build_object('slug', t.slug, 'name', t.name) from public.analysis_types t where t.id = r.type_id),
    'simulation_type', (select jsonb_build_object('slug', s.slug, 'name', s.name) from public.simulation_types s where s.id = r.simulation_type_id),
    'analyses', (select coalesce(jsonb_agg(jsonb_build_object('slug', x.slug, 'name', x.name) order by x.sort_order, x.name), '[]'::jsonb)
                   from (select distinct a.slug, a.name, a.sort_order
                           from public.record_files f join public.analysis_types a on a.id = f.analysis_type_id
                          where f.record_id = r.id) x),
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
                'size_bytes', f.size_bytes, 'caption', f.caption, 'figure_kind', f.figure_kind,
                'analysis_slug', a.slug, 'analysis_name', a.name, 'parsed', f.parsed
              ) order by f.created_at, f.id), '[]'::jsonb)
                from public.record_files f left join public.analysis_types a on a.id = f.analysis_type_id
               where f.record_id = r.id),
    'contributor', (select p.display_name from public.profiles p where p.id = r.owner_id),
    'snapshot_at', now()
  )
$$;

-- Submitting: a simulation type, at least one analysis, and each analysis's required files -------------

create or replace function public.submit_record(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.records;
  st public.simulation_types;
  a public.analysis_types;
  first_analysis uuid;
  need text;
begin
  select * into r from public.records where id = p_id for update;
  if not found or r.owner_id <> auth.uid() then raise exception 'record not found' using errcode = 'P0002'; end if;
  if not public.is_active() then raise exception 'this account is restricted' using errcode = '42501'; end if;
  if r.status not in ('draft', 'changes_requested', 'rejected', 'unpublished') then
    raise exception 'a record that is % cannot be submitted', r.status using errcode = '55000';
  end if;

  if r.simulation_type_id is null then raise exception 'choose a simulation type' using errcode = '23514'; end if;
  select * into st from public.simulation_types where id = r.simulation_type_id and status = 'active';
  if not found then raise exception 'this simulation type is no longer available' using errcode = '23514'; end if;
  if st.requires_structure and r.pdb_id is null then
    raise exception 'a PDB ID is required for % records', st.name using errcode = '23514';
  end if;

  for a in
    select distinct t.* from public.analysis_types t
      join public.record_files f on f.analysis_type_id = t.id
     where f.record_id = r.id
     order by t.sort_order, t.name
  loop
    first_analysis := coalesce(first_analysis, a.id);
    if a.status <> 'active' then
      raise exception 'the analysis % is no longer available; move its files to another analysis', a.name using errcode = '23514';
    end if;
    for need in select jsonb_array_elements_text(coalesce(a.file_rules -> 'required', '[]'::jsonb)) loop
      if not exists (select 1 from public.record_files where record_id = r.id and analysis_type_id = a.id and kind = need) then
        raise exception '% needs a .% file', a.name, need using errcode = '23514';
      end if;
    end loop;
    if a.field_schema ->> 'citation' = 'required' and r.doi is null and r.paper_url is null then
      raise exception 'add the DOI or link of the paper' using errcode = '23514';
    end if;
    if a.field_schema ->> 'molecules' = 'required' and jsonb_array_length(r.molecules) = 0 then
      raise exception 'describe the molecular system' using errcode = '23514';
    end if;
  end loop;
  if first_analysis is null then
    raise exception 'add at least one analysis with its data files' using errcode = '23514';
  end if;

  -- type_id keeps meaning "primary analysis" for the existing type_slug / type_name columns
  update public.records
     set type_id = first_analysis, status = 'pending', submitted_at = now(), admin_feedback = null
   where id = p_id;
  perform public._log_review('record', p_id, 'submitted', null);
end $$;

-- Approval: the search index also covers the simulation type and every analysis ------------------------

create or replace function public.approve_record(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.records;
  snap jsonb;
begin
  perform public._require_admin();
  select * into r from public.records where id = p_id for update;
  if not found then raise exception 'record not found' using errcode = 'P0002'; end if;
  if r.status <> 'pending' then raise exception 'only a pending record can be approved' using errcode = '55000'; end if;

  snap := public._record_snapshot(r);
  update public.records set
    status = 'published',
    is_public = true,
    published_at = coalesce(published_at, now()),
    published_snapshot = snap,
    admin_feedback = null,
    public_search =
      setweight(to_tsvector('simple', coalesce(snap ->> 'title', '') || ' ' || coalesce(snap ->> 'pdb_id', '')), 'A') ||
      setweight(to_tsvector('simple', coalesce(snap ->> 'protein_name', '') || ' ' || coalesce(snap #>> '{simulation_type,name}', '') || ' '
        || coalesce((select string_agg(x ->> 'name', ' ') from jsonb_array_elements(snap -> 'analyses') x), '') || ' '
        || coalesce((select string_agg(m ->> 'name', ' ') from jsonb_array_elements(snap -> 'molecules') m), '')), 'B') ||
      setweight(to_tsvector('simple', coalesce((select string_agg(x, ' ') from jsonb_array_elements_text(snap -> 'tags') x), '') || ' '
        || coalesce(snap ->> 'force_field', '') || ' ' || coalesce(snap ->> 'software', '')), 'C') ||
      setweight(to_tsvector('simple', coalesce(snap ->> 'description', '') || ' '
        || coalesce((select string_agg(x, ' ') from jsonb_array_elements_text(snap -> 'authors') x), '')), 'D')
  where id = p_id;
  perform public._log_review('record', p_id, 'approved', null);
  perform public._notify(r.owner_id, 'record_approved', 'Your simulation was published', r.title, '/simulations/' || r.slug);
end $$;

-- Public read model: two columns appended at the end (existing columns are unchanged) -------------------

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
  s #>> '{simulation_type,name}' as sim_type_name,
  array(select x ->> 'slug' from jsonb_array_elements(coalesce(s -> 'analyses', '[]'::jsonb)) x) as analysis_slugs,
  array(select x ->> 'name' from jsonb_array_elements(coalesce(s -> 'analyses', '[]'::jsonb)) x) as analysis_names
from public.records r
cross join lateral (select r.published_snapshot as s) x
where r.is_public;

-- Search by analysis matches any analysis in the record, not only the primary one.
create or replace function public.search_records(
  q text default null, p_pdb text default null, p_type text default null, p_tag text default null,
  lim int default 24, off int default 0
) returns setof public.public_records
language sql stable security definer set search_path = '' as $$
  select pr.*
  from public.public_records pr
  join public.records r on r.id = pr.id
  where (p_pdb is null or pr.pdb_id = upper(p_pdb))
    and (p_type is null or (select (public.resolve_analysis_type(p_type)).slug) = any (pr.analysis_slugs)
         or pr.type_slug = (select (public.resolve_analysis_type(p_type)).slug))
    and (p_tag is null or public.slugify(p_tag) = any (pr.tags))
    and (coalesce(trim(q), '') = '' or r.public_search @@ websearch_to_tsquery('simple', q))
  order by
    case when coalesce(trim(q), '') = '' then null else ts_rank(r.public_search, websearch_to_tsquery('simple', q)) end desc nulls last,
    pr.published_at desc
  limit least(greatest(lim, 1), 100) offset greatest(off, 0)
$$;
