do $$
declare
  u   constant uuid := '00000000-0000-0000-0000-00000000a101';
  adm constant uuid := '00000000-0000-0000-0000-00000000ad02';
  rst constant uuid := '00000000-0000-0000-0000-00000000c101';
  rmsd uuid;
begin
  perform t.make_user(u, 'tax-user@example.org');
  perform t.make_user(adm, 'tax-admin@example.org', 'admin');
  perform t.make_user(rst, 'tax-restricted@example.org', 'user', 'restricted');
  select id into rmsd from public.analysis_types where slug = 'rmsd';

  -- aliases resolve case- and punctuation-insensitively to one canonical type
  perform t.is((public.resolve_analysis_type('RMSD')).slug, 'rmsd', 'resolve RMSD');
  perform t.is((public.resolve_analysis_type('rmsd analysis')).slug, 'rmsd', 'resolve "rmsd analysis"');
  perform t.is((public.resolve_analysis_type('Protein-RMSD')).slug, 'rmsd', 'resolve "Protein-RMSD"');
  perform t.is((public.resolve_analysis_type('MM/PBSA')).slug, 'mm-pbsa', 'resolve MM/PBSA');
  perform t.ok((public.resolve_analysis_type('no such type')).id is null, 'unknown text resolves to nothing');

  -- duplicates are impossible: a new type cannot reuse any slug, name or alias
  perform t.fails($q$insert into public.analysis_types (slug, name, aliases) values ('rmsd-2', 'Backbone RMSD analysis', array['Protein RMSD'])$q$, '23505', 'duplicate alias rejected');
  perform t.fails($q$insert into public.analysis_types (slug, name) values ('r-m-s-d', 'R.M.S.D.')$q$, '23505', 'punctuation variants rejected');
  perform t.fails($q$update public.analysis_types set aliases = aliases || array['RMSF'] where slug = 'rmsd'$q$, '23505', 'alias stealing on update rejected');
  insert into public.analysis_types (slug, name, aliases) values ('shape-analysis', 'Shape analysis', array['Asphericity']);
  perform t.is((public.resolve_analysis_type('asphericity')).slug, 'shape-analysis', 'new type resolves by alias');
  update public.analysis_types set aliases = array['Asphericity', 'Anisotropy'] where slug = 'shape-analysis';
  perform t.is((public.resolve_analysis_type('anisotropy')).slug, 'shape-analysis', 'alias added on update');
  update public.analysis_types set aliases = array['Anisotropy'] where slug = 'shape-analysis';
  perform t.ok((public.resolve_analysis_type('asphericity')).id is null, 'removed alias no longer resolves');
  perform t.fails($q$insert into public.analysis_types (slug, name) values ('Bad Slug', 'Bad')$q$, '23514', 'slug format enforced');

  -- everyone can read active types; archived ones are admin-only
  update public.analysis_types set status = 'archived' where slug = 'shape-analysis';
  perform t.anon();
  perform t.ok((select count(*) from public.analysis_types) >= 10, 'anon reads active types');
  perform t.is((select count(*) from public.analysis_types where slug = 'shape-analysis'), 0::bigint, 'anon cannot see archived types');
  perform t.fails('select * from public.analysis_type_keys', '42501', 'lookup keys are not readable');
  perform t.root();
  perform t.ok((public.resolve_analysis_type('anisotropy')).id is null, 'archived types do not resolve');

  -- only admins write types (users can only request)
  perform t.login(u);
  perform t.fails($q$insert into public.analysis_types (slug, name) values ('user-type', 'User type')$q$, '42501', 'user cannot create a type');
  perform t.is(t.affected($q$update public.analysis_types set name = 'Hacked' where slug = 'rmsd'$q$), 0::bigint, 'user cannot edit a type');
  perform t.is(t.affected($q$delete from public.analysis_types where slug = 'rmsd'$q$), 0::bigint, 'user cannot delete a type');
  perform t.fails($q$insert into public.blog_categories (slug, name) values ('mine', 'Mine')$q$, '42501', 'user cannot create a blog category');

  -- type requests
  insert into public.type_requests (requested_by, name, reason) values (u, 'Membrane thickness', 'needed for lipid bilayers');
  perform t.fails($q$insert into public.type_requests (requested_by, name, status) values ('00000000-0000-0000-0000-00000000a101', 'Sneaky', 'approved')$q$, '42501', 'cannot self-approve a request');
  perform t.fails($q$insert into public.type_requests (requested_by, name) values ('00000000-0000-0000-0000-00000000ad02', 'Impersonated')$q$, '42501', 'cannot request as someone else');
  perform t.is((select count(*) from public.type_requests), 1::bigint, 'user sees own request');
  perform t.is(t.affected($q$update public.type_requests set status = 'approved'$q$), 0::bigint, 'user cannot resolve requests');

  perform t.login(rst);
  perform t.fails($q$insert into public.type_requests (requested_by, name) values ('00000000-0000-0000-0000-00000000c101', 'Restricted ask')$q$, '42501', 'restricted user cannot request');

  perform t.login(adm);
  perform t.is((select count(*) from public.type_requests), 1::bigint, 'admin sees the request');
  perform public.resolve_type_request((select id from public.type_requests limit 1), 'merged', rmsd, 'covered by RMSD');
  perform t.is((select status::text from public.type_requests limit 1), 'merged', 'request resolved');
  perform t.fails($q$select public.resolve_type_request((select id from public.type_requests limit 1), 'open')$q$, '22023', 'cannot reopen via resolve');
  perform t.is((select count(*) from public.notifications), 0::bigint, 'admin cannot read other users notifications');
  perform t.is(t.affected($q$insert into public.analysis_types (slug, name, aliases) values ('contact-angle', 'Contact angle', array['Wetting angle'])$q$), 1::bigint, 'admin creates a type');
  perform t.ok((select count(*) from public.audit_log where subject_type = 'analysis_types') >= 1, 'admin type changes are audited');
  perform t.is(t.affected($q$insert into public.blog_categories (slug, name) values ('case-studies', 'Case studies')$q$), 1::bigint, 'admin creates a blog category');

  perform t.login(u);
  perform t.fails($q$select public.resolve_type_request(gen_random_uuid(), 'approved')$q$, '42501', 'user cannot call resolve_type_request');
  perform t.is((select count(*) from public.review_events where subject_type = 'type_request'), 1::bigint, 'requester sees the decision history');
  perform t.is((select count(*) from public.notifications), 1::bigint, 'requester was notified');
  perform t.root();

  -- tags
  perform t.login(u);
  perform t.is(t.affected($q$insert into public.tags (name) values ('Lipid Bilayer')$q$), 1::bigint, 'user adds a tag');
  perform t.is((select slug from public.tags where name = 'Lipid Bilayer'), 'lipid-bilayer', 'tag slug normalised');
  perform t.fails($q$insert into public.tags (name) values ('lipid bilayer')$q$, '23505', 'duplicate tag rejected');
  perform t.fails($q$insert into public.tags (name) values ('!!!')$q$, null, 'tag needs letters or digits');
  perform t.is(t.affected($q$update public.tags set name = 'x'$q$), 0::bigint, 'user cannot rename tags');
  perform t.is((select count(*) from public.ensure_tags(array['GROMACS', 'gromacs', 'CHARMM36'])), 2::bigint, 'ensure_tags de-duplicates');
  perform t.login(rst);
  perform t.fails($q$insert into public.tags (name) values ('restricted')$q$, '42501', 'restricted user cannot add tags');
  perform t.fails($q$select * from public.ensure_tags(array['x'])$q$, '42501', 'restricted user cannot ensure_tags');
  perform t.anon();
  perform t.ok((select count(*) from public.tags) >= 3, 'anon reads tags');
  perform t.fails($q$insert into public.tags (name) values ('anon')$q$, '42501', 'anon cannot add tags');
  perform t.fails($q$select * from public.ensure_tags(array['x'])$q$, '42501', 'anon cannot ensure_tags');
  perform t.is((select count(*) from public.blog_categories), 6::bigint, 'anon reads blog categories');
  perform t.root();
end $$;
