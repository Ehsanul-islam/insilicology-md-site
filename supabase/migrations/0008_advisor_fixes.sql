-- Fixes for what Supabase's security and performance advisors reported on the first deployment.
--
--  A. Trigger and internal functions were executable through the API by anon/authenticated. Triggers
--     do not need EXECUTE at fire time, so lock them down.
--  B. Policies called auth.uid() once per row; wrapping it in (select ...) evaluates it once per statement.
--  C. Own-rows and admin policies for the same action were separate permissive policies, which Postgres
--     evaluates one after the other; merge each pair into one policy with the same meaning.
--  D. Index the foreign keys.
--
-- Left as they are, on purpose:
--  * the four public_* / published_pdbs views are "security definer": that is how anonymous visitors read
--    the approved snapshot without any access to the tables underneath (see 0003);
--  * is_admin(), is_active(), can_edit_*() and can_write_record_path() stay executable: policies call them
--    as the signed-in user and they only report facts about the caller;
--  * search_records() and resolve_analysis_type() are public on purpose;
--  * the review functions (submit_*, approve_* ...) stay executable by signed-in users; each checks who is calling.

-- A. Lock down trigger and internal functions -----------------------------------------------------
revoke execute on function
  public.analysis_types_sync_keys(),
  public.audit_row_change(),
  public.handle_new_user(),
  public.post_child_changed(),
  public.record_child_changed(),
  public.record_files_check(),
  public.profiles_guard(),
  public.records_before_write(),
  public.posts_before_write(),
  public.tags_normalise(),
  public.touch_updated_at()
  from public, anon, authenticated;

-- Lookup keys are internal. An explicit deny-all policy documents that (and satisfies the linter).
create policy keys_no_access on public.analysis_type_keys for all to anon, authenticated using (false);

-- B + C. Policies ----------------------------------------------------------------------------------

-- profiles
drop policy profiles_select_own on public.profiles;
drop policy profiles_update_own on public.profiles;
drop policy profiles_update_admin on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());
create policy profiles_update on public.profiles for update to authenticated
  using ((id = (select auth.uid()) and public.is_active()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());

-- analysis types and blog categories: one read policy, separate admin write policies
drop policy types_read on public.analysis_types;
drop policy types_admin_write on public.analysis_types;
create policy types_read on public.analysis_types for select to anon, authenticated
  using (status = 'active' or public.is_admin());
create policy types_admin_insert on public.analysis_types for insert to authenticated with check (public.is_admin());
create policy types_admin_update on public.analysis_types for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy types_admin_delete on public.analysis_types for delete to authenticated using (public.is_admin());

drop policy categories_admin_write on public.blog_categories;
create policy categories_admin_insert on public.blog_categories for insert to authenticated with check (public.is_admin());
create policy categories_admin_update on public.blog_categories for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy categories_admin_delete on public.blog_categories for delete to authenticated using (public.is_admin());

-- type requests
drop policy requests_own_read on public.type_requests;
drop policy requests_own_insert on public.type_requests;
create policy requests_read on public.type_requests for select to authenticated
  using (requested_by = (select auth.uid()) or public.is_admin());
create policy requests_insert on public.type_requests for insert to authenticated
  with check (requested_by = (select auth.uid()) and public.is_active() and status = 'open');

-- projects (restricted users may still read their own)
drop policy projects_own on public.projects;
drop policy projects_admin_read on public.projects;
create policy projects_select on public.projects for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_admin());
create policy projects_insert on public.projects for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.is_active());
create policy projects_update on public.projects for update to authenticated
  using (owner_id = (select auth.uid()) and public.is_active())
  with check (owner_id = (select auth.uid()) and public.is_active());
create policy projects_delete on public.projects for delete to authenticated
  using (owner_id = (select auth.uid()) and public.is_active());

-- records
drop policy records_read on public.records;
drop policy records_insert on public.records;
drop policy records_update_own on public.records;
drop policy records_update_admin on public.records;
drop policy records_delete_own on public.records;
drop policy records_delete_admin on public.records;
create policy records_select on public.records for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_admin());
create policy records_insert on public.records for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.is_active() and status = 'draft' and not is_public
              and published_snapshot is null and admin_feedback is null);
create policy records_update on public.records for update to authenticated
  using ((owner_id = (select auth.uid()) and public.is_active()
          and status in ('draft', 'changes_requested', 'rejected', 'unpublished', 'published'))
         or public.is_admin())
  with check (owner_id = (select auth.uid()) or public.is_admin());
create policy records_delete on public.records for delete to authenticated
  using ((owner_id = (select auth.uid()) and public.is_active() and not is_public and status in ('draft', 'rejected'))
         or public.is_admin());

-- record files and tags (reads)
drop policy files_read on public.record_files;
create policy files_read on public.record_files for select to authenticated
  using (exists (select 1 from public.records r
                 where r.id = record_id and (r.owner_id = (select auth.uid()) or public.is_admin())));
drop policy rtags_read on public.record_tags;
create policy rtags_read on public.record_tags for select to authenticated
  using (exists (select 1 from public.records r
                 where r.id = record_id and (r.owner_id = (select auth.uid()) or public.is_admin())));

-- posts
drop policy posts_read on public.posts;
drop policy posts_insert on public.posts;
drop policy posts_update_own on public.posts;
drop policy posts_update_admin on public.posts;
drop policy posts_delete_own on public.posts;
drop policy posts_delete_admin on public.posts;
create policy posts_select on public.posts for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_admin());
create policy posts_insert on public.posts for insert to authenticated
  with check (owner_id = (select auth.uid()) and public.is_active() and status = 'draft' and not is_public
              and published_snapshot is null and admin_feedback is null);
create policy posts_update on public.posts for update to authenticated
  using ((owner_id = (select auth.uid()) and public.is_active()
          and status in ('draft', 'changes_requested', 'rejected', 'unpublished', 'published'))
         or public.is_admin())
  with check (owner_id = (select auth.uid()) or public.is_admin());
create policy posts_delete on public.posts for delete to authenticated
  using ((owner_id = (select auth.uid()) and public.is_active() and not is_public and status in ('draft', 'rejected'))
         or public.is_admin());

drop policy ptags_read on public.post_tags;
create policy ptags_read on public.post_tags for select to authenticated
  using (exists (select 1 from public.posts p
                 where p.id = post_id and (p.owner_id = (select auth.uid()) or public.is_admin())));

-- review history and notifications
drop policy review_events_read on public.review_events;
create policy review_events_read on public.review_events for select to authenticated
  using (
    public.is_admin()
    or (subject_type = 'record' and exists (select 1 from public.records r where r.id = subject_id and r.owner_id = (select auth.uid())))
    or (subject_type = 'post' and exists (select 1 from public.posts p where p.id = subject_id and p.owner_id = (select auth.uid())))
    or (subject_type = 'type_request' and exists (select 1 from public.type_requests t where t.id = subject_id and t.requested_by = (select auth.uid())))
  );

drop policy notifications_own_read on public.notifications;
drop policy notifications_own_update on public.notifications;
create policy notifications_read on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- D. Foreign-key indexes -----------------------------------------------------------------------------
create index analysis_type_keys_type_idx on public.analysis_type_keys (type_id);
create index audit_log_actor_idx on public.audit_log (actor_id);
create index contact_messages_user_idx on public.contact_messages (user_id);
create index post_tags_tag_idx on public.post_tags (tag_id);
create index posts_category_idx on public.posts (category_id);
create index record_tags_tag_idx on public.record_tags (tag_id);
create index records_project_idx on public.records (project_id);
create index review_events_actor_idx on public.review_events (actor_id);
create index type_requests_merged_idx on public.type_requests (merged_into);
create index type_requests_requester_idx on public.type_requests (requested_by);
create index type_requests_reviewer_idx on public.type_requests (reviewed_by);
