do $$
declare
  alice constant uuid := '00000000-0000-0000-0000-00000000a001';
  bob   constant uuid := '00000000-0000-0000-0000-00000000b001';
  adm   constant uuid := '00000000-0000-0000-0000-00000000ad01';
  rest  constant uuid := '00000000-0000-0000-0000-00000000c001';
begin
  perform t.make_user(alice, 'alice@example.org');
  perform t.make_user(bob, 'bob@example.org');
  perform t.make_user(adm, 'admin@example.org', 'admin');
  perform t.make_user(rest, 'restricted@example.org', 'user', 'restricted');

  perform t.is((select display_name from public.profiles where id = alice), 'alice', 'profile created on signup from the email');

  -- a signed-in user sees only their own profile; an admin sees all
  perform t.login(alice);
  perform t.is((select count(*) from public.profiles), 1::bigint, 'user sees only own profile');
  perform t.is(t.affected($q$update public.profiles set display_name = 'Alice A.' where id = '00000000-0000-0000-0000-00000000a001'$q$), 1::bigint, 'user edits own display name');
  perform t.is(t.affected($q$update public.profiles set display_name = 'hacked' where id = '00000000-0000-0000-0000-00000000b001'$q$), 0::bigint, 'user cannot edit another profile');
  perform t.fails($q$update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-00000000a001'$q$, '42501', 'user cannot promote self');
  perform t.fails($q$update public.profiles set status = 'restricted' where id = '00000000-0000-0000-0000-00000000a001'$q$, '42501', 'user cannot change own status');
  perform t.fails($q$update public.profiles set orcid = 'nope' where id = '00000000-0000-0000-0000-00000000a001'$q$, '23514', 'orcid format is checked');
  perform t.fails($q$insert into public.profiles (id) values (gen_random_uuid())$q$, '42501', 'no direct profile inserts');
  perform t.is(t.affected($q$delete from public.profiles where id = '00000000-0000-0000-0000-00000000a001'$q$), 0::bigint, 'no direct profile deletes');
  perform t.is(public.is_admin(), false, 'user is not admin');

  perform t.anon();
  perform t.fails('select * from public.profiles', '42501', 'anon cannot read profiles');
  perform t.is(public.is_admin(), false, 'anon is not admin');

  perform t.login(adm);
  perform t.is((select count(*) from public.profiles), 4::bigint, 'admin sees all profiles');
  perform t.is(t.affected($q$update public.profiles set status = 'restricted' where id = '00000000-0000-0000-0000-00000000b001'$q$), 1::bigint, 'admin restricts an account');
  perform t.is(t.affected($q$update public.profiles set status = 'active' where id = '00000000-0000-0000-0000-00000000b001'$q$), 1::bigint, 'admin restores it');
  perform t.is((select count(*) from public.audit_log where subject_type = 'profiles'), 2::bigint, 'role/status changes by an admin are audited');

  -- restricted users are read-only
  perform t.login(rest);
  perform t.is(public.is_active(), false, 'restricted user is not active');
  perform t.is(t.affected($q$update public.profiles set display_name = 'x' where id = '00000000-0000-0000-0000-00000000c001'$q$), 0::bigint, 'restricted user cannot edit profile');

  -- a demoted admin loses admin powers immediately
  perform t.root();
  update public.profiles set role = 'user' where id = adm;
  perform t.login(adm);
  perform t.is(public.is_admin(), false, 'demoted admin is no longer admin');
  perform t.root();
end $$;
