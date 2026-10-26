do $$
declare
  o1  constant uuid := '00000000-0000-0000-0000-00000000a201';
  o2  constant uuid := '00000000-0000-0000-0000-00000000b201';
  adm constant uuid := '00000000-0000-0000-0000-00000000ad03';
  rs  constant uuid := '00000000-0000-0000-0000-00000000c201';
  rmsd uuid; other uuid;
  rid uuid; rid2 uuid; rid3 uuid; fid uuid; first_pub timestamptz;
begin
  perform t.make_user(o1, 'rec-owner@example.org');
  perform t.make_user(o2, 'rec-other@example.org');
  perform t.make_user(adm, 'rec-admin@example.org', 'admin');
  perform t.make_user(rs, 'rec-restricted@example.org', 'user', 'restricted');
  select id into rmsd from public.analysis_types where slug = 'rmsd';
  select id into other from public.analysis_types where slug = 'other';
  update public.profiles set display_name = 'Dr Owner' where id = o1;

  -- creating a draft ---------------------------------------------------------------------------
  perform t.login(o1);
  insert into public.records (owner_id, type_id, title, pdb_id, protein_name, molecules, force_field, length_ns, doi)
  values (o1, rmsd, 'Testosterone in 3-alpha-HSD', '1afs', '3-alpha-hydroxysteroid dehydrogenase',
          '[{"kind":"ligand","name":"Testosterone","resn":"TES"}]', 'CHARMM36', 100, '10.1000/abc123')
  returning id into rid;
  perform t.is((select slug from public.records where id = rid), '1afs-tes', 'slug is <pdb>-<ligand>');
  perform t.is((select pdb_id from public.records where id = rid), '1AFS', 'PDB ID upper-cased');
  perform t.is((select status::text from public.records where id = rid), 'draft', 'new records are drafts');
  insert into public.records (owner_id, type_id, title, pdb_id, molecules) values (o1, rmsd, 'Second TES run', '1AFS', '[{"kind":"ligand","resn":"TES"}]') returning id into rid2;
  perform t.is((select slug from public.records where id = rid2), '1afs-tes-2', 'slug collision is numbered');
  insert into public.records (owner_id, type_id, title) values (o1, other, 'Membrane thickness study') returning id into rid3;
  perform t.is((select slug from public.records where id = rid3), 'membrane-thickness-study', 'slug from title when there is no PDB ID');
  perform t.fails(format($q$update public.records set slug = 'mine' where id = %L$q$, rid), '42501', 'slug cannot be changed by the owner');

  -- input validation
  perform t.fails($q$insert into public.records (owner_id, title, pdb_id) values ('00000000-0000-0000-0000-00000000a201', 'Bad pdb', '12')$q$, '23514', 'invalid PDB ID');
  perform t.fails($q$insert into public.records (owner_id, title, length_ns) values ('00000000-0000-0000-0000-00000000a201', 'Zero length', 0)$q$, '23514', 'length must be positive');
  perform t.fails($q$insert into public.records (owner_id, title, doi) values ('00000000-0000-0000-0000-00000000a201', 'Bad doi', 'doi:nope')$q$, '23514', 'DOI format');
  perform t.fails($q$insert into public.records (owner_id, title, license) values ('00000000-0000-0000-0000-00000000a201', 'Bad licence', 'WTFPL')$q$, '23514', 'licence list');
  perform t.fails($q$insert into public.records (owner_id, title, molecules) values ('00000000-0000-0000-0000-00000000a201', 'Bad molecules', '{}')$q$, '23514', 'molecules must be an array');

  -- tampering at insert time
  perform t.fails($q$insert into public.records (owner_id, title, status) values ('00000000-0000-0000-0000-00000000a201', 'Born published', 'published')$q$, '42501', 'cannot insert as published');
  perform t.fails($q$insert into public.records (owner_id, title, is_public, published_snapshot) values ('00000000-0000-0000-0000-00000000a201', 'Born public', true, '{}')$q$, '42501', 'cannot insert as public');
  perform t.fails($q$insert into public.records (owner_id, title) values ('00000000-0000-0000-0000-00000000b201', 'As someone else')$q$, '42501', 'cannot create a record owned by someone else');

  -- tampering with state on update
  perform t.fails(format($q$update public.records set status = 'published' where id = %L$q$, rid), '42501', 'cannot self-publish');
  perform t.fails(format($q$update public.records set status = 'pending' where id = %L$q$, rid), '42501', 'cannot skip validation by setting pending');
  perform t.fails(format($q$update public.records set is_public = true where id = %L$q$, rid), '42501', 'cannot set is_public');
  perform t.fails(format($q$update public.records set published_snapshot = '{"title":"x"}' where id = %L$q$, rid), '42501', 'cannot write a snapshot');
  perform t.fails(format($q$update public.records set owner_id = %L where id = %L$q$, o2, rid), '42501', 'cannot give the record away');
  perform t.fails(format($q$update public.records set admin_feedback = 'approved!' where id = %L$q$, rid), '42501', 'cannot write admin feedback');
  perform t.fails(format($q$update public.records set submitted_at = now() where id = %L$q$, rid), '42501', 'cannot set submitted_at');

  -- who can see and touch a draft -----------------------------------------------------------------
  perform t.login(o2);
  perform t.is((select count(*) from public.records where id = rid), 0::bigint, 'other user cannot see a draft');
  perform t.is(t.affected(format($q$update public.records set title = 'stolen' where id = %L$q$, rid)), 0::bigint, 'other user cannot edit it');
  perform t.is(t.affected(format($q$delete from public.records where id = %L$q$, rid)), 0::bigint, 'other user cannot delete it');
  perform t.fails(format($q$select public.submit_record(%L)$q$, rid), 'P0002', 'other user cannot submit it');
  perform t.fails(format($q$insert into public.record_files (record_id, kind, filename, storage_path, size_bytes) values (%L, 'xvg', 'a.xvg', %L, 10)$q$, rid, o1 || '/' || rid || '/a.xvg'), '42501', 'other user cannot attach files');
  perform t.anon();
  perform t.fails('select * from public.records', '42501', 'anon cannot read records');
  perform t.is((select count(*) from public.public_records), 0::bigint, 'nothing is public yet');

  -- submitting: validation -------------------------------------------------------------------------
  perform t.login(o1);
  perform t.fails(format($q$select public.submit_record(%L)$q$, rid), '23514', 'cannot submit without files');
  perform t.fails(format($q$insert into public.record_files (record_id, kind, filename, storage_path, size_bytes) values (%L, 'xvg', 'a.xvg', 'elsewhere/a.xvg', 10)$q$, rid), '23514', 'file path must be under owner/record');
  insert into public.record_files (record_id, kind, filename, storage_path, size_bytes) values (rid, 'csv', 'rmsd.csv', o1 || '/' || rid || '/rmsd.csv', 1000);
  perform t.fails(format($q$select public.submit_record(%L)$q$, rid), '23514', 'RMSD needs an .xvg file');
  insert into public.record_files (record_id, kind, filename, storage_path, size_bytes, caption) values (rid, 'xvg', 'rmsd.xvg', o1 || '/' || rid || '/rmsd.xvg', 5000, 'Backbone RMSD') returning id into fid;
  perform t.fails(format($q$insert into public.record_files (record_id, kind, filename, storage_path, size_bytes) values (%L, 'exe', 'x.exe', %L, 10)$q$, rid, o1 || '/' || rid || '/x.exe'), '23514', 'unknown file kinds are rejected');
  perform t.fails(format($q$insert into public.record_files (record_id, kind, filename, storage_path, size_bytes) values (%L, 'xvg', 'z.xvg', %L, 0)$q$, rid, o1 || '/' || rid || '/z.xvg'), '23514', 'empty files are rejected');

  -- a type that needs a structure rejects a record without a PDB ID
  insert into public.record_files (record_id, kind, filename, storage_path, size_bytes) values (rid2, 'xvg', 'rmsd.xvg', o1 || '/' || rid2 || '/rmsd.xvg', 5000);
  update public.records set pdb_id = null where id = rid2;
  perform t.fails(format($q$select public.submit_record(%L)$q$, rid2), '23514', 'structure types need a PDB ID');
  -- a type with no structure requirement does not
  insert into public.record_files (record_id, kind, filename, storage_path, size_bytes) values (rid3, 'csv', 'thickness.csv', o1 || '/' || rid3 || '/thickness.csv', 500);
  perform public.submit_record(rid3);
  perform t.is((select status::text from public.records where id = rid3), 'pending', 'non-structure type submits without a PDB ID');

  -- submitting for review -------------------------------------------------------------------------
  perform public.ensure_tags(array['GROMACS']);
  insert into public.record_tags (record_id, tag_id) select rid, id from public.tags where slug = 'gromacs';
  perform public.submit_record(rid);
  perform t.is((select status::text from public.records where id = rid), 'pending', 'submitted record is pending');
  perform t.ok((select submitted_at from public.records where id = rid) is not null, 'submitted_at set');
  perform t.fails(format($q$select public.submit_record(%L)$q$, rid), '55000', 'cannot submit twice');
  perform t.is(t.affected(format($q$update public.records set title = 'edited while pending' where id = %L$q$, rid)), 0::bigint, 'owner cannot edit a pending record');
  perform t.fails(format($q$insert into public.record_files (record_id, kind, filename, storage_path, size_bytes) values (%L, 'xvg', 'b.xvg', %L, 10)$q$, rid, o1 || '/' || rid || '/b.xvg'), '42501', 'owner cannot add files to a pending record');
  perform t.is(t.affected(format($q$delete from public.record_files where id = %L$q$, fid)), 0::bigint, 'owner cannot remove files from a pending record');
  perform t.is(t.affected(format($q$delete from public.records where id = %L$q$, rid)), 0::bigint, 'owner cannot delete a pending record');
  perform t.is((select count(*) from public.review_events where subject_id = rid and action = 'submitted'), 1::bigint, 'owner sees the submission in the history');

  -- nobody but an admin can decide ---------------------------------------------------------------
  perform t.fails(format($q$select public.approve_record(%L)$q$, rid), '42501', 'owner cannot approve own record');
  perform t.login(o2);
  perform t.fails(format($q$select public.approve_record(%L)$q$, rid), '42501', 'another user cannot approve');
  perform t.fails(format($q$select public.reject_record(%L, 'nope')$q$, rid), '42501', 'another user cannot reject');
  perform t.fails(format($q$select public.unpublish_record(%L, 'nope')$q$, rid), '42501', 'another user cannot unpublish');
  perform t.anon();
  perform t.fails(format($q$select public.approve_record(%L)$q$, rid), '42501', 'anon cannot approve');
  perform t.fails(format($q$select public.submit_record(%L)$q$, rid), '42501', 'anon cannot submit');
  perform t.fails(format($q$update public.records set is_public = true where id = %L$q$, rid), '42501', 'anon cannot write records');

  -- a restricted account is read-only ---------------------------------------------------------------
  perform t.login(rs);
  perform t.fails($q$insert into public.records (owner_id, title) values ('00000000-0000-0000-0000-00000000c201', 'From a restricted account')$q$, '42501', 'restricted user cannot create records');
  perform t.root();
  update public.profiles set status = 'restricted' where id = o1;
  perform t.login(o1);
  perform t.fails(format($q$select public.submit_record(%L)$q$, rid2), '42501', 'user restricted after drafting cannot submit');
  perform t.is(t.affected(format($q$update public.records set title = 'sneaky edit' where id = %L$q$, rid2)), 0::bigint, 'user restricted after drafting cannot edit');
  perform t.root();
  update public.profiles set status = 'active' where id = o1;

  -- admin-only reads -----------------------------------------------------------------------------------
  perform t.login(o1);
  perform t.is((select count(*) from public.audit_log), 0::bigint, 'owner cannot read the audit log');
  perform t.login(adm);
  perform t.is((select count(*) from public.records where id = rid), 1::bigint, 'admin can read any record');
  perform t.fails(format($q$select public.request_changes_record(%L, '')$q$, rid), '22023', 'a reason is required to send a record back');
  perform t.fails(format($q$select public.reject_record(%L, '  ')$q$, rid), '22023', 'a reason is required to reject');
  perform t.fails(format($q$select public.approve_record(%L)$q$, rid2), '55000', 'a draft cannot be approved');
  perform t.fails(format($q$select public.reject_record(%L, 'not ready')$q$, rid2), '55000', 'a draft cannot be rejected');
  perform t.fails(format($q$select public.unpublish_record(%L, 'not live')$q$, rid), '55000', 'an unpublished record cannot be unpublished');
  perform t.fails(format($q$select public.approve_record(%L)$q$, gen_random_uuid()), 'P0002', 'unknown record');
  perform t.root();
  update public.records set pdb_id = '1AFS' where id = rid2;
  perform t.login(adm);
  perform t.is((select count(*) from public.find_similar_records(rid)), 1::bigint, 'duplicate finder returns the other TES run');
  perform t.login(o1);
  perform t.fails(format($q$select * from public.find_similar_records(%L)$q$, rid), '42501', 'duplicate finder is admin-only');
  perform t.root();
end $$;
