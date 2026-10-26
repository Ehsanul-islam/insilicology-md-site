do $$
declare
  a   constant uuid := '00000000-0000-0000-0000-00000000a401';
  b   constant uuid := '00000000-0000-0000-0000-00000000b401';
  adm constant uuid := '00000000-0000-0000-0000-00000000ad05';
  rs  constant uuid := '00000000-0000-0000-0000-00000000c401';
  cat uuid; pid uuid; pid2 uuid; pid3 uuid; first_pub timestamptz;
  body constant text := repeat('Molecular dynamics follows atoms through time. ', 8);
begin
  perform t.make_user(a, 'post-author@example.org');
  perform t.make_user(b, 'post-other@example.org');
  perform t.make_user(adm, 'post-admin@example.org', 'admin');
  perform t.make_user(rs, 'post-restricted@example.org', 'user', 'restricted');
  update public.profiles set display_name = 'Dr Writer' where id = a;
  select id into cat from public.blog_categories where slug = 'research';

  perform t.login(a);
  insert into public.posts (owner_id, title) values (a, 'My First Article') returning id into pid;
  perform t.is((select slug from public.posts where id = pid), 'my-first-article', 'slug from title');
  perform t.is((select status::text from public.posts where id = pid), 'draft', 'new posts are drafts');
  insert into public.posts (owner_id, title) values (a, 'My First Article') returning id into pid2;
  perform t.is((select slug from public.posts where id = pid2), 'my-first-article-2', 'slug collision numbered');
  insert into public.posts (owner_id, title, slug) values (a, 'Whatever', 'Custom Slug!') returning id into pid3;
  perform t.is((select slug from public.posts where id = pid3), 'custom-slug', 'explicit slug is normalised');
  perform t.fails($q$insert into public.posts (owner_id, title, slug) values ('00000000-0000-0000-0000-00000000a401', 'Dup', 'custom-slug')$q$, '23505', 'explicit slug that is taken is an error');
  perform t.fails($q$insert into public.posts (owner_id, title, refs) values ('00000000-0000-0000-0000-00000000a401', 'Bad refs', '{}')$q$, '23514', 'references must be an array');
  perform t.fails($q$insert into public.posts (owner_id, title) values ('00000000-0000-0000-0000-00000000a401', 'No')$q$, '23514', 'title length');

  -- tampering
  perform t.fails($q$insert into public.posts (owner_id, title, status) values ('00000000-0000-0000-0000-00000000a401', 'Born published', 'published')$q$, '42501', 'cannot insert as published');
  perform t.fails($q$insert into public.posts (owner_id, title) values ('00000000-0000-0000-0000-00000000b401', 'As someone else')$q$, '42501', 'cannot post as someone else');
  perform t.fails(format($q$update public.posts set status = 'published' where id = %L$q$, pid), '42501', 'cannot self-publish');
  perform t.fails(format($q$update public.posts set is_public = true where id = %L$q$, pid), '42501', 'cannot set is_public');
  perform t.fails(format($q$update public.posts set published_snapshot = '{}' where id = %L$q$, pid), '42501', 'cannot write snapshot');
  perform t.fails(format($q$update public.posts set owner_id = %L where id = %L$q$, b, pid), '42501', 'cannot reassign');
  perform t.is(t.affected(format($q$update public.posts set slug = 'renamed-before-publish' where id = %L$q$, pid2)), 1::bigint, 'slug can change before first publication');

  -- others
  perform t.login(b);
  perform t.is((select count(*) from public.posts), 0::bigint, 'other user sees no drafts');
  perform t.is(t.affected(format($q$update public.posts set title = 'stolen' where id = %L$q$, pid)), 0::bigint, 'other user cannot edit');
  perform t.fails(format($q$select public.submit_post(%L)$q$, pid), 'P0002', 'other user cannot submit');
  perform t.anon();
  perform t.fails('select * from public.posts', '42501', 'anon cannot read posts');
  perform t.is((select count(*) from public.public_posts), 0::bigint, 'nothing public');
  perform t.login(rs);
  perform t.fails($q$insert into public.posts (owner_id, title) values ('00000000-0000-0000-0000-00000000c401', 'Restricted')$q$, '42501', 'restricted user cannot write');

  -- submit validations
  perform t.login(a);
  perform t.fails(format($q$select public.submit_post(%L)$q$, pid), '23514', 'excerpt required');
  update public.posts set excerpt = 'A short but sufficient excerpt.' where id = pid;
  perform t.fails(format($q$select public.submit_post(%L)$q$, pid), '23514', 'body too short');
  update public.posts set content_md = body where id = pid;
  perform t.fails(format($q$select public.submit_post(%L)$q$, pid), '23514', 'category required');
  update public.posts set category_id = cat, refs = '[{"text":"Smith 2024","url":"https://doi.org/10.1000/x"}]', featured_image_path = a || '/' || pid || '/cover.webp' where id = pid;
  perform public.ensure_tags(array['Post Tag', 'Second Tag']);
  insert into public.post_tags (post_id, tag_id) select pid, id from public.tags where slug = 'post-tag';
  perform public.submit_post(pid);
  perform t.is((select status::text from public.posts where id = pid), 'pending', 'submitted');
  perform t.fails(format($q$select public.submit_post(%L)$q$, pid), '55000', 'cannot submit twice');
  perform t.is(t.affected(format($q$update public.posts set title = 'edited while pending' where id = %L$q$, pid)), 0::bigint, 'cannot edit while pending');
  perform t.fails(format($q$insert into public.post_tags (post_id, tag_id) select %L, id from public.tags where slug = 'second-tag'$q$, pid), '42501', 'cannot retag while pending');

  -- decisions are admin-only
  perform t.fails(format($q$select public.approve_post(%L)$q$, pid), '42501', 'author cannot approve own post');
  perform t.login(b);
  perform t.fails(format($q$select public.reject_post(%L, 'no')$q$, pid), '42501', 'other user cannot reject');
  perform t.anon();
  perform t.fails(format($q$select public.approve_post(%L)$q$, pid), '42501', 'anon cannot approve');
  perform t.login(adm);
  perform t.fails(format($q$select public.request_changes_post(%L, '')$q$, pid), '22023', 'reason required');
  perform t.fails(format($q$select public.approve_post(%L)$q$, pid3), '55000', 'a draft cannot be approved');
  perform t.is((public.admin_counts() ->> 'posts')::int >= 1, true, 'pending counter');
  perform public.request_changes_post(pid, 'Please add a figure legend.');
  perform t.is((select admin_feedback from public.posts where id = pid), 'Please add a figure legend.', 'feedback stored');
  perform t.login(a);
  perform t.is(t.affected(format($q$update public.posts set title = 'My First Article, revised' where id = %L$q$, pid)), 1::bigint, 'author edits after feedback');
  perform public.submit_post(pid);
  perform t.login(adm);
  perform public.approve_post(pid);
  select published_at into first_pub from public.posts where id = pid;

  -- public read
  perform t.anon();
  perform t.is((select title from public.public_posts where slug = 'my-first-article'), 'My First Article, revised', 'public title');
  perform t.is((select author_name from public.public_posts where slug = 'my-first-article'), 'Dr Writer', 'author name');
  perform t.is((select category_slug from public.public_posts where slug = 'my-first-article'), 'research', 'category slug');
  perform t.is((select category_name from public.public_posts where slug = 'my-first-article'), 'Research', 'category name');
  perform t.is((select tags from public.public_posts where slug = 'my-first-article'), array['post-tag'], 'tags');
  perform t.is((select refs -> 0 ->> 'text' from public.public_posts where slug = 'my-first-article'), 'Smith 2024', 'references');
  perform t.is((select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'public_posts' and column_name in ('owner_id', 'admin_feedback', 'status')), 0::bigint, 'view hides internal columns');
  perform t.is((select count(*) from public.public_posts), 1::bigint, 'only the approved post is public');

  -- editing a published post: revision, URL is permanent
  perform t.login(a);
  update public.posts set content_md = body || ' Extra paragraph.', title = 'My First Article, v3' where id = pid;
  perform t.is((select status::text from public.posts where id = pid), 'draft', 'edit starts a revision');
  perform t.anon();
  perform t.is((select title from public.public_posts where slug = 'my-first-article'), 'My First Article, revised', 'public keeps the approved version');
  perform t.login(a);
  perform t.fails(format($q$update public.posts set slug = 'new-url' where id = %L$q$, pid), '42501', 'published URL is permanent');
  perform public.submit_post(pid);
  perform t.login(adm);
  perform public.approve_post(pid);
  perform t.anon();
  perform t.is((select title from public.public_posts where slug = 'my-first-article'), 'My First Article, v3', 'approved revision is public');
  perform t.root();
  perform t.is((select published_at from public.posts where id = pid), first_pub, 'first publication date kept');

  -- a deleted category does not break a published post
  insert into public.blog_categories (slug, name) values ('temp-cat', 'Temp');
  -- unpublishing
  perform t.login(a);
  perform t.is(t.affected(format($q$delete from public.posts where id = %L$q$, pid)), 0::bigint, 'author cannot delete a live post');
  perform t.login(adm);
  perform public.unpublish_post(pid, 'Contains unattributed figures');
  perform t.anon();
  perform t.is((select count(*) from public.public_posts), 0::bigint, 'unpublished post disappears');
  perform t.login(a);
  perform t.is((select admin_feedback from public.posts where id = pid), 'Contains unattributed figures', 'author sees why');
  perform t.is((select count(*) from public.notifications where kind = 'post_unpublished'), 1::bigint, 'author notified');
  perform public.submit_post(pid);
  perform t.login(adm);
  perform public.reject_post(pid, 'Still contains them');
  perform t.login(a);
  perform t.is(t.affected(format($q$delete from public.posts where id = %L$q$, pid)), 1::bigint, 'author can delete a rejected post');
  perform t.root();
end $$;
