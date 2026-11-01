-- Support for importing records whose files live outside Storage (the MD_Simulation_Database folder in the
-- GitHub repository). Written without DROP statements.
--
--  * record_files.external_url: where a file is served from when it has no Storage object. storage_path keeps a
--    logical <owner>/<record>/<path> key, because record_files_check still requires that prefix.
--  * _record_snapshot carries external_url, so the public view and the site can link to it.
--  * import_publish_record(): publishes a record the way approve_record does, but for the service role only
--    (the import Edge Function), so no administrator JWT is needed.

alter table public.record_files add column external_url text check (external_url ~ '^https://');

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
                'analysis_slug', a.slug, 'analysis_name', a.name, 'external_url', f.external_url, 'parsed', f.parsed
              ) order by f.created_at, f.id), '[]'::jsonb)
                from public.record_files f left join public.analysis_types a on a.id = f.analysis_type_id
               where f.record_id = r.id),
    'contributor', (select p.display_name from public.profiles p where p.id = r.owner_id),
    'snapshot_at', now()
  )
$$;

create or replace function public.import_publish_record(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.records;
  snap jsonb;
  first_analysis uuid;
begin
  select * into r from public.records where id = p_id for update;
  if not found then raise exception 'record not found' using errcode = 'P0002'; end if;

  select a.id into first_analysis
    from public.record_files f join public.analysis_types a on a.id = f.analysis_type_id
   where f.record_id = p_id order by a.sort_order, a.name limit 1;
  update public.records set type_id = first_analysis where id = p_id;
  select * into r from public.records where id = p_id;

  snap := public._record_snapshot(r);
  update public.records set
    status = 'published',
    is_public = true,
    submitted_at = coalesce(submitted_at, now()),
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
end $$;

revoke execute on function public.import_publish_record(uuid) from public, anon, authenticated;
grant execute on function public.import_publish_record(uuid) to service_role;
