-- Analysis types (admin-managed), type requests, tags and blog categories.

-- "MM/PBSA", "mm pbsa" and "MM-PBSA" all become "mmpbsa".
create or replace function public.normalise_key(t text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select lower(regexp_replace(coalesce(t, ''), '[^[:alnum:]]+', '', 'g'))
$$;

create or replace function public.slugify(t text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select trim(both '-' from regexp_replace(lower(coalesce(t, '')), '[^a-z0-9]+', '-', 'g'))
$$;

create type public.type_status as enum ('active', 'archived');

create table public.analysis_types (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 120),
  aliases text[] not null default '{}',
  summary text not null default '',
  -- Page copy for the /analysis/[slug] hub, one paragraph per element. Edited by admins.
  intro text[] not null default '{}',
  command text,
  tutorial_slug text,
  requires_structure boolean not null default true,
  -- Which optional sections the upload form requires for this type, e.g. {"citation":"required"}.
  field_schema jsonb not null default '{}'::jsonb check (jsonb_typeof(field_schema) = 'object'),
  -- {"allowed":["xvg","csv"],"required":["xvg"],"max_mb":50}
  file_rules jsonb not null default '{}'::jsonb check (jsonb_typeof(file_rules) = 'object'),
  status public.type_status not null default 'active',
  sort_order int not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger analysis_types_touch before update on public.analysis_types
  for each row execute function public.touch_updated_at();

-- Every slug, name and alias of every type, normalised. The primary key is what stops two types
-- from claiming the same alias, so "RMSD" and "Protein RMSD" can never become separate categories.
create table public.analysis_type_keys (
  key text primary key,
  type_id uuid not null references public.analysis_types (id) on delete cascade
);

create or replace function public.analysis_types_sync_keys() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  k text;
begin
  delete from public.analysis_type_keys where type_id = new.id;
  for k in
    select distinct public.normalise_key(x) from unnest(array[new.slug, new.name] || new.aliases) as x
  loop
    if k <> '' then
      begin
        insert into public.analysis_type_keys (key, type_id) values (k, new.id);
      exception when unique_violation then
        raise exception 'the name, slug or alias "%" is already used by another analysis type', k using errcode = '23505';
      end;
    end if;
  end loop;
  return new;
end $$;

create trigger analysis_types_sync_keys after insert or update of slug, name, aliases on public.analysis_types
  for each row execute function public.analysis_types_sync_keys();

-- Free text (slug, name or alias) to its canonical type.
create or replace function public.resolve_analysis_type(q text) returns public.analysis_types
language sql stable security definer set search_path = '' as $$
  select t.* from public.analysis_type_keys k
  join public.analysis_types t on t.id = k.type_id
  where k.key = public.normalise_key(q) and t.status = 'active'
$$;

create type public.request_status as enum ('open', 'approved', 'rejected', 'merged');

-- Users cannot create types. They ask, and an administrator decides.
create table public.type_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  reason text check (char_length(reason) <= 2000),
  status public.request_status not null default 'open',
  merged_into uuid references public.analysis_types (id) on delete set null,
  admin_note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index type_requests_status_idx on public.type_requests (status, created_at);

-- Free-form tags, stored as normalised slugs.
create table public.tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  name text not null check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now()
);

create or replace function public.tags_normalise() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.slug := public.slugify(coalesce(nullif(new.slug, ''), new.name));
  if new.slug = '' then raise exception 'a tag needs letters or digits'; end if;
  return new;
end $$;
create trigger tags_normalise before insert or update on public.tags
  for each row execute function public.tags_normalise();

create table public.blog_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 80),
  description text not null default '',
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);

-- Row-level security -------------------------------------------------------------------------
alter table public.analysis_types enable row level security;
alter table public.analysis_type_keys enable row level security;
alter table public.type_requests enable row level security;
alter table public.tags enable row level security;
alter table public.blog_categories enable row level security;

create policy types_read on public.analysis_types for select to anon, authenticated
  using (status = 'active' or public.is_admin());
create policy types_admin_write on public.analysis_types for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Lookup keys are internal; only the SECURITY DEFINER functions touch them.
revoke all on public.analysis_type_keys from anon, authenticated;

create policy requests_own_read on public.type_requests for select to authenticated
  using (requested_by = auth.uid() or public.is_admin());
create policy requests_own_insert on public.type_requests for insert to authenticated
  with check (requested_by = auth.uid() and public.is_active() and status = 'open');
create policy requests_admin_update on public.type_requests for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy tags_read on public.tags for select to anon, authenticated using (true);
create policy tags_insert on public.tags for insert to authenticated with check (public.is_active());
create policy tags_admin_write on public.tags for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy tags_admin_delete on public.tags for delete to authenticated using (public.is_admin());

create policy categories_read on public.blog_categories for select to anon, authenticated using (true);
create policy categories_admin_write on public.blog_categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
