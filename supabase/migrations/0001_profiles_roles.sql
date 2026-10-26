-- Profiles, roles and the helpers every later policy uses.

create extension if not exists pg_trgm with schema extensions;

create type public.user_role as enum ('user', 'admin');
create type public.account_status as enum ('active', 'restricted');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 120),
  affiliation text check (char_length(affiliation) <= 200),
  orcid text check (orcid ~ '^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$'),
  avatar_url text check (avatar_url ~ '^https://'),
  role public.user_role not null default 'user',
  status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- True when the caller is an active administrator. SECURITY DEFINER so policies can call it
-- without being able to read other users' profile rows.
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.status = 'active'
  )
$$;

-- True when the caller is signed in and not restricted. Restricted users are read-only.
create or replace function public.is_active() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.status = 'active'
  )
$$;

-- Create a profile whenever someone signs up.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(new.email, ''), '@', 1)), 120)
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Users may edit their own profile text but never their role or status. Direct SQL (migrations,
-- the SQL editor, the service role) has no JWT subject, so it can still promote the first admin.
create or replace function public.profiles_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role or new.status is distinct from old.status or new.id is distinct from old.id then
      raise exception 'only an administrator can change role or status' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid() and public.is_active())
  with check (id = auth.uid());

create policy profiles_update_admin on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- No insert or delete policies: profiles are created by the trigger and removed with the auth user.
revoke all on public.profiles from anon;
