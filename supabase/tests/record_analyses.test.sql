-- One record, many analyses: file rules, Storage checks, limits, submit rules and the public read model.
do $$
declare
  o   constant uuid := '00000000-0000-0000-0000-00000000a901';
  o2  constant uuid := '00000000-0000-0000-0000-00000000b901';
  adm constant uuid := '00000000-0000-0000-0000-00000000ad09';
  plc uuid; pep uuid; rmsd uuid; rmsf uuid;
  rid uuid; rid2 uuid; fid uuid; i int; p text;
begin
  perform t.make_user(o, 'an-owner@example.org');
  perform t.make_user(o2, 'an-other@example.org');
  perform t.make_user(adm, 'an-admin@example.org', 'admin');
  select id into plc from public.simulation_types where slug = 'protein-ligand-complex';
  select id into pep from public.simulation_types where slug = 'peptide';
  select id into rmsd from public.analysis_types where slug = 'rmsd';
  select id into rmsf from public.analysis_types where slug = 'rmsf';

  perform t.login(o);
  insert into public.records (owner_id, simulation_type_id, title, pdb_id, molecules)
  values (o, plc, 'Two analyses', '3htb', '[{"kind":"ligand","name":"Ligand","resn":"JZ4"}]') returning id into rid;
  p := o || '/' || rid || '/';

  -- Storage is the source of truth for files ------------------------------------------------------
  perform t.fails(format($q$insert into public.record_files (record_id, kind, filename, storage_path, size_bytes, analysis_type_id) values (%L, 'xvg', 'ghost.xvg', %L, 10, %L)$q$, rid, p || 'ghost.xvg', rmsd),
    '23514', 'a file that was never uploaded is refused');
  perform t.put(p || 'real.xvg', 4321);
  insert into public.record_files (record_id, kind, filename, storage_path, size_bytes, analysis_type_id)
  values (rid, 'xvg', 'real.xvg', p || 'real.xvg', 1, rmsd) returning id into fid;
  perform t.is((select size_bytes from public.record_files where id = fid), 4321::bigint, 'the size comes from Storage, not the browser');
  update public.record_files set size_bytes = 2 where id = fid;
  perform t.is((select size_bytes from public.record_files where id = fid), 4321::bigint, 'and cannot be rewritten later');

  -- per-analysis rules --------------------------------------------------------------------------------
  perform t.put(p || 'traj.xtc', 1000);
  perform t.fails(format($q$insert into public.record_files (record_id, kind, filename, storage_path, size_bytes, analysis_type_id) values (%L, 'xtc', 'traj.xtc', %L, 1000, %L)$q$, rid, p || 'traj.xtc', rmsd),
    '23514', 'RMSD does not accept trajectories');
  perform t.put(p || 'big.xvg', 51 * 1024 * 1024);
  perform t.fails(format($q$insert into public.record_files (record_id, kind, filename, storage_path, size_bytes, analysis_type_id) values (%L, 'xvg', 'big.xvg', %L, 10, %L)$q$, rid, p || 'big.xvg', rmsd),
    '23514', 'files over the analysis size limit are refused');
  perform t.put(p || 'loose.xvg', 100);
  perform t.fails(format($q$insert into public.record_files (record_id, kind, filename, storage_path, size_bytes) values (%L, 'xvg', 'loose.xvg', %L, 100)$q$, rid, p || 'loose.xvg'),
    '23514', 'data files must name their analysis');
  perform t.file(rid, 'xtc', 'traj.xtc');
  perform t.file(rid, 'pdb', 'start.pdb');
  perform t.is((select count(*) from public.record_files where record_id = rid and analysis_type_id is null), 2::bigint, 'supporting files need no analysis');
  perform t.fails(format($q$update public.record_files set parsed = jsonb_build_object('junk', repeat('x', 600000)) where id = %L$q$, fid),
    '23514', 'oversized plot data is refused');
  perform t.root();
  update public.analysis_types set status = 'archived' where id = rmsf;
  perform t.login(o);
  perform t.put(p || 'rmsf.xvg', 100);
  perform t.fails(format($q$insert into public.record_files (record_id, kind, filename, storage_path, size_bytes, analysis_type_id) values (%L, 'xvg', 'rmsf.xvg', %L, 100, %L)$q$, rid, p || 'rmsf.xvg', rmsf),
    '23514', 'an archived analysis takes no new files');
  perform t.root();
  update public.analysis_types set status = 'active' where id = rmsf;

  -- other users and the owner's rights ------------------------------------------------------------------
  perform t.login(o2);
  perform t.put(p || 'evil.xvg', 100);
  perform t.fails(format($q$insert into public.record_files (record_id, kind, filename, storage_path, size_bytes, analysis_type_id) values (%L, 'xvg', 'evil.xvg', %L, 100, %L)$q$, rid, p || 'evil.xvg', rmsd),
    '42501', 'another user cannot add files, even when the object exists');

  -- submit rules ------------------------------------------------------------------------------------------
  perform t.login(o);
  perform t.file(rid, 'csv', 'rmsf.csv', 'rmsf', 100);
  perform t.fails(format($q$select public.submit_record(%L)$q$, rid), '23514', 'every analysis needs its required files');
  begin perform public.submit_record(rid); exception when others then perform t.is(sqlerrm, 'RMSF analysis needs a .xvg file', 'names the analysis missing a file'); end;
  perform t.file(rid, 'xvg', 'rmsf.xvg', 'rmsf', 100);
  perform public.submit_record(rid);
  perform t.is((select status::text from public.records where id = rid), 'pending', 'two complete analyses submit');
  perform t.is((select t2.slug from public.records r join public.analysis_types t2 on t2.id = r.type_id where r.id = rid), 'rmsd', 'type_id is set to the first analysis');

  -- only supporting files: no analysis yet
  insert into public.records (owner_id, simulation_type_id, title, molecules) values (o, pep, 'Peptide folding', '[{"kind":"peptide","name":"Trp-cage"}]') returning id into rid2;
  perform t.file(rid2, 'pdb', 'start.pdb');
  perform t.fails(format($q$select public.submit_record(%L)$q$, rid2), '23514', 'supporting files alone are not enough');
  perform t.file(rid2, 'xvg', 'rg.xvg', 'radius-of-gyration', 200, '{"title":"Rg","series":[{"legend":"","points":[[0,1],[1,1.1]]}]}');
  perform public.submit_record(rid2);
  perform t.is((select status::text from public.records where id = rid2), 'pending', 'a peptide record needs no PDB ID');

  -- publication -------------------------------------------------------------------------------------------
  perform t.login(adm);
  perform public.approve_record(rid);
  perform public.approve_record(rid2);
  perform t.anon();
  perform t.is((select analysis_slugs from public.public_records where id = rid), array['rmsd', 'rmsf'], 'analyses in display order');
  perform t.is((select analysis_names from public.public_records where id = rid), array['RMSD analysis', 'RMSF analysis'], 'analysis names');
  perform t.is((select count(*) from jsonb_array_elements((select files from public.public_records where id = rid)) f where f ->> 'analysis_slug' = 'rmsf'), 2::bigint, 'files name their analysis');
  perform t.is((select count(*) from jsonb_array_elements((select files from public.public_records where id = rid)) f where f ->> 'analysis_slug' is null), 2::bigint, 'supporting files have none');
  perform t.is((select pdb_id from public.public_records where id = rid2), null::text, 'record without a PDB ID is public');
  perform t.is((select count(*) from public.published_pdbs where pdb_id is null), 0::bigint, 'and does not appear as a PDB entry');
  perform t.is((select count(*) from public.search_records(p_type => 'rmsf')), 1::bigint, 'search finds a secondary analysis');
  perform t.is((select count(*) from public.search_records(p_type => 'Rg')), 1::bigint, 'search by analysis alias');
  perform t.is((select count(*) from public.search_records(q => 'trp-cage')), 1::bigint, 'full-text search covers molecule names');
  perform t.is((select count(*) from public.search_records(q => 'peptide')), 1::bigint, 'full-text search covers the simulation type');
  perform t.is((select parsed ->> 'title' from public.public_record_series where record_id = rid2), 'Rg', 'plot data is public');

  -- changing a file's analysis on a live record starts a revision
  perform t.login(o);
  update public.record_files set analysis_type_id = rmsd where record_id = rid and filename = 'rmsf.csv';
  perform t.is((select status::text from public.records where id = rid), 'draft', 'moving a file to another analysis is a revision');
  perform t.anon();
  perform t.is((select analysis_slugs from public.public_records where id = rid), array['rmsd', 'rmsf'], 'the public copy is unchanged');

  -- limits ---------------------------------------------------------------------------------------------------
  perform t.login(o2);
  insert into public.records (owner_id, simulation_type_id, title) select o2, pep, 'Bulk ' || g from generate_series(1, 199) g;
  perform t.is((select count(*) from public.records where owner_id = o2), 199::bigint, '199 records are fine');
  insert into public.records (owner_id, simulation_type_id, title) values (o2, pep, 'Number 200');
  perform t.fails(format($q$insert into public.records (owner_id, simulation_type_id, title) values (%L, %L, 'One too many')$q$, o2, pep), '54000', 'record limit per user');
  select id into rid from public.records where owner_id = o2 and title = 'Number 200';
  for i in 1..100 loop perform t.file(rid, 'pdb', 'f' || i || '.pdb', null, 10); end loop;
  perform t.put(o2 || '/' || rid || '/f101.pdb', 10);
  perform t.fails(format($q$insert into public.record_files (record_id, kind, filename, storage_path, size_bytes) values (%L, 'pdb', 'f101.pdb', %L, 10)$q$, rid, o2 || '/' || rid || '/f101.pdb'), '54000', 'file limit per record');
  perform t.root();
  insert into public.records (owner_id, simulation_type_id, title) values (o2, pep, 'Admins and migrations are not limited');
  perform t.is((select count(*) from public.records where owner_id = o2), 201::bigint, 'direct SQL is not limited');
end $$;
