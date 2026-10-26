-- Test helpers. They impersonate Supabase callers by setting the JWT claims and switching role.
create schema if not exists t;
grant usage on schema t to public;

create or replace function t.login(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, false);
  perform set_config('request.jwt.claim.role', 'authenticated', false);
  execute 'set role authenticated';
end $$;

create or replace function t.anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claim.role', 'anon', false);
  execute 'set role anon';
end $$;

create or replace function t.service() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claim.role', 'service_role', false);
  execute 'set role service_role';
end $$;

-- Back to the superuser with no JWT, like a migration or the SQL editor.
create or replace function t.root() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', false);
  perform set_config('request.jwt.claim.role', '', false);
end $$;

-- The statement must fail, with this SQLSTATE if one is given.
create or replace function t.fails(stmt text, expected text, label text) returns void language plpgsql as $$
declare
  got text;
begin
  begin
    execute stmt;
  exception when others then
    got := sqlstate;
    if expected is not null and got <> expected then
      raise exception 'FAIL [%]: expected SQLSTATE % but got % (%)', label, expected, got, sqlerrm;
    end if;
    return;
  end;
  raise exception 'FAIL [%]: expected an error but the statement succeeded', label;
end $$;

-- Rows touched by an INSERT/UPDATE/DELETE (RLS hides rows silently, so this is how we detect it).
create or replace function t.affected(stmt text) returns bigint language plpgsql as $$
declare n bigint;
begin
  execute stmt;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function t.scalar(stmt text) returns text language plpgsql as $$
declare v text;
begin
  execute stmt into v;
  return v;
end $$;

create or replace function t.is(actual anyelement, expected anyelement, label text) returns void language plpgsql as $$
begin
  if actual is distinct from expected then
    raise exception 'FAIL [%]: expected <%> but got <%>', label, expected, actual;
  end if;
end $$;

create or replace function t.ok(cond boolean, label text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'FAIL [%]', label; end if;
end $$;

-- What Storage does when an upload finishes: an object row with the size in its metadata. Runs as the
-- function owner, so tests can stage objects for any user without going through the storage policies.
create or replace function t.put(path text, size bigint default 1000) returns void
language sql security definer as $$
  insert into storage.objects (bucket_id, name, metadata) values ('record-files', path, jsonb_build_object('size', size))
$$;
grant execute on function t.put(text, bigint) to public;

-- Stage the object and register the file in one go, as the current user. Returns the file id.
create or replace function t.file(rid uuid, kind text, filename text, analysis text default null, size bigint default 1000, parsed jsonb default null)
returns uuid language plpgsql as $$
declare
  path text := (select owner_id from public.records where id = rid)::text || '/' || rid || '/' || filename;
  fid uuid;
begin
  perform t.put(path, size);
  insert into public.record_files (record_id, kind, filename, storage_path, size_bytes, analysis_type_id, parsed)
  values (rid, kind, filename, path, size, (select id from public.analysis_types where slug = analysis), parsed)
  returning id into fid;
  return fid;
end $$;

-- Create a user (the signup trigger makes the profile). Role is set as the superuser, like the README's first-admin SQL.
create or replace function t.make_user(uid uuid, mail text, as_role public.user_role default 'user', as_status public.account_status default 'active')
returns uuid language plpgsql as $$
begin
  insert into auth.users (id, email) values (uid, mail);
  update public.profiles set role = as_role, status = as_status where id = uid;
  return uid;
end $$;
