do $$
declare
  u   constant uuid := '00000000-0000-0000-0000-00000000a801';
  adm constant uuid := '00000000-0000-0000-0000-00000000ad09';
  rst constant uuid := '00000000-0000-0000-0000-00000000c801';
  rmsd uuid; apo uuid; sim_new uuid; rid uuid; fn text; n bigint;
begin
  perform t.make_user(u, 'sim-user@example.org');
  perform t.make_user(adm, 'sim-admin@example.org', 'admin');
  perform t.make_user(rst, 'sim-restricted@example.org', 'user', 'restricted');
  select id into rmsd from public.analysis_types where slug = 'rmsd';
  select id into apo from public.simulation_types where slug = 'apo-protein';

  -- the seed ------------------------------------------------------------------------------------------
  perform t.is((select count(*) from public.simulation_types where status = 'active'), 14::bigint, 'fourteen simulation types are seeded');
  foreach fn in array array['apo-protein', 'protein-ligand-complex', 'protein-protein-complex', 'membrane-protein', 'protein-dna-rna-complex',
                            'peptide', 'nucleic-acid', 'umbrella-sampling', 'metadynamics', 'replica-exchange', 'steered-md',
                            'free-energy-perturbation', 'coarse-grained', 'other'] loop
    perform t.ok(exists (select 1 from public.simulation_types where slug = fn), 'seeded: ' || fn);
  end loop;
  perform t.ok((select min(cardinality(intro)) from public.simulation_types) >= 2, 'every type has page copy');

  -- aliases resolve to one canonical type, ignoring case and punctuation -----------------------------------
  perform t.is((public.resolve_simulation_type('Apo')).slug, 'apo-protein', 'Apo');
  perform t.is((public.resolve_simulation_type('unbound protein')).slug, 'apo-protein', 'unbound protein');
  perform t.is((public.resolve_simulation_type('Protein-ligand')).slug, 'protein-ligand-complex', 'Protein-ligand');
  perform t.is((public.resolve_simulation_type('holo')).slug, 'protein-ligand-complex', 'holo');
  perform t.is((public.resolve_simulation_type('PMF')).slug, 'umbrella-sampling', 'PMF');
  perform t.is((public.resolve_simulation_type('REMD')).slug, 'replica-exchange', 'REMD');
  perform t.is((public.resolve_simulation_type('Martini')).slug, 'coarse-grained', 'Martini');
  perform t.ok((public.resolve_simulation_type('no such thing')).id is null, 'unknown text resolves to nothing');
  perform t.ok((public.resolve_simulation_type('RMSD')).id is null, 'analysis names are not simulation types');

  -- duplicates are impossible --------------------------------------------------------------------------------
  perform t.fails($q$insert into public.simulation_types (slug, name, aliases) values ('apo-2', 'Apo form protein', array['Unbound protein'])$q$, '23505', 'duplicate alias rejected');
  perform t.fails($q$insert into public.simulation_types (slug, name) values ('a-p-o', 'A.P.O')$q$, '23505', 'punctuation variants rejected');
  perform t.fails($q$update public.simulation_types set aliases = aliases || array['Holo'] where slug = 'apo-protein'$q$, '23505', 'alias stealing on update rejected');
  perform t.fails($q$insert into public.simulation_types (slug, name) values ('Bad Slug', 'Bad')$q$, '23514', 'slug format enforced');
  insert into public.simulation_types (slug, name, aliases) values ('qm-mm', 'QM/MM', array['Quantum mechanics molecular mechanics']) returning id into sim_new;
  perform t.is((public.resolve_simulation_type('qmmm')).slug, 'qm-mm', 'a new type resolves by name');

  -- access ------------------------------------------------------------------------------------------------------
  update public.simulation_types set status = 'archived' where slug = 'qm-mm';
  perform t.anon();
  perform t.is((select count(*) from public.simulation_types), 14::bigint, 'anon reads active types only');
  perform t.is((select count(*) from public.simulation_types where slug = 'qm-mm'), 0::bigint, 'anon cannot see archived types');
  perform t.fails('select count(*) from public.simulation_type_keys', '42501', 'lookup keys are not readable by anon');
  perform t.fails($q$insert into public.simulation_types (slug, name) values ('anon-type', 'Anon type')$q$, '42501', 'anon cannot write');
  perform t.login(u);
  perform t.fails('select count(*) from public.simulation_type_keys', '42501', 'lookup keys are not readable by users');
  perform t.fails($q$insert into public.simulation_types (slug, name) values ('user-type', 'User type')$q$, '42501', 'user cannot create a type');
  perform t.is(t.affected($q$update public.simulation_types set name = 'Hacked' where slug = 'apo-protein'$q$), 0::bigint, 'user cannot rename a type');
  perform t.is(t.affected($q$delete from public.simulation_types where slug = 'apo-protein'$q$), 0::bigint, 'user cannot delete a type');
  perform t.login(adm);
  perform t.is((select count(*) from public.simulation_types), 15::bigint, 'admin also sees archived types');
  perform t.is(t.affected($q$insert into public.simulation_types (slug, name, aliases) values ('constant-ph', 'Constant-pH', array['CpHMD'])$q$), 1::bigint, 'admin creates a type');
  perform t.is(t.affected($q$update public.simulation_types set summary = 'Protonation states follow the pH.' where slug = 'constant-ph'$q$), 1::bigint, 'admin edits a type');
  perform t.ok((select count(*) from public.audit_log where subject_type = 'simulation_types') >= 2, 'admin changes are audited');
  perform t.root();

  -- the trigger function cannot be called through the API; the lookup can --------------------------------------------
  perform t.is(has_function_privilege('anon', 'public.simulation_types_sync_keys()', 'execute'), false, 'anon cannot call the trigger function');
  perform t.is(has_function_privilege('authenticated', 'public.simulation_types_sync_keys()', 'execute'), false, 'authenticated cannot call the trigger function');
  perform t.is(has_function_privilege('anon', 'public.resolve_simulation_type(text)', 'execute'), true, 'the lookup is public');

  -- records: a simulation type is needed to submit ----------------------------------------------------------------------
  perform t.login(u);
  insert into public.records (owner_id, type_id, simulation_type_id, title, pdb_id, molecules)
    values (u, rmsd, sim_new, 'Archived type record', '5AAA', '[{"kind":"ligand","resn":"LIG"}]') returning id into rid;
  insert into public.record_files (record_id, kind, filename, storage_path, size_bytes) values (rid, 'xvg', 'a.xvg', u || '/' || rid || '/a.xvg', 10);
  perform t.fails(format($q$select public.submit_record(%L)$q$, rid), '23514', 'an archived simulation type cannot be used to submit');
  perform t.is(t.affected(format($q$update public.records set simulation_type_id = %L where id = %L$q$, apo, rid)), 1::bigint, 'the owner changes the simulation type');
  perform public.submit_record(rid);
  perform t.is((select status::text from public.records where id = rid), 'pending', 'submits once the type is active');
  perform t.login(adm);
  perform public.approve_record(rid);
  perform t.anon();
  perform t.is((select sim_type_slug from public.public_records where id = rid), 'apo-protein', 'the public view shows the simulation type');
  perform t.is((select sim_type_name from public.public_records where id = rid), 'Apo protein', 'and its name');
  perform t.login(u);
  update public.records set simulation_type_id = (select id from public.simulation_types where slug = 'peptide') where id = rid;
  perform t.is((select status::text from public.records where id = rid), 'draft', 'changing the type of a live record starts a revision');
  perform t.anon();
  perform t.is((select sim_type_slug from public.public_records where id = rid), 'apo-protein', 'the public keeps the approved type until re-approval');

  -- deleting a type does not delete records ---------------------------------------------------------------------------------
  perform t.root();
  delete from public.simulation_types where slug = 'peptide';
  perform t.is((select simulation_type_id from public.records where id = rid), null::uuid, 'deleting a type leaves its records, without a type');

  -- type requests can be for either list -----------------------------------------------------------------------------------------
  perform t.login(u);
  insert into public.type_requests (requested_by, name) values (u, 'Constant-pH MD');
  perform t.is((select kind from public.type_requests order by created_at desc limit 1), 'simulation', 'requests default to simulation types');
  insert into public.type_requests (requested_by, name, kind) values (u, 'Contact order', 'analysis');
  perform t.fails($q$insert into public.type_requests (requested_by, name, kind) values ('00000000-0000-0000-0000-00000000a801', 'Weird', 'other')$q$, '23514', 'only simulation or analysis requests');
  perform t.login(rst);
  perform t.fails($q$insert into public.type_requests (requested_by, name) values ('00000000-0000-0000-0000-00000000c801', 'Restricted ask')$q$, '42501', 'restricted users cannot request');
  perform t.root();
end $$;
