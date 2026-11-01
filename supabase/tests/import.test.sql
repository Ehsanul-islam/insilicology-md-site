-- Imported records: files with an external URL, published through the service-role-only function.
do $$
declare
  o constant uuid := '00000000-0000-0000-0000-00000000a951';
  rid uuid; p text;
begin
  perform t.make_user(o, 'imp-owner@example.org');
  insert into public.records (owner_id, simulation_type_id, title, pdb_id, protein_name, authors)
  values (o, (select id from public.simulation_types where slug = 'protein-ligand-complex'), 'Imported run', '2hbs', 'Sickle haemoglobin', array['Ehsanul Islam'])
  returning id into rid;
  p := o || '/' || rid || '/';
  insert into public.record_files (record_id, kind, filename, storage_path, size_bytes, analysis_type_id, external_url)
  values (rid, 'png', 'rmsd.jpg', p || 'images_JPG/rmsd.jpg', 1000, (select id from public.analysis_types where slug = 'rmsd'), 'https://cdn.jsdelivr.net/gh/x/y@abc/rmsd.jpg');
  perform t.fails(format($q$insert into public.record_files (record_id, kind, filename, storage_path, size_bytes, external_url) values (%L, 'png', 'a.png', %L, 10, 'http://insecure.example/a.png')$q$, rid, p || 'a.png'), '23514', 'external URLs must be https');

  perform t.is(has_function_privilege('anon', 'public.import_publish_record(uuid)', 'execute'), false, 'anon cannot import');
  perform t.is(has_function_privilege('authenticated', 'public.import_publish_record(uuid)', 'execute'), false, 'users cannot import');
  perform t.is(has_function_privilege('service_role', 'public.import_publish_record(uuid)', 'execute'), true, 'the service role can import');
  perform t.login(o);
  perform t.fails(format($q$select public.import_publish_record(%L)$q$, rid), '42501', 'owner cannot self-publish');
  perform t.service();
  perform public.import_publish_record(rid);
  perform t.anon();
  perform t.is((select title from public.public_records where id = rid), 'Imported run', 'the import is public');
  perform t.is((select analysis_slugs from public.public_records where id = rid), array['rmsd'], 'its analysis is listed');
  perform t.is((select files -> 0 ->> 'external_url' from public.public_records where id = rid), 'https://cdn.jsdelivr.net/gh/x/y@abc/rmsd.jpg', 'the snapshot carries the external URL');
  perform t.is((select type_slug from public.public_records where id = rid), 'rmsd', 'type_id points at the first analysis');
  perform t.is((select count(*) from public.search_records(p_pdb => '2hbs')), 1::bigint, 'search finds it');
  perform t.root();

  -- plot data stays out of the snapshot but is still served from the series view
  update public.record_files set parsed = '{"series":[{"legend":"","points":[[0,1],[1,2]]}]}' where record_id = rid;
  perform public.import_publish_record(rid);
  perform t.is((select published_snapshot -> 'files' -> 0 ? 'parsed' from public.records where id = rid), false, 'snapshot has no plot data');
  perform t.is((select published_snapshot -> 'files' -> 0 ->> 'has_plot' from public.records where id = rid), 'true', 'but says it has one');
  perform t.anon();
  perform t.is((select count(*) from public.public_record_series where record_id = rid), 1::bigint, 'the series view serves it');
  perform t.root();
end $$;
