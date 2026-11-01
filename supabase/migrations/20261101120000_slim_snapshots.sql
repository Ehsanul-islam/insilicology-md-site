-- Keep plot data out of the published snapshot.
--
-- The snapshot used to carry every file's `parsed` plot series, so reading anything from public_records meant
-- decompressing megabytes per row (about one second for the imported dataset, which exceeded the anonymous
-- role's statement timeout when a build ran several queries at once). The plot series now stay in
-- record_files; public_record_series reads them from there for the files of the published snapshot.

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
                'analysis_slug', a.slug, 'analysis_name', a.name, 'external_url', f.external_url, 'has_plot', f.parsed is not null
              ) order by f.created_at, f.id), '[]'::jsonb)
                from public.record_files f left join public.analysis_types a on a.id = f.analysis_type_id
               where f.record_id = r.id),
    'contributor', (select p.display_name from public.profiles p where p.id = r.owner_id),
    'snapshot_at', now()
  )
$$;

create or replace view public.public_record_series as
select r.id as record_id, f.id as file_id, f.parsed
from public.records r
join public.record_files f on f.record_id = r.id
where r.is_public
  and jsonb_typeof(f.parsed) = 'object'
  and exists (select 1 from jsonb_array_elements(r.published_snapshot -> 'files') fl where fl ->> 'id' = f.id::text);

-- Rewrite the snapshots that already exist (published before this migration).
update public.records
   set published_snapshot = jsonb_set(
         published_snapshot, '{files}',
         (select coalesce(jsonb_agg(fl - 'parsed'), '[]'::jsonb) from jsonb_array_elements(published_snapshot -> 'files') fl))
 where published_snapshot -> 'files' is not null;
