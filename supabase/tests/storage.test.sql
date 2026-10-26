do $$
declare
  a   constant uuid := '00000000-0000-0000-0000-00000000a501';
  b   constant uuid := '00000000-0000-0000-0000-00000000b501';
  adm constant uuid := '00000000-0000-0000-0000-00000000ad06';
  rs  constant uuid := '00000000-0000-0000-0000-00000000c501';
  rmsd uuid; ra uuid; rb uuid; rpend uuid;
begin
  perform t.make_user(a, 'sto-a@example.org');
  perform t.make_user(b, 'sto-b@example.org');
  perform t.make_user(adm, 'sto-admin@example.org', 'admin');
  perform t.make_user(rs, 'sto-restricted@example.org', 'user', 'restricted');
  select id into rmsd from public.analysis_types where slug = 'rmsd';
  insert into public.records (owner_id, type_id, title, pdb_id) values (a, rmsd, 'Storage record A', '3AAA') returning id into ra;
  insert into public.records (owner_id, type_id, title, pdb_id) values (b, rmsd, 'Storage record B', '3BBB') returning id into rb;
  insert into public.records (owner_id, type_id, title, pdb_id, status) values (a, rmsd, 'Storage pending', '3CCC', 'pending') returning id into rpend;

  perform t.is((select public from storage.buckets where id = 'record-files'), false, 'record-files is private');
  perform t.is((select public from storage.buckets where id = 'blog-images'), true, 'blog-images is public');
  perform t.ok(not ('image/svg+xml' = any (select unnest(allowed_mime_types) from storage.buckets where id = 'blog-images')), 'SVG uploads are not allowed (script risk)');

  -- record-files -------------------------------------------------------------------------------------
  perform t.login(a);
  perform t.is(t.affected(format($q$insert into storage.objects (bucket_id, name, owner) values ('record-files', %L, %L)$q$, a || '/' || ra || '/rmsd.xvg', a)), 1::bigint, 'owner uploads to own record folder');
  perform t.fails(format($q$insert into storage.objects (bucket_id, name, owner) values ('record-files', %L, %L)$q$, b || '/' || rb || '/x.xvg', a), '42501', 'cannot upload into another user folder');
  perform t.fails(format($q$insert into storage.objects (bucket_id, name, owner) values ('record-files', %L, %L)$q$, a || '/' || rb || '/x.xvg', a), '42501', 'cannot upload into a record you do not own');
  perform t.fails(format($q$insert into storage.objects (bucket_id, name, owner) values ('record-files', %L, %L)$q$, a || '/not-a-uuid/x.xvg', a), '42501', 'record folder must be a uuid');
  perform t.fails(format($q$insert into storage.objects (bucket_id, name, owner) values ('record-files', %L, %L)$q$, a || '/loose.xvg', a), '42501', 'files must be inside a record folder');
  perform t.fails(format($q$insert into storage.objects (bucket_id, name, owner) values ('record-files', %L, %L)$q$, a || '/' || rpend || '/x.xvg', a), '42501', 'cannot upload to a record under review');
  perform t.is((select count(*) from storage.objects where bucket_id = 'record-files'), 1::bigint, 'owner reads own file');

  perform t.login(b);
  perform t.is((select count(*) from storage.objects where bucket_id = 'record-files'), 0::bigint, 'other user cannot read it');
  perform t.is(t.affected(format($q$delete from storage.objects where name = %L$q$, a || '/' || ra || '/rmsd.xvg')), 0::bigint, 'other user cannot delete it');
  perform t.is(t.affected(format($q$update storage.objects set name = %L where name = %L$q$, b || '/' || rb || '/moved.xvg', a || '/' || ra || '/rmsd.xvg')), 0::bigint, 'other user cannot move it');
  perform t.anon();
  perform t.is((select count(*) from storage.objects where bucket_id = 'record-files'), 0::bigint, 'anon cannot read record files');
  perform t.fails(format($q$insert into storage.objects (bucket_id, name) values ('record-files', %L)$q$, a || '/' || ra || '/anon.xvg'), '42501', 'anon cannot upload');

  perform t.login(adm);
  perform t.is((select count(*) from storage.objects where bucket_id = 'record-files'), 1::bigint, 'admin reads record files');
  perform t.is(t.affected(format($q$insert into storage.objects (bucket_id, name, owner) values ('record-files', %L, %L)$q$, b || '/' || rb || '/admin.xvg', adm)), 1::bigint, 'admin can upload for a record');

  perform t.login(rs);
  perform t.fails(format($q$insert into storage.objects (bucket_id, name, owner) values ('record-files', %L, %L)$q$, rs || '/' || ra || '/x.xvg', rs), '42501', 'restricted user cannot upload');

  perform t.login(a);
  perform t.is(t.affected(format($q$delete from storage.objects where name = %L$q$, a || '/' || ra || '/rmsd.xvg')), 1::bigint, 'owner deletes own file');

  -- blog-images -------------------------------------------------------------------------------------------
  perform t.login(a);
  perform t.is(t.affected(format($q$insert into storage.objects (bucket_id, name, owner) values ('blog-images', %L, %L)$q$, a || '/post/cover.webp', a)), 1::bigint, 'author uploads own image');
  perform t.fails(format($q$insert into storage.objects (bucket_id, name, owner) values ('blog-images', %L, %L)$q$, b || '/post/cover.webp', a), '42501', 'cannot upload into another folder');
  perform t.anon();
  perform t.is((select count(*) from storage.objects where bucket_id = 'blog-images'), 1::bigint, 'anyone can read blog images');
  perform t.fails(format($q$insert into storage.objects (bucket_id, name) values ('blog-images', %L)$q$, a || '/anon.webp'), '42501', 'anon cannot upload images');
  perform t.login(b);
  perform t.is(t.affected(format($q$delete from storage.objects where name = %L$q$, a || '/post/cover.webp')), 0::bigint, 'cannot delete another author image');
  perform t.login(rs);
  perform t.fails(format($q$insert into storage.objects (bucket_id, name, owner) values ('blog-images', %L, %L)$q$, rs || '/post/x.webp', rs), '42501', 'restricted user cannot upload images');
  perform t.login(adm);
  perform t.is(t.affected(format($q$delete from storage.objects where name = %L$q$, a || '/post/cover.webp')), 1::bigint, 'admin can remove any image');
  perform t.root();
end $$;
