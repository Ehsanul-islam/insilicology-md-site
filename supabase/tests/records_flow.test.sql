do $$
declare
  o   constant uuid := '00000000-0000-0000-0000-00000000a301';
  o2  constant uuid := '00000000-0000-0000-0000-00000000b301';
  adm constant uuid := '00000000-0000-0000-0000-00000000ad04';
  rmsd uuid;
  rid uuid; fid uuid; fid2 uuid; first_pub timestamptz;
  p text;
begin
  perform t.make_user(o, 'flow-owner@example.org');
  perform t.make_user(o2, 'flow-other@example.org');
  perform t.make_user(adm, 'flow-admin@example.org', 'admin');
  update public.profiles set display_name = 'Dr Flow' where id = o;
  select id into rmsd from public.analysis_types where slug = 'rmsd';

  perform t.login(o);
  insert into public.records (owner_id, type_id, title, description, pdb_id, protein_name, molecules, force_field, authors)
  values (o, rmsd, 'Flow record', 'First description', '2abc', 'Flow protein', '[{"kind":"ligand","name":"Flowmycin","resn":"LIG"}]', 'CHARMM36', array['A. Author'])
  returning id into rid;
  p := o || '/' || rid || '/';
  insert into public.record_files (record_id, kind, filename, storage_path, size_bytes, parsed)
  values (rid, 'xvg', 'rmsd.xvg', p || 'rmsd.xvg', 5000, '{"series":[[0,0],[1,1]]}') returning id into fid;
  perform public.ensure_tags(array['Flow Tag']);
  insert into public.record_tags (record_id, tag_id) select rid, id from public.tags where slug = 'flow-tag';
  perform public.submit_record(rid);

  -- pending records are invisible to the public ---------------------------------------------------
  perform t.anon();
  perform t.is((select count(*) from public.public_records where slug = '2abc-lig'), 0::bigint, 'pending record is not public');
  perform t.is((select count(*) from public.search_records(p_pdb => '2abc')), 0::bigint, 'pending record is not searchable');
  perform t.is((select count(*) from public.published_pdbs where pdb_id = '2ABC'), 0::bigint, 'pending record is not in published_pdbs');

  -- approval -----------------------------------------------------------------------------------------
  perform t.login(adm);
  perform t.is((public.admin_counts() ->> 'records')::int >= 1, true, 'pending counter counts it');
  perform public.approve_record(rid);
  perform t.root();
  select published_at into first_pub from public.records where id = rid;
  perform t.is((select status::text from public.records where id = rid), 'published', 'approved record is published');
  perform t.ok(first_pub is not null, 'published_at set');

  perform t.anon();
  perform t.is((select title from public.public_records where slug = '2abc-lig'), 'Flow record', 'public sees the approved title');
  perform t.is((select type_slug from public.public_records where slug = '2abc-lig'), 'rmsd', 'type slug');
  perform t.is((select type_name from public.public_records where slug = '2abc-lig'), 'RMSD analysis', 'type name');
  perform t.is((select pdb_id from public.public_records where slug = '2abc-lig'), '2ABC', 'pdb id');
  perform t.is((select contributor from public.public_records where slug = '2abc-lig'), 'Dr Flow', 'contributor name');
  perform t.is((select tags from public.public_records where slug = '2abc-lig'), array['flow-tag'], 'tags');
  perform t.is((select authors from public.public_records where slug = '2abc-lig'), array['A. Author'], 'authors');
  perform t.is((select jsonb_array_length(files) from public.public_records where slug = '2abc-lig'), 1, 'one file in the snapshot');
  perform t.is((select files -> 0 ->> 'kind' from public.public_records where slug = '2abc-lig'), 'xvg', 'file kind');
  perform t.ok((select updated_at from public.public_records where slug = '2abc-lig') is not null, 'snapshot time');
  perform t.is((select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'public_records' and column_name in ('owner_id', 'admin_feedback', 'status', 'submitted_at')), 0::bigint, 'view hides internal columns');
  perform t.fails('select * from public.records', '42501', 'anon still cannot read the table');
  perform t.is((select complexes from public.published_pdbs where pdb_id = '2ABC'), 1, 'published_pdbs counts complexes');
  perform t.is((select ligands from public.published_pdbs where pdb_id = '2ABC'), array['LIG'], 'published_pdbs lists ligands');

  -- search ---------------------------------------------------------------------------------------------
  perform t.is((select count(*) from public.search_records(p_pdb => '2abc')), 1::bigint, 'search by PDB ID');
  perform t.is((select count(*) from public.search_records(p_pdb => '9zzz')), 0::bigint, 'search by unknown PDB ID');
  perform t.is((select count(*) from public.search_records(p_type => 'Protein RMSD')), 1::bigint, 'search by type alias');
  perform t.is((select count(*) from public.search_records(p_type => 'rmsf')), 0::bigint, 'search by another type');
  perform t.is((select count(*) from public.search_records(p_type => 'not a type')), 0::bigint, 'unknown type matches nothing');
  perform t.is((select count(*) from public.search_records(p_tag => 'Flow Tag')), 1::bigint, 'search by tag');
  perform t.is((select count(*) from public.search_records(q => 'flow protein')), 1::bigint, 'full-text search');
  perform t.is((select count(*) from public.search_records(q => 'flowmycin')), 1::bigint, 'search by ligand name');
  perform t.is((select count(*) from public.search_records(q => 'nonexistent')), 0::bigint, 'full-text search miss');
  perform t.is((select count(*) from public.search_records(p_pdb => '2abc', lim => 0)), 1::bigint, 'limit is clamped to at least 1');

  -- history, notifications, audit -----------------------------------------------------------------------
  perform t.login(o);
  perform t.is((select count(*) from public.review_events where subject_id = rid), 2::bigint, 'owner sees submitted + approved');
  perform t.is((select count(*) from public.notifications where kind = 'record_approved'), 1::bigint, 'owner was notified');
  perform t.is(t.affected($q$update public.notifications set read_at = now()$q$), 1::bigint, 'owner marks it read');
  perform t.fails($q$update public.notifications set title = 'forged'$q$, '42501', 'owner cannot rewrite a notification');
  perform t.fails($q$insert into public.notifications (user_id, kind, title) values ('00000000-0000-0000-0000-00000000a301', 'x', 'forged')$q$, '42501', 'users cannot create notifications');
  perform t.fails($q$insert into public.review_events (subject_type, subject_id, action) values ('record', gen_random_uuid(), 'approved')$q$, '42501', 'users cannot write review events');
  perform t.login(o2);
  perform t.is((select count(*) from public.review_events where subject_id = rid), 0::bigint, 'other users cannot read the history');
  perform t.is((select count(*) from public.notifications), 0::bigint, 'other users cannot read notifications');
  perform t.login(adm);
  perform t.is((select count(*) from public.audit_log where subject_id = rid and action = 'approved'), 1::bigint, 'approval is audited');

  -- editing a live record: a revision that must be approved before the public sees it ------------------
  perform t.login(o);
  update public.records set title = 'Flow record v2', description = 'Second description' where id = rid;
  perform t.is((select status::text from public.records where id = rid), 'draft', 'editing a published record starts a revision');
  perform t.is((select is_public from public.records where id = rid), true, 'the approved version stays live');
  perform t.anon();
  perform t.is((select title from public.public_records where slug = '2abc-lig'), 'Flow record', 'public still sees the approved title');
  perform t.login(o);
  insert into public.record_files (record_id, kind, filename, storage_path, size_bytes) values (rid, 'xvg', 'rmsf.xvg', p || 'rmsf.xvg', 4000) returning id into fid2;
  perform t.anon();
  perform t.is((select jsonb_array_length(files) from public.public_records where slug = '2abc-lig'), 1, 'new file is not public yet');
  perform t.login(o);
  perform public.submit_record(rid);
  perform t.login(adm);
  perform public.request_changes_record(rid, 'Please add the simulation length.');
  perform t.is((select status::text from public.records where id = rid), 'changes_requested', 'sent back');
  perform t.is((select admin_feedback from public.records where id = rid), 'Please add the simulation length.', 'feedback stored');
  perform t.anon();
  perform t.is((select title from public.public_records where slug = '2abc-lig'), 'Flow record', 'a revision under changes_requested is still not public');
  perform t.login(o);
  perform t.is((select count(*) from public.notifications where kind = 'record_changes'), 1::bigint, 'author told what to change');
  perform t.is(t.affected(format($q$update public.records set length_ns = 100 where id = %L$q$, rid)), 1::bigint, 'author edits after changes were requested');
  perform public.submit_record(rid);
  perform t.login(adm);
  perform public.approve_record(rid);
  perform t.anon();
  perform t.is((select title from public.public_records where slug = '2abc-lig'), 'Flow record v2', 'approved revision replaces the snapshot');
  perform t.is((select length_ns from public.public_records where slug = '2abc-lig'), 100::numeric, 'new field is public');
  perform t.is((select jsonb_array_length(files) from public.public_records where slug = '2abc-lig'), 2, 'new file is public after approval');
  perform t.root();
  perform t.is((select published_at from public.records where id = rid), first_pub, 'published_at keeps the first publication date');
  perform t.is((select admin_feedback from public.records where id = rid), null::text, 'feedback cleared on approval');

  -- tag and file changes are revisions too ----------------------------------------------------------------
  perform t.login(o);
  delete from public.record_tags where record_id = rid;
  perform t.is((select status::text from public.records where id = rid), 'draft', 'removing a tag starts a revision');
  perform t.anon();
  perform t.is((select tags from public.public_records where slug = '2abc-lig'), array['flow-tag'], 'public tags unchanged until approval');
  perform t.login(o);
  perform public.submit_record(rid);
  perform t.login(adm);
  perform public.approve_record(rid);
  perform t.anon();
  perform t.is((select cardinality(tags) from public.public_records where slug = '2abc-lig'), 0, 'tag removal is public after approval');

  -- an admin's own edit to a live record also needs approval ------------------------------------------------
  perform t.login(adm);
  update public.records set description = 'Edited by admin' where id = rid;
  perform t.is((select status::text from public.records where id = rid), 'pending', 'admin edit of a live record goes back to pending');
  perform t.anon();
  perform t.is((select description from public.public_records where slug = '2abc-lig'), 'Second description', 'admin edit is not public until approved');
  perform t.login(adm);
  perform public.approve_record(rid);
  perform t.anon();
  perform t.is((select description from public.public_records where slug = '2abc-lig'), 'Edited by admin', 'then it is');

  -- owners cannot delete a live record ---------------------------------------------------------------------------
  perform t.login(o);
  perform t.is(t.affected(format($q$delete from public.records where id = %L$q$, rid)), 0::bigint, 'owner cannot delete a published record');

  -- unpublishing -------------------------------------------------------------------------------------------------------
  perform t.login(adm);
  perform public.unpublish_record(rid, 'Duplicate of another record');
  perform t.anon();
  perform t.is((select count(*) from public.public_records where slug = '2abc-lig'), 0::bigint, 'unpublished record disappears');
  perform t.is((select count(*) from public.search_records(p_pdb => '2abc')), 0::bigint, 'and from search');
  perform t.is((select count(*) from public.published_pdbs where pdb_id = '2ABC'), 0::bigint, 'and from published_pdbs');
  perform t.root();
  perform t.is((select published_snapshot from public.records where id = rid), null::jsonb, 'snapshot removed');
  perform t.is((select status::text from public.records where id = rid), 'unpublished', 'status is unpublished');
  perform t.login(o);
  perform t.is((select admin_feedback from public.records where id = rid), 'Duplicate of another record', 'author sees why');
  perform t.is(t.affected(format($q$update public.records set title = 'Flow record v3' where id = %L$q$, rid)), 1::bigint, 'author can fix an unpublished record');
  perform t.is((select status::text from public.records where id = rid), 'unpublished', 'editing does not change an unpublished status');
  perform public.submit_record(rid);
  perform t.login(adm);
  perform public.reject_record(rid, 'Still a duplicate');
  perform t.is((select status::text from public.records where id = rid), 'rejected', 'rejected');
  perform t.login(o);
  perform t.is((select count(*) from public.review_events where subject_id = rid and action = 'rejected'), 1::bigint, 'rejection is in the history');
  perform t.is(t.affected(format($q$delete from public.records where id = %L$q$, rid)), 1::bigint, 'author can delete a rejected record');
  perform t.is((select count(*) from public.record_files where record_id = rid), 0::bigint, 'its files go with it');
  perform t.root();
end $$;
