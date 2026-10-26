do $$
declare
  u   constant uuid := '00000000-0000-0000-0000-00000000a601';
  adm constant uuid := '00000000-0000-0000-0000-00000000ad07';
  mid uuid; n int;
begin
  perform t.make_user(u, 'contact-user@example.org');
  perform t.make_user(adm, 'contact-admin@example.org', 'admin');

  -- only the service role (the server action, after the captcha) can submit
  perform t.anon();
  perform t.fails($q$select public.submit_contact_message('A', 'a@example.org', null, 'Hello there, please help', null, 'h1')$q$, '42501', 'anon cannot submit directly');
  perform t.fails($q$insert into public.contact_messages (name, email, message) values ('A', 'a@example.org', 'Hello there, please help')$q$, '42501', 'anon cannot insert');
  perform t.login(u);
  perform t.fails($q$select public.submit_contact_message('A', 'a@example.org', null, 'Hello there, please help', null, 'h1')$q$, '42501', 'users cannot submit directly');
  perform t.fails($q$insert into public.contact_messages (name, email, message) values ('A', 'a@example.org', 'Hello there, please help')$q$, '42501', 'users cannot insert');

  perform t.service();
  mid := public.submit_contact_message('Ada', 'ada@example.org', 'Quote', 'I would like a quote for 1AFS please', '1afs', 'ip-1');
  perform t.ok(mid is not null, 'service role submits');
  perform t.is((select pdb_id from public.contact_messages where id = mid), '1AFS', 'PDB ID normalised');
  perform t.fails($q$select public.submit_contact_message('A', 'not-an-email', null, 'Hello there, please help', null, 'ip-2')$q$, '23514', 'email is validated');
  perform t.fails($q$select public.submit_contact_message('A', 'ok@example.org', null, 'short', null, 'ip-2')$q$, '23514', 'message length is validated');
  perform t.fails($q$select public.submit_contact_message('', 'ok@example.org', null, 'Hello there, please help', null, 'ip-2')$q$, '23514', 'name required');
  perform t.fails($q$select public.submit_contact_message('A', 'ok@example.org', null, 'Hello there, please help', 'xx', 'ip-2')$q$, '23514', 'PDB ID validated');

  -- rate limit: 5 per hour per IP hash or per email
  for n in 1..4 loop
    perform public.submit_contact_message('Ada', 'ada' || n || '@example.org', null, 'Another message for the same IP', null, 'ip-1');
  end loop;
  perform t.fails($q$select public.submit_contact_message('Ada', 'fresh@example.org', null, 'Sixth message from one IP', null, 'ip-1')$q$, '54000', 'IP rate limit');
  for n in 1..5 loop
    perform public.submit_contact_message('Eve', 'eve@example.org', null, 'Same email, different IPs ' || n, null, 'ip-e' || n);
  end loop;
  perform t.fails($q$select public.submit_contact_message('Eve', 'EVE@example.org', null, 'Sixth message from one email', null, 'ip-e9')$q$, '54000', 'email rate limit (case-insensitive)');
  perform public.submit_contact_message('Zed', 'zed@example.org', null, 'A different sender is unaffected', null, 'ip-z');

  -- reading and triage
  perform t.login(u);
  perform t.is((select count(*) from public.contact_messages), 0::bigint, 'users cannot read messages');
  perform t.is(t.affected($q$update public.contact_messages set status = 'spam'$q$), 0::bigint, 'users cannot update messages');
  perform t.is(t.affected($q$delete from public.contact_messages$q$), 0::bigint, 'users cannot delete messages');
  perform t.fails('select public.admin_counts()', '42501', 'users cannot read admin counters');
  perform t.anon();
  perform t.fails('select * from public.contact_messages', '42501', 'anon cannot read messages');
  perform t.fails('select public.admin_counts()', '42501', 'anon cannot read admin counters');

  perform t.login(adm);
  perform t.ok((select count(*) from public.contact_messages) >= 11, 'admin reads messages');
  perform t.is(t.affected(format($q$update public.contact_messages set status = 'read' where id = %L$q$, mid)), 1::bigint, 'admin marks one read');
  perform t.fails($q$update public.contact_messages set message = 'short' where email = 'zed@example.org'$q$, '23514', 'check constraints apply to admins too');
  perform t.is(t.affected($q$update public.contact_messages set message = 'A corrected, long enough message' where email = 'zed@example.org'$q$), 1::bigint, 'admin may edit a message');
  perform t.is((public.admin_counts() ->> 'messages')::int, (select count(*) from public.contact_messages where status = 'new')::int, 'counter matches new messages');
  perform t.ok(public.admin_counts() ?& array['records', 'posts', 'type_requests', 'messages'], 'counter has every key');
  perform t.root();
end $$;
