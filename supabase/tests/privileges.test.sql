-- Who may execute which function through the API (what Supabase's security advisor checks), and the
-- projects policy.
do $$
declare
  a   constant uuid := '00000000-0000-0000-0000-00000000a701';
  rs  constant uuid := '00000000-0000-0000-0000-00000000c701';
  adm constant uuid := '00000000-0000-0000-0000-00000000ad08';
  fn text;
  pid uuid;
begin
  perform t.make_user(a, 'priv-user@example.org');
  perform t.make_user(rs, 'priv-restricted@example.org');
  perform t.make_user(adm, 'priv-admin@example.org', 'admin');

  -- trigger and internal functions cannot be called by clients
  foreach fn in array array[
    'public.analysis_types_sync_keys()', 'public.audit_row_change()', 'public.handle_new_user()',
    'public.post_child_changed()', 'public.record_child_changed()', 'public.record_files_check()',
    'public.profiles_guard()', 'public.records_before_write()', 'public.posts_before_write()',
    'public.tags_normalise()', 'public.touch_updated_at()',
    'public.record_files_rules()', 'public.record_limits()',
    'public._log_review(text, uuid, text, text)', 'public._notify(uuid, text, text, text, text)',
    'public._record_snapshot(public.records)', 'public._post_snapshot(public.posts)'
  ] loop
    perform t.is(has_function_privilege('anon', fn, 'execute'), false, 'anon cannot execute ' || fn);
    perform t.is(has_function_privilege('authenticated', fn, 'execute'), false, 'authenticated cannot execute ' || fn);
  end loop;

  -- policies and the app still need these
  foreach fn in array array[
    'public.is_admin()', 'public.is_active()', 'public.can_edit_record(uuid)', 'public.can_edit_post(uuid)',
    'public.can_write_record_path(text)', 'public.slugify(text)', 'public.normalise_key(text)'
  ] loop
    perform t.is(has_function_privilege('authenticated', fn, 'execute'), true, 'authenticated can execute ' || fn);
  end loop;
  perform t.is(has_function_privilege('anon', 'public.is_admin()', 'execute'), true, 'anon can execute is_admin (used by policies)');
  perform t.is(has_function_privilege('anon', 'public.search_records(text, text, text, text, int, int)', 'execute'), true, 'search is public');
  perform t.is(has_function_privilege('anon', 'public.resolve_analysis_type(text)', 'execute'), true, 'type lookup is public');

  -- the review functions: signed-in users may call them (each checks the caller), anonymous visitors may not
  foreach fn in array array[
    'public.submit_record(uuid)', 'public.approve_record(uuid)', 'public.reject_record(uuid, text)',
    'public.request_changes_record(uuid, text)', 'public.unpublish_record(uuid, text)', 'public.submit_post(uuid)',
    'public.approve_post(uuid)', 'public.reject_post(uuid, text)', 'public.request_changes_post(uuid, text)',
    'public.unpublish_post(uuid, text)', 'public.ensure_tags(text[])', 'public.admin_counts()',
    'public.find_similar_records(uuid)'
  ] loop
    perform t.is(has_function_privilege('anon', fn, 'execute'), false, 'anon cannot execute ' || fn);
    perform t.is(has_function_privilege('authenticated', fn, 'execute'), true, 'authenticated can execute ' || fn);
  end loop;

  -- the contact function is for the service role only
  perform t.is(has_function_privilege('anon', 'public.submit_contact_message(text,text,text,text,text,text,uuid)', 'execute'), false, 'anon: contact');
  perform t.is(has_function_privilege('authenticated', 'public.submit_contact_message(text,text,text,text,text,text,uuid)', 'execute'), false, 'authenticated: contact');
  perform t.is(has_function_privilege('service_role', 'public.submit_contact_message(text,text,text,text,text,text,uuid)', 'execute'), true, 'service: contact');

  -- internal lookup keys stay unreadable (privileges are revoked; the deny-all policy is a second layer)
  perform t.login(a);
  perform t.fails('select count(*) from public.analysis_type_keys', '42501', 'keys are not readable by users');
  perform t.anon();
  perform t.fails('select count(*) from public.analysis_type_keys', '42501', 'keys are not readable by anon');

  -- projects: owners manage their own, restricted users can still read them, nobody sees others'
  perform t.login(a);
  insert into public.projects (owner_id, title) values (a, 'Paper A') returning id into pid;
  perform t.is((select count(*) from public.projects), 1::bigint, 'owner sees own project');
  perform t.is(t.affected(format($q$update public.projects set title = 'Paper A v2' where id = %L$q$, pid)), 1::bigint, 'owner edits own project');
  perform t.login(adm);
  perform t.is((select count(*) from public.projects), 1::bigint, 'admin sees every project');
  perform t.login(rs);
  perform t.is((select count(*) from public.projects), 0::bigint, 'other users do not see it');
  perform t.root();
  update public.profiles set status = 'restricted' where id = a;
  perform t.login(a);
  perform t.is((select count(*) from public.projects), 1::bigint, 'a restricted owner can still read their project');
  perform t.is(t.affected(format($q$update public.projects set title = 'x' where id = %L$q$, pid)), 0::bigint, 'but cannot change it');
  perform t.fails($q$insert into public.projects (owner_id, title) values ('00000000-0000-0000-0000-00000000a701', 'New one')$q$, '42501', 'or add one');
  perform t.root();
end $$;
