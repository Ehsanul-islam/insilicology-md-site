-- Fixes for what Supabase's security and performance advisors reported on the first deployment.
--
--  A. Trigger and internal functions were executable through the API by anon/authenticated. Triggers
--     do not need EXECUTE at fire time, so lock them down.
--  D. Index the foreign keys.
-- (The policy tuning that goes with this lives in the next migration, policy_tuning.)
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
