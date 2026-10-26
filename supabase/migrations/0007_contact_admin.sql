-- Contact messages and the administrator's pending-work counters.

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  subject text check (char_length(subject) <= 200),
  message text not null check (char_length(message) between 10 and 5000),
  pdb_id text check (pdb_id ~ '^[0-9][A-Za-z0-9]{3}$'),
  status text not null default 'new' check (status in ('new', 'read', 'replied', 'spam')),
  -- HMAC of the sender's IP, never the address itself; used only for rate limiting
  ip_hash text,
  created_at timestamptz not null default now()
);
create index contact_messages_status_idx on public.contact_messages (status, created_at desc);
create index contact_messages_rate_idx on public.contact_messages (ip_hash, created_at);
create index contact_messages_email_idx on public.contact_messages (lower(email), created_at);

alter table public.contact_messages enable row level security;
create policy contact_admin_read on public.contact_messages for select to authenticated using (public.is_admin());
create policy contact_admin_update on public.contact_messages for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy contact_admin_delete on public.contact_messages for delete to authenticated using (public.is_admin());
revoke all on public.contact_messages from anon;

-- The only way in. It is granted to the service role alone, so the server action can verify the
-- captcha first; the limit below stops a single sender flooding the inbox.
create or replace function public.submit_contact_message(
  p_name text, p_email text, p_subject text, p_message text, p_pdb text, p_ip_hash text, p_user uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  new_id uuid;
begin
  if (select count(*) from public.contact_messages
       where created_at > now() - interval '1 hour'
         and ((p_ip_hash is not null and ip_hash = p_ip_hash) or lower(email) = lower(p_email))) >= 5 then
    raise exception 'too many messages, try again later' using errcode = '54000';
  end if;
  insert into public.contact_messages (user_id, name, email, subject, message, pdb_id, ip_hash)
  values (p_user, trim(p_name), trim(p_email), nullif(trim(p_subject), ''), trim(p_message), nullif(upper(trim(p_pdb)), ''), p_ip_hash)
  returning id into new_id;
  return new_id;
end $$;
revoke execute on function public.submit_contact_message(text, text, text, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.submit_contact_message(text, text, text, text, text, text, uuid) to service_role;

-- Numbers for the administrator's pending-review badges.
create or replace function public.admin_counts() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public._require_admin();
  return jsonb_build_object(
    'records', (select count(*) from public.records where status = 'pending'),
    'posts', (select count(*) from public.posts where status = 'pending'),
    'type_requests', (select count(*) from public.type_requests where status = 'open'),
    'messages', (select count(*) from public.contact_messages where status = 'new')
  );
end $$;
revoke execute on function public.admin_counts() from public, anon;
