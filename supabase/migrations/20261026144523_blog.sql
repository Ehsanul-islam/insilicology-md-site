-- Blog posts. Same publication model as records (0003): the row is the working copy,
-- `published_snapshot` is what the public sees, and only an administrator's approval writes it.

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  category_id uuid references public.blog_categories (id) on delete set null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  title text not null check (char_length(title) between 3 and 200),
  excerpt text not null default '' check (char_length(excerpt) <= 400),
  content_md text not null default '' check (char_length(content_md) <= 200000),
  -- path inside the public blog-images bucket, e.g. <owner>/<post>/cover.webp
  featured_image_path text,
  -- [{"text":"Smith et al. 2024. ...","url":"https://doi.org/..."}]
  refs jsonb not null default '[]'::jsonb check (jsonb_typeof(refs) = 'array'),

  status public.moderation_status not null default 'draft',
  admin_feedback text,
  submitted_at timestamptz,
  is_public boolean not null default false,
  published_at timestamptz,
  published_snapshot jsonb,
  public_search tsvector,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_public or published_snapshot is not null)
);
create index posts_owner_idx on public.posts (owner_id, updated_at desc);
create index posts_status_idx on public.posts (status, submitted_at);
create index posts_public_idx on public.posts (published_at desc) where is_public;
create index posts_search_idx on public.posts using gin (public_search);
create trigger posts_touch before update on public.posts
  for each row execute function public.touch_updated_at();

create table public.post_tags (
  post_id uuid not null references public.posts (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (post_id, tag_id)
);

create or replace function public.posts_before_write() returns trigger
language plpgsql set search_path = '' as $$
declare
  base text;
  candidate text;
  n int := 1;
begin
  if tg_op = 'INSERT' then
    if coalesce(new.slug, '') = '' then
      base := coalesce(nullif(public.slugify(new.title), ''), 'post');
      candidate := left(base, 100);
      while exists (select 1 from public.posts where slug = candidate) loop
        n := n + 1;
        candidate := left(base, 95) || '-' || n;
      end loop;
      new.slug := candidate;
    else
      new.slug := public.slugify(new.slug);
    end if;
    return new;
  end if;

  if current_user in ('authenticated', 'anon') then
    if new.owner_id is distinct from old.owner_id
       or new.status is distinct from old.status
       or new.admin_feedback is distinct from old.admin_feedback
       or new.submitted_at is distinct from old.submitted_at
       or new.is_public is distinct from old.is_public
       or new.published_at is distinct from old.published_at
       or new.published_snapshot is distinct from old.published_snapshot
       or new.public_search is distinct from old.public_search then
      raise exception 'status, publication and ownership can only be changed through the review functions'
        using errcode = '42501';
    end if;
    -- a published URL is permanent
    if new.slug is distinct from old.slug then
      if old.published_at is not null then
        raise exception 'the URL of a published article cannot change' using errcode = '42501';
      end if;
      new.slug := public.slugify(new.slug);
    end if;
    if old.status = 'published' then
      new.status := case when public.is_admin() then 'pending' else 'draft' end;
    end if;
  end if;
  return new;
end $$;
create trigger posts_before_write before insert or update on public.posts
  for each row execute function public.posts_before_write();

create or replace function public.post_child_changed() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  pid uuid := coalesce(new.post_id, old.post_id);
begin
  update public.posts
     set status = case when public.is_admin() then 'pending'::public.moderation_status else 'draft'::public.moderation_status end,
         updated_at = now()
   where id = pid and status = 'published';
  return coalesce(new, old);
end $$;
create trigger post_tags_changed after insert or delete on public.post_tags
  for each row execute function public.post_child_changed();

create or replace function public.can_edit_post(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.is_admin() or exists (
    select 1 from public.posts p
    where p.id = pid and p.owner_id = auth.uid() and public.is_active()
      and p.status in ('draft', 'changes_requested', 'rejected', 'unpublished', 'published')
  )
$$;

alter table public.posts enable row level security;
alter table public.post_tags enable row level security;

create policy posts_read on public.posts for select to authenticated
  using (owner_id = auth.uid() or public.is_admin());
create policy posts_insert on public.posts for insert to authenticated
  with check (owner_id = auth.uid() and public.is_active() and status = 'draft' and not is_public
              and published_snapshot is null and admin_feedback is null);
create policy posts_update_own on public.posts for update to authenticated
  using (owner_id = auth.uid() and public.is_active()
         and status in ('draft', 'changes_requested', 'rejected', 'unpublished', 'published'))
  with check (owner_id = auth.uid());
create policy posts_update_admin on public.posts for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy posts_delete_own on public.posts for delete to authenticated
  using (owner_id = auth.uid() and public.is_active() and not is_public and status in ('draft', 'rejected'));
create policy posts_delete_admin on public.posts for delete to authenticated using (public.is_admin());

create policy ptags_read on public.post_tags for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id and (p.owner_id = auth.uid() or public.is_admin())));
create policy ptags_write on public.post_tags for insert to authenticated with check (public.can_edit_post(post_id));
create policy ptags_delete on public.post_tags for delete to authenticated using (public.can_edit_post(post_id));

revoke all on public.posts, public.post_tags from anon;

create or replace view public.public_posts as
select
  p.id,
  p.slug,
  s ->> 'title' as title,
  s ->> 'excerpt' as excerpt,
  s ->> 'content_md' as content_md,
  s ->> 'featured_image_path' as featured_image_path,
  s #>> '{category,slug}' as category_slug,
  s #>> '{category,name}' as category_name,
  array(select jsonb_array_elements_text(coalesce(s -> 'tags', '[]'::jsonb))) as tags,
  coalesce(s -> 'refs', '[]'::jsonb) as refs,
  s ->> 'author_name' as author_name,
  p.published_at,
  (s ->> 'snapshot_at')::timestamptz as updated_at
from public.posts p
cross join lateral (select p.published_snapshot as s) x
where p.is_public;

grant select on public.public_posts to anon, authenticated;
