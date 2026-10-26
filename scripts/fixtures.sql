-- Builds one published record and one published post so the app's row mappers can be tested against the
-- real output of the public views. Used by scripts/gen-fixtures.sh.
do $$
declare o uuid := '00000000-0000-0000-0000-0000000000f1'; adm uuid := '00000000-0000-0000-0000-0000000000f2'; rid uuid; pid uuid; rmsd uuid; cat uuid; p text;
begin
  perform t.make_user(o, 'fx-owner@example.org'); perform t.make_user(adm, 'fx-admin@example.org', 'admin');
  update public.profiles set display_name = 'Dr Fixture' where id = o;
  select id into rmsd from public.analysis_types where slug = 'rmsd'; select id into cat from public.blog_categories where slug = 'methods';
  perform t.login(o);
  insert into public.records (owner_id, type_id, title, description, pdb_id, protein_name, molecules, software, software_version, force_field, length_ns, replicas, authors, doi, paper_url, citation_bibtex)
  values (o, rmsd, 'Testosterone in 3-alpha-HSD', 'Backbone and ligand RMSD over 100 ns.', '1afs', '3-alpha-hydroxysteroid dehydrogenase',
    '[{"kind":"ligand","name":"Testosterone","resn":"TES","pubchem_cid":6013},{"kind":"ligand","name":"NADP+","resn":"NAP"}]', 'GROMACS', '2024.2', 'CHARMM36', 100, 3, array['A. Author','B. Author'],
    '10.1000/example.1', 'https://example.org/paper', '@dataset{fixture, title={Fixture}}') returning id into rid;
  p := o || '/' || rid || '/';
  insert into public.record_files (record_id, kind, filename, storage_path, size_bytes, caption, figure_kind) values
    (rid, 'xvg', 'rmsd.xvg', p || 'rmsd.xvg', 5000, 'Backbone RMSD', 'rmsd'),
    (rid, 'png', 'rmsd.png', p || 'rmsd.png', 90000, null, 'rmsd'),
    (rid, 'xvg', 'rmsf.xvg', p || 'rmsf.xvg', 4000, null, 'rmsf'),
    (rid, 'xvg', 'untagged.xvg', p || 'untagged.xvg', 3000, null, null),
    (rid, 'pdb', 'start.pdb', p || 'start.pdb', 200000, null, null),
    (rid, 'xtc', 'traj.xtc', p || 'traj.xtc', 900000, null, null);
  perform public.ensure_tags(array['GROMACS','CHARMM36']);
  insert into public.record_tags (record_id, tag_id) select rid, id from public.tags where slug in ('gromacs','charmm36');
  perform public.submit_record(rid);
  insert into public.posts (owner_id, title, excerpt, content_md, category_id, refs)
  values (o, 'Setting up CHARMM36 in GROMACS', 'A practical walkthrough of the force field setup.', repeat('Body text. ', 40), cat,
          '[{"text":"Huang 2013","url":"https://doi.org/10.1002/jcc.23354"}]') returning id into pid;
  perform public.submit_post(pid);
  perform t.login(adm); perform public.approve_record(rid); perform public.approve_post(pid);
  perform t.root();
end $$;
