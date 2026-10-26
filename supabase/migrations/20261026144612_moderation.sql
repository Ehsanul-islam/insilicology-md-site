-- Review history, audit log, notifications and the only functions allowed to change publication state.

create table public.review_events (
  id bigint generated always as identity primary key,
  subject_type text not null check (subject_type in ('record', 'post', 'type_request')),
  subject_id uuid not null,
  action text not null check (action in
    ('submitted', 'approved', 'changes_requested', 'rejected', 'unpublished', 'request_resolved')),
  reason text,
  actor_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index review_events_subject_idx on public.review_events (subject_type, subject_id, created_at);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  subject_type text not null,
  subject_id uuid,
  detail jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  emailed_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.review_events enable row level security;
alter table public.audit_log enable row level security;
alter table public.notifications enable row level security;

create policy review_events_read on public.review_events for select to authenticated
  using (
    public.is_admin()
    or (subject_type = 'record' and exists (select 1 from public.records r where r.id = subject_id and r.owner_id = auth.uid()))
    or (subject_type = 'post' and exists (select 1 from public.posts p where p.id = subject_id and p.owner_id = auth.uid()))
    or (subject_type = 'type_request' and exists (select 1 from public.type_requests t where t.id = subject_id and t.requested_by = auth.uid()))
  );
create policy audit_read on public.audit_log for select to authenticated using (public.is_admin());
create policy notifications_own_read on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_own_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- No insert or delete policies on these tables: rows are written by the functions below.
revoke all on public.review_events, public.audit_log, public.notifications from anon;
-- A user may only mark their own notification read, nothing else about it.
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Helpers (not callable by clients) -----------------------------------------------------------

create or replace function public._log_review(p_type text, p_id uuid, p_action text, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.review_events (subject_type, subject_id, action, reason, actor_id)
  values (p_type, p_id, p_action, p_reason, auth.uid());
  if public.is_admin() then
    insert into public.audit_log (actor_id, action, subject_type, subject_id, detail)
    values (auth.uid(), p_action, p_type, p_id, jsonb_build_object('reason', p_reason));
  end if;
end $$;

create or replace function public._notify(p_user uuid, p_kind text, p_title text, p_body text, p_link text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (user_id, kind, title, body, link) values (p_user, p_kind, p_title, p_body, p_link)
$$;

revoke execute on function public._log_review(text, uuid, text, text), public._notify(uuid, text, text, text, text)
  from public, anon, authenticated;

create or replace function public._require_admin() returns void
language plpgsql stable set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'administrator only' using errcode = '42501'; end if;
end $$;

create or replace function public._require_reason(p_reason text) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if char_length(trim(coalesce(p_reason, ''))) < 3 then
    raise exception 'a reason is required' using errcode = '22023';
  end if;
end $$;

-- Records -------------------------------------------------------------------------------------

create or replace function public._record_snapshot(r public.records) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'title', r.title,
    'description', r.description,
    'type', (select jsonb_build_object('slug', t.slug, 'name', t.name) from public.analysis_types t where t.id = r.type_id),
    'pdb_id', r.pdb_id,
    'protein_name', r.protein_name,
    'molecules', r.molecules,
    'software', r.software,
    'software_version', r.software_version,
    'force_field', r.force_field,
    'length_ns', r.length_ns,
    'replicas', r.replicas,
    'methodology', r.methodology,
    'authors', to_jsonb(r.authors),
    'doi', r.doi,
    'paper_url', r.paper_url,
    'citation_bibtex', r.citation_bibtex,
    'license', r.license,
    'project', (select jsonb_build_object('title', p.title, 'doi', p.doi, 'paper_url', p.paper_url)
                  from public.projects p where p.id = r.project_id),
    'tags', (select coalesce(jsonb_agg(t.slug order by t.slug), '[]'::jsonb)
               from public.record_tags rt join public.tags t on t.id = rt.tag_id where rt.record_id = r.id),
    'files', (select coalesce(jsonb_agg(jsonb_build_object(
                'id', f.id, 'kind', f.kind, 'filename', f.filename, 'storage_path', f.storage_path,
                'size_bytes', f.size_bytes, 'caption', f.caption, 'figure_kind', f.figure_kind, 'parsed', f.parsed
              ) order by f.created_at, f.id), '[]'::jsonb)
                from public.record_files f where f.record_id = r.id),
    'contributor', (select p.display_name from public.profiles p where p.id = r.owner_id),
    'snapshot_at', now()
  )
$$;
revoke execute on function public._record_snapshot(public.records) from public, anon, authenticated;

create or replace function public.submit_record(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.records;
  t public.analysis_types;
  need text;
begin
  select * into r from public.records where id = p_id for update;
  if not found or r.owner_id <> auth.uid() then raise exception 'record not found' using errcode = 'P0002'; end if;
  if not public.is_active() then raise exception 'this account is restricted' using errcode = '42501'; end if;
  if r.status not in ('draft', 'changes_requested', 'rejected', 'unpublished') then
    raise exception 'a record that is % cannot be submitted', r.status using errcode = '55000';
  end if;

  if r.type_id is null then raise exception 'choose a simulation type' using errcode = '23514'; end if;
  select * into t from public.analysis_types where id = r.type_id and status = 'active';
  if not found then raise exception 'this simulation type is no longer available' using errcode = '23514'; end if;
  if t.requires_structure and r.pdb_id is null then
    raise exception 'a PDB ID is required for % records', t.name using errcode = '23514';
  end if;
  if not exists (select 1 from public.record_files where record_id = r.id) then
    raise exception 'upload at least one data file' using errcode = '23514';
  end if;
  for need in select jsonb_array_elements_text(coalesce(t.file_rules -> 'required', '[]'::jsonb)) loop
    if not exists (select 1 from public.record_files where record_id = r.id and kind = need) then
      raise exception '% records need a .% file', t.name, need using errcode = '23514';
    end if;
  end loop;
  if t.field_schema ->> 'citation' = 'required' and r.doi is null and r.paper_url is null then
    raise exception 'add the DOI or link of the paper' using errcode = '23514';
  end if;
  if t.field_schema ->> 'molecules' = 'required' and jsonb_array_length(r.molecules) = 0 then
    raise exception 'describe the molecular system' using errcode = '23514';
  end if;

  update public.records set status = 'pending', submitted_at = now(), admin_feedback = null where id = p_id;
  perform public._log_review('record', p_id, 'submitted', null);
end $$;

create or replace function public.approve_record(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.records;
  snap jsonb;
begin
  perform public._require_admin();
  select * into r from public.records where id = p_id for update;
  if not found then raise exception 'record not found' using errcode = 'P0002'; end if;
  if r.status <> 'pending' then raise exception 'only a pending record can be approved' using errcode = '55000'; end if;

  snap := public._record_snapshot(r);
  update public.records set
    status = 'published',
    is_public = true,
    published_at = coalesce(published_at, now()),
    published_snapshot = snap,
    admin_feedback = null,
    public_search =
      setweight(to_tsvector('simple', coalesce(snap ->> 'title', '') || ' ' || coalesce(snap ->> 'pdb_id', '')), 'A') ||
      setweight(to_tsvector('simple', coalesce(snap ->> 'protein_name', '') || ' ' || coalesce(snap #>> '{type,name}', '') || ' '
        || coalesce((select string_agg(m ->> 'name', ' ') from jsonb_array_elements(snap -> 'molecules') m), '')), 'B') ||
      setweight(to_tsvector('simple', coalesce((select string_agg(x, ' ') from jsonb_array_elements_text(snap -> 'tags') x), '') || ' '
        || coalesce(snap ->> 'force_field', '') || ' ' || coalesce(snap ->> 'software', '')), 'C') ||
      setweight(to_tsvector('simple', coalesce(snap ->> 'description', '') || ' '
        || coalesce((select string_agg(x, ' ') from jsonb_array_elements_text(snap -> 'authors') x), '')), 'D')
  where id = p_id;
  perform public._log_review('record', p_id, 'approved', null);
  perform public._notify(r.owner_id, 'record_approved', 'Your simulation was published', r.title, '/simulations/' || r.slug);
end $$;

create or replace function public.request_changes_record(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.records;
begin
  perform public._require_admin();
  perform public._require_reason(p_reason);
  select * into r from public.records where id = p_id for update;
  if not found then raise exception 'record not found' using errcode = 'P0002'; end if;
  if r.status <> 'pending' then raise exception 'only a pending record can be sent back' using errcode = '55000'; end if;
  update public.records set status = 'changes_requested', admin_feedback = trim(p_reason) where id = p_id;
  perform public._log_review('record', p_id, 'changes_requested', trim(p_reason));
  perform public._notify(r.owner_id, 'record_changes', 'Changes requested on your simulation', trim(p_reason), '/dashboard/records/' || r.id);
end $$;

create or replace function public.reject_record(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.records;
begin
  perform public._require_admin();
  perform public._require_reason(p_reason);
  select * into r from public.records where id = p_id for update;
  if not found then raise exception 'record not found' using errcode = 'P0002'; end if;
  if r.status <> 'pending' then raise exception 'only a pending record can be rejected' using errcode = '55000'; end if;
  update public.records set status = 'rejected', admin_feedback = trim(p_reason) where id = p_id;
  perform public._log_review('record', p_id, 'rejected', trim(p_reason));
  perform public._notify(r.owner_id, 'record_rejected', 'Your simulation was not approved', trim(p_reason), '/dashboard/records/' || r.id);
end $$;

create or replace function public.unpublish_record(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  r public.records;
begin
  perform public._require_admin();
  perform public._require_reason(p_reason);
  select * into r from public.records where id = p_id for update;
  if not found then raise exception 'record not found' using errcode = 'P0002'; end if;
  if not r.is_public then raise exception 'this record is not published' using errcode = '55000'; end if;
  update public.records set
    status = 'unpublished', is_public = false, published_snapshot = null, public_search = null,
    admin_feedback = trim(p_reason)
  where id = p_id;
  perform public._log_review('record', p_id, 'unpublished', trim(p_reason));
  perform public._notify(r.owner_id, 'record_unpublished', 'Your simulation was unpublished', trim(p_reason), '/dashboard/records/' || r.id);
end $$;

-- Posts ---------------------------------------------------------------------------------------

create or replace function public._post_snapshot(p public.posts) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'title', p.title,
    'excerpt', p.excerpt,
    'content_md', p.content_md,
    'featured_image_path', p.featured_image_path,
    'category', (select jsonb_build_object('slug', c.slug, 'name', c.name) from public.blog_categories c where c.id = p.category_id),
    'tags', (select coalesce(jsonb_agg(t.slug order by t.slug), '[]'::jsonb)
               from public.post_tags pt join public.tags t on t.id = pt.tag_id where pt.post_id = p.id),
    'refs', p.refs,
    'author_name', (select pr.display_name from public.profiles pr where pr.id = p.owner_id),
    'snapshot_at', now()
  )
$$;
revoke execute on function public._post_snapshot(public.posts) from public, anon, authenticated;

create or replace function public.submit_post(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p public.posts;
begin
  select * into p from public.posts where id = p_id for update;
  if not found or p.owner_id <> auth.uid() then raise exception 'post not found' using errcode = 'P0002'; end if;
  if not public.is_active() then raise exception 'this account is restricted' using errcode = '42501'; end if;
  if p.status not in ('draft', 'changes_requested', 'rejected', 'unpublished') then
    raise exception 'a post that is % cannot be submitted', p.status using errcode = '55000';
  end if;
  if char_length(trim(p.excerpt)) < 20 then raise exception 'add a short excerpt (at least 20 characters)' using errcode = '23514'; end if;
  if char_length(trim(p.content_md)) < 200 then raise exception 'the article is too short to review' using errcode = '23514'; end if;
  if p.category_id is null then raise exception 'choose a category' using errcode = '23514'; end if;
  update public.posts set status = 'pending', submitted_at = now(), admin_feedback = null where id = p_id;
  perform public._log_review('post', p_id, 'submitted', null);
end $$;

create or replace function public.approve_post(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p public.posts;
  snap jsonb;
begin
  perform public._require_admin();
  select * into p from public.posts where id = p_id for update;
  if not found then raise exception 'post not found' using errcode = 'P0002'; end if;
  if p.status <> 'pending' then raise exception 'only a pending post can be approved' using errcode = '55000'; end if;
  snap := public._post_snapshot(p);
  update public.posts set
    status = 'published', is_public = true, published_at = coalesce(published_at, now()),
    published_snapshot = snap, admin_feedback = null,
    public_search =
      setweight(to_tsvector('simple', coalesce(snap ->> 'title', '')), 'A') ||
      setweight(to_tsvector('simple', coalesce(snap ->> 'excerpt', '') || ' '
        || coalesce((select string_agg(x, ' ') from jsonb_array_elements_text(snap -> 'tags') x), '')), 'B') ||
      setweight(to_tsvector('simple', coalesce(snap ->> 'content_md', '')), 'D')
  where id = p_id;
  perform public._log_review('post', p_id, 'approved', null);
  perform public._notify(p.owner_id, 'post_approved', 'Your article was published', p.title, '/blog/' || p.slug);
end $$;

create or replace function public.request_changes_post(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p public.posts;
begin
  perform public._require_admin();
  perform public._require_reason(p_reason);
  select * into p from public.posts where id = p_id for update;
  if not found then raise exception 'post not found' using errcode = 'P0002'; end if;
  if p.status <> 'pending' then raise exception 'only a pending post can be sent back' using errcode = '55000'; end if;
  update public.posts set status = 'changes_requested', admin_feedback = trim(p_reason) where id = p_id;
  perform public._log_review('post', p_id, 'changes_requested', trim(p_reason));
  perform public._notify(p.owner_id, 'post_changes', 'Changes requested on your article', trim(p_reason), '/dashboard/blog/' || p.id);
end $$;

create or replace function public.reject_post(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p public.posts;
begin
  perform public._require_admin();
  perform public._require_reason(p_reason);
  select * into p from public.posts where id = p_id for update;
  if not found then raise exception 'post not found' using errcode = 'P0002'; end if;
  if p.status <> 'pending' then raise exception 'only a pending post can be rejected' using errcode = '55000'; end if;
  update public.posts set status = 'rejected', admin_feedback = trim(p_reason) where id = p_id;
  perform public._log_review('post', p_id, 'rejected', trim(p_reason));
  perform public._notify(p.owner_id, 'post_rejected', 'Your article was not approved', trim(p_reason), '/dashboard/blog/' || p.id);
end $$;

create or replace function public.unpublish_post(p_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p public.posts;
begin
  perform public._require_admin();
  perform public._require_reason(p_reason);
  select * into p from public.posts where id = p_id for update;
  if not found then raise exception 'post not found' using errcode = 'P0002'; end if;
  if not p.is_public then raise exception 'this post is not published' using errcode = '55000'; end if;
  update public.posts set
    status = 'unpublished', is_public = false, published_snapshot = null, public_search = null, admin_feedback = trim(p_reason)
  where id = p_id;
  perform public._log_review('post', p_id, 'unpublished', trim(p_reason));
  perform public._notify(p.owner_id, 'post_unpublished', 'Your article was unpublished', trim(p_reason), '/dashboard/blog/' || p.id);
end $$;

-- Type requests -------------------------------------------------------------------------------

create or replace function public.resolve_type_request(
  p_id uuid, p_status public.request_status, p_merged_into uuid default null, p_note text default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  t public.type_requests;
begin
  perform public._require_admin();
  if p_status = 'open' then raise exception 'choose approved, rejected or merged' using errcode = '22023'; end if;
  if p_status = 'merged' and p_merged_into is null then raise exception 'say which type it merges into' using errcode = '22023'; end if;
  select * into t from public.type_requests where id = p_id for update;
  if not found then raise exception 'request not found' using errcode = 'P0002'; end if;
  update public.type_requests set status = p_status, merged_into = p_merged_into, admin_note = p_note,
    reviewed_by = auth.uid(), reviewed_at = now() where id = p_id;
  perform public._log_review('type_request', p_id, 'request_resolved', p_status::text || coalesce(': ' || p_note, ''));
  perform public._notify(t.requested_by, 'type_request_' || p_status::text, 'Your category request was ' || p_status::text, coalesce(p_note, t.name), null);
end $$;

-- Other records with the same PDB ID and type, to help an administrator spot duplicates.
create or replace function public.find_similar_records(p_id uuid)
returns table (id uuid, slug text, title text, owner_id uuid, status public.moderation_status, same_owner boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  r public.records;
begin
  perform public._require_admin();
  select * into r from public.records x where x.id = p_id;
  return query
    select o.id, o.slug, o.title, o.owner_id, o.status, o.owner_id = r.owner_id
    from public.records o
    where o.id <> r.id and r.pdb_id is not null and o.pdb_id = r.pdb_id and o.type_id is not distinct from r.type_id;
end $$;

-- Audit trail for administrator edits to taxonomy and accounts ---------------------------------

create or replace function public.audit_row_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return coalesce(new, old); end if;   -- migrations, seeds, service role
  insert into public.audit_log (actor_id, action, subject_type, subject_id, detail)
  values (auth.uid(), lower(tg_op), tg_table_name,
          coalesce((to_jsonb(new) ->> 'id'), (to_jsonb(old) ->> 'id'))::uuid,
          case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end);
  return coalesce(new, old);
end $$;

create trigger analysis_types_audit after insert or update or delete on public.analysis_types
  for each row execute function public.audit_row_change();
create trigger blog_categories_audit after insert or update or delete on public.blog_categories
  for each row execute function public.audit_row_change();
create trigger profiles_audit after update on public.profiles
  for each row when (old.role is distinct from new.role or old.status is distinct from new.status)
  execute function public.audit_row_change();

-- Clients may call the review functions; each one checks who is calling.
revoke execute on function
  public.submit_record(uuid), public.approve_record(uuid), public.request_changes_record(uuid, text),
  public.reject_record(uuid, text), public.unpublish_record(uuid, text),
  public.submit_post(uuid), public.approve_post(uuid), public.request_changes_post(uuid, text),
  public.reject_post(uuid, text), public.unpublish_post(uuid, text),
  public.resolve_type_request(uuid, public.request_status, uuid, text), public.find_similar_records(uuid),
  public.ensure_tags(text[])
  from public, anon;
