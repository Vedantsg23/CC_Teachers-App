-- CCE नोंदवही — cloud accounts, data sync and password recovery.
--
-- The browser talks to these `public.api_*` functions through PostgREST (RPC)
-- with the project's publishable key. All data lives in the `private` schema,
-- which the API does not expose; every function checks the caller's session
-- token itself. Expected failures come back as {"ok": false, "error": "<code>"}
-- (not as SQL errors) so that failure counters are committed.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public;

-- ------------------------------------------------------------------
-- Tables
-- ------------------------------------------------------------------
create table private.accounts (
  id uuid primary key default gen_random_uuid(),
  username text not null unique check (username ~ '^[a-z0-9_.]{3,20}$'),
  pw_hash text not null,
  display_name text not null default '' check (length(display_name) <= 120),
  phone text not null check (phone ~ '^[6-9][0-9]{9}$'),
  standard int check (standard between 1 and 8),
  section text not null default '' check (length(section) <= 10),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index accounts_phone_idx on private.accounts (phone);

create table private.sessions (
  token_hash bytea primary key,
  account_id uuid not null references private.accounts (id) on delete cascade,
  device text not null default '',
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index sessions_account_idx on private.sessions (account_id);

create sequence private.records_seq;
create table private.records (
  account_id uuid not null references private.accounts (id) on delete cascade,
  tbl text not null,
  id text not null,
  data jsonb,
  deleted boolean not null default false,
  seq bigint not null default nextval('private.records_seq'),
  updated_at timestamptz not null default now(),
  primary key (account_id, tbl, id)
);
create index records_account_seq_idx on private.records (account_id, seq);

-- login failures per username; generic counters for rate limits
create table private.login_failures (
  username text primary key,
  count int not null default 0,
  first_at timestamptz not null default now(),
  locked_until timestamptz
);

create table private.rate (
  key text primary key,
  window_start timestamptz not null,
  count int not null
);

-- one pending OTP per mobile number
create table private.otp_codes (
  phone text primary key,
  code_hash text, -- null when the SMS provider checks the code itself (Twilio Verify)
  provider text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  created_at timestamptz not null default now()
);

create table private.reset_tokens (
  token_hash bytea primary key,
  phone text not null,
  expires_at timestamptz not null,
  used boolean not null default false
);

-- SMS_PROVIDER=test only: the code is written here instead of being sent
create table private.otp_outbox (
  id bigserial primary key,
  phone text not null,
  code text not null,
  created_at timestamptz not null default now()
);

alter table private.accounts enable row level security;
alter table private.sessions enable row level security;
alter table private.records enable row level security;
alter table private.login_failures enable row level security;
alter table private.rate enable row level security;
alter table private.otp_codes enable row level security;
alter table private.reset_tokens enable row level security;
alter table private.otp_outbox enable row level security;

-- ------------------------------------------------------------------
-- Helpers (private; not callable through the API)
-- ------------------------------------------------------------------
create or replace function private.err(code text, extra jsonb default '{}'::jsonb)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('ok', false, 'error', code) || extra
$$;

create or replace function private.client_ip()
returns text language plpgsql stable set search_path = '' as $$
declare h json;
begin
  begin
    h := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    h := null;
  end;
  return coalesce(
    nullif(trim(split_part(coalesce(h ->> 'x-forwarded-for', ''), ',', 1)), ''),
    nullif(h ->> 'cf-connecting-ip', ''),
    'unknown');
end $$;

-- true while `p_key` stays within `p_limit` hits per `p_window`
create or replace function private.hit(p_key text, p_limit int, p_window interval)
returns boolean language plpgsql set search_path = '' as $$
declare n int;
begin
  insert into private.rate as t (key, window_start, count) values (p_key, now(), 1)
  on conflict (key) do update set
    count = case when t.window_start < now() - p_window then 1 else t.count + 1 end,
    window_start = case when t.window_start < now() - p_window then now() else t.window_start end
  returning t.count into n;
  return n <= p_limit;
end $$;

create or replace function private.norm_phone(p text)
returns text language sql immutable set search_path = '' as $$
  select case
    when d ~ '^[6-9][0-9]{9}$' then d
    when d ~ '^91[6-9][0-9]{9}$' then substr(d, 3)
    when d ~ '^0[6-9][0-9]{9}$' then substr(d, 2)
    else null end
  from (select regexp_replace(translate(coalesce(p, ''), '०१२३४५६७८९', '0123456789'), '[^0-9]', '', 'g') as d) x
$$;

create or replace function private.account_json(a private.accounts)
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'id', a.id, 'username', a.username, 'displayName', a.display_name, 'phone', a.phone,
    'standard', a.standard, 'section', a.section, 'updatedAt', a.updated_at)
$$;

create or replace function private.new_session(p_account uuid, p_device text)
returns text language plpgsql set search_path = '' as $$
declare t text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  insert into private.sessions (token_hash, account_id, device)
  values (sha256(convert_to(t, 'UTF8')), p_account, left(coalesce(p_device, ''), 200));
  -- keep the 30 most recently used sessions of the account
  delete from private.sessions where account_id = p_account and token_hash in (
    select token_hash from private.sessions where account_id = p_account order by last_seen_at desc, created_at desc offset 30);
  return t;
end $$;

-- account id for a valid session token, else null
create or replace function private.session_account(p_token text)
returns uuid language plpgsql set search_path = '' as $$
declare s private.sessions;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then return null; end if;
  select * into s from private.sessions where token_hash = sha256(convert_to(p_token, 'UTF8'));
  if not found then return null; end if;
  if not exists (select 1 from private.accounts a where a.id = s.account_id and a.active) then return null; end if;
  if s.last_seen_at < now() - interval '1 hour' then
    update private.sessions set last_seen_at = now() where token_hash = s.token_hash;
  end if;
  return s.account_id;
end $$;

create or replace function private.valid_password(p text)
returns boolean language sql immutable set search_path = '' as $$
  select p is not null and char_length(p) >= 6 and octet_length(p) <= 72
$$;

revoke all on all functions in schema private from public;

-- ------------------------------------------------------------------
-- API: accounts
-- ------------------------------------------------------------------
create or replace function public.api_register(
  p_username text, p_password text, p_display_name text, p_phone text,
  p_standard int, p_section text, p_device text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u text := lower(trim(coalesce(p_username, '')));
  ph text := private.norm_phone(p_phone);
  a private.accounts;
begin
  if u !~ '^[a-z0-9_.]{3,20}$' then return private.err('invalid_username'); end if;
  if u = 'admin' then return private.err('username_taken'); end if;
  if not private.valid_password(p_password) then return private.err('invalid_password'); end if;
  if ph is null then return private.err('invalid_phone'); end if;
  if coalesce(trim(p_display_name), '') = '' or char_length(p_display_name) > 120 then return private.err('invalid_name'); end if;
  if p_standard is null or p_standard not between 1 and 8 then return private.err('invalid_standard'); end if;
  if coalesce(trim(p_section), '') = '' or char_length(p_section) > 10 then return private.err('invalid_section'); end if;
  if not private.hit('reg:' || private.client_ip(), 20, interval '1 hour') then return private.err('rate_limited'); end if;
  if exists (select 1 from private.accounts where username = u) then return private.err('username_taken'); end if;
  if (select count(*) from private.accounts where phone = ph) >= 5 then return private.err('phone_limit'); end if;
  insert into private.accounts (username, pw_hash, display_name, phone, standard, section)
  values (u, extensions.crypt(p_password, extensions.gen_salt('bf', 10)), trim(p_display_name), ph, p_standard, trim(p_section))
  returning * into a;
  return jsonb_build_object('ok', true, 'token', private.new_session(a.id, p_device), 'account', private.account_json(a));
exception when unique_violation then
  return private.err('username_taken');
end $$;

create or replace function public.api_login(p_username text, p_password text, p_device text default '')
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u text := lower(trim(coalesce(p_username, '')));
  a private.accounts;
  f private.login_failures;
begin
  if not private.hit('login:' || private.client_ip(), 60, interval '15 minutes') then return private.err('rate_limited'); end if;
  select * into f from private.login_failures where username = u;
  if found and f.locked_until > now() then
    return private.err('locked', jsonb_build_object('wait', ceil(extract(epoch from f.locked_until - now()))));
  end if;
  select * into a from private.accounts where username = u;
  if not found or a.pw_hash <> extensions.crypt(coalesce(p_password, ''), a.pw_hash) then
    insert into private.login_failures as t (username, count, first_at) values (u, 1, now())
    on conflict (username) do update set
      count = case when t.first_at < now() - interval '15 minutes' then 1 else t.count + 1 end,
      first_at = case when t.first_at < now() - interval '15 minutes' then now() else t.first_at end,
      locked_until = case when t.first_at >= now() - interval '15 minutes' and t.count + 1 >= 5 then now() + interval '5 minutes' else null end;
    return private.err('bad_credentials');
  end if;
  if not a.active then return private.err('inactive'); end if;
  delete from private.login_failures where username = u;
  return jsonb_build_object('ok', true, 'token', private.new_session(a.id, p_device), 'account', private.account_json(a));
end $$;

create or replace function public.api_logout(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if p_token ~ '^[0-9a-f]{64}$' then
    delete from private.sessions where token_hash = sha256(convert_to(p_token, 'UTF8'));
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.api_session(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v uuid := private.session_account(p_token); a private.accounts;
begin
  if v is null then return private.err('bad_token'); end if;
  select * into a from private.accounts where id = v;
  return jsonb_build_object('ok', true, 'account', private.account_json(a));
end $$;

create or replace function public.api_update_profile(p_token text, p_display_name text, p_section text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v uuid := private.session_account(p_token); a private.accounts;
begin
  if v is null then return private.err('bad_token'); end if;
  if coalesce(trim(p_display_name), '') = '' or char_length(p_display_name) > 120 then return private.err('invalid_name'); end if;
  if coalesce(trim(p_section), '') = '' or char_length(p_section) > 10 then return private.err('invalid_section'); end if;
  update private.accounts set display_name = trim(p_display_name), section = trim(p_section), updated_at = now()
  where id = v returning * into a;
  return jsonb_build_object('ok', true, 'account', private.account_json(a));
end $$;

create or replace function public.api_change_phone(p_token text, p_password text, p_phone text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v uuid := private.session_account(p_token); a private.accounts; ph text := private.norm_phone(p_phone);
begin
  if v is null then return private.err('bad_token'); end if;
  select * into a from private.accounts where id = v;
  if a.pw_hash <> extensions.crypt(coalesce(p_password, ''), a.pw_hash) then return private.err('bad_password'); end if;
  if ph is null then return private.err('invalid_phone'); end if;
  if ph <> a.phone and (select count(*) from private.accounts where phone = ph) >= 5 then return private.err('phone_limit'); end if;
  update private.accounts set phone = ph, updated_at = now() where id = v returning * into a;
  return jsonb_build_object('ok', true, 'account', private.account_json(a));
end $$;

-- other devices are signed out; this device keeps its session
create or replace function public.api_change_password(p_token text, p_current text, p_new text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v uuid := private.session_account(p_token); a private.accounts;
begin
  if v is null then return private.err('bad_token'); end if;
  select * into a from private.accounts where id = v;
  if a.pw_hash <> extensions.crypt(coalesce(p_current, ''), a.pw_hash) then return private.err('bad_password'); end if;
  if not private.valid_password(p_new) then return private.err('invalid_password'); end if;
  update private.accounts set pw_hash = extensions.crypt(p_new, extensions.gen_salt('bf', 10)), updated_at = now() where id = v;
  delete from private.sessions where account_id = v and token_hash <> sha256(convert_to(p_token, 'UTF8'));
  return jsonb_build_object('ok', true);
end $$;

-- ------------------------------------------------------------------
-- API: data sync
-- ------------------------------------------------------------------
-- p_changes: [{"tbl": "...", "id": "...", "data": {...}} | {"tbl": "...", "id": "...", "deleted": true}]
create or replace function public.api_push(p_token text, p_changes jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v uuid := private.session_account(p_token); n int; total bigint;
begin
  if v is null then return private.err('bad_token'); end if;
  if jsonb_typeof(p_changes) <> 'array' then return private.err('bad_request'); end if;
  n := jsonb_array_length(p_changes);
  if n = 0 then return jsonb_build_object('ok', true, 'count', 0); end if;
  if n > 1000 or octet_length(p_changes::text) > 4000000 then return private.err('too_large'); end if;
  if exists (
    select 1 from jsonb_array_elements(p_changes) c
    where coalesce(c ->> 'tbl', '') not in ('meta', 'classes', 'students', 'assessments', 'remarks', 'attendanceMonths', 'attendance', 'dailyAttendance', 'remarkLibrary', 'certificates')
       or coalesce(c ->> 'id', '') = '' or char_length(c ->> 'id') > 200
       or (coalesce(c ->> 'deleted', 'false') <> 'true' and jsonb_typeof(c -> 'data') <> 'object')
  ) then
    return private.err('bad_request');
  end if;
  -- one writer/reader per account at a time: sequence numbers are visible in order
  perform pg_advisory_xact_lock(hashtextextended(v::text, 7));
  insert into private.records as r (account_id, tbl, id, data, deleted, seq, updated_at)
  select v, c ->> 'tbl', c ->> 'id',
         case when c ->> 'deleted' = 'true' then null else c -> 'data' end,
         coalesce(c ->> 'deleted', 'false') = 'true',
         nextval('private.records_seq'), now()
  from (select distinct on (e ->> 'tbl', e ->> 'id') e as c from jsonb_array_elements(p_changes) with ordinality as x(e, i) order by e ->> 'tbl', e ->> 'id', i desc) d
  on conflict (account_id, tbl, id) do update
    set data = excluded.data, deleted = excluded.deleted, seq = excluded.seq, updated_at = excluded.updated_at;
  select count(*) into total from private.records where account_id = v and not deleted;
  if total > 200000 then
    raise exception 'quota';
  end if;
  return jsonb_build_object('ok', true, 'count', n);
end $$;

create or replace function public.api_pull(p_token text, p_since bigint default 0, p_limit int default 1000)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v uuid := private.session_account(p_token); a private.accounts; lim int := least(greatest(coalesce(p_limit, 1000), 1), 2000);
  recs jsonb; last_seq bigint; cnt int;
begin
  if v is null then return private.err('bad_token'); end if;
  perform pg_advisory_xact_lock(hashtextextended(v::text, 7));
  select coalesce(jsonb_agg(jsonb_build_object('tbl', r.tbl, 'id', r.id, 'data', r.data, 'deleted', r.deleted, 'seq', r.seq) order by r.seq), '[]'::jsonb),
         max(r.seq), count(*)
    into recs, last_seq, cnt
  from (select * from private.records where account_id = v and seq > coalesce(p_since, 0) order by seq limit lim) r;
  select * into a from private.accounts where id = v;
  return jsonb_build_object('ok', true, 'records', recs, 'next', coalesce(last_seq, coalesce(p_since, 0)), 'more', cnt = lim, 'account', private.account_json(a));
end $$;

-- ------------------------------------------------------------------
-- Password / login-ID recovery by mobile OTP
-- (svc_* are called only by the `otp` edge function with the service role)
-- ------------------------------------------------------------------
create or replace function public.svc_otp_create(p_phone text, p_ip text, p_provider text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ph text := private.norm_phone(p_phone); code text; prev private.otp_codes;
begin
  if ph is null then return private.err('invalid_phone'); end if;
  if not exists (select 1 from private.accounts where phone = ph and active) then return private.err('no_account'); end if;
  select * into prev from private.otp_codes where phone = ph;
  if found and prev.created_at > now() - interval '45 seconds' then
    return private.err('wait', jsonb_build_object('wait', ceil(extract(epoch from prev.created_at + interval '45 seconds' - now()))));
  end if;
  if not private.hit('otp-phone:' || ph, 4, interval '1 hour') then return private.err('rate_limited'); end if;
  if not private.hit('otp-ip:' || coalesce(nullif(p_ip, ''), 'unknown'), 12, interval '1 hour') then return private.err('rate_limited'); end if;
  if p_provider = 'twilio' then
    code := null;
  else
    code := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) % 1000000)::text, 6, '0');
  end if;
  insert into private.otp_codes as o (phone, code_hash, provider, expires_at, attempts, created_at)
  values (ph, case when code is null then null else extensions.crypt(code, extensions.gen_salt('bf', 8)) end, p_provider, now() + interval '10 minutes', 0, now())
  on conflict (phone) do update set code_hash = excluded.code_hash, provider = excluded.provider, expires_at = excluded.expires_at, attempts = 0, created_at = now();
  if p_provider = 'test' then
    insert into private.otp_outbox (phone, code) values (ph, code);
    delete from private.otp_outbox where created_at < now() - interval '1 day';
  end if;
  return jsonb_build_object('ok', true, 'phone', ph, 'code', code);
end $$;

-- a fresh reset token and the login IDs linked to the number
create or replace function private.otp_success(ph text)
returns jsonb language plpgsql set search_path = '' as $$
declare t text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  delete from private.otp_codes where phone = ph;
  delete from private.reset_tokens where phone = ph or expires_at < now();
  insert into private.reset_tokens (token_hash, phone, expires_at) values (sha256(convert_to(t, 'UTF8')), ph, now() + interval '15 minutes');
  return jsonb_build_object('ok', true, 'resetToken', t,
    'usernames', coalesce((select jsonb_agg(username order by username) from private.accounts where phone = ph and active), '[]'::jsonb));
end $$;
revoke all on function private.otp_success(text) from public;

-- own-code providers: compare the code (5 attempts per code)
create or replace function public.svc_otp_check(p_phone text, p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ph text := private.norm_phone(p_phone); o private.otp_codes;
begin
  select * into o from private.otp_codes where phone = ph;
  if not found or o.code_hash is null then return private.err('otp_missing'); end if;
  if o.expires_at < now() then return private.err('otp_expired'); end if;
  if o.attempts >= 5 then return private.err('otp_attempts'); end if;
  if o.code_hash <> extensions.crypt(coalesce(p_code, ''), o.code_hash) then
    update private.otp_codes set attempts = attempts + 1 where phone = ph;
    return private.err('otp_invalid', jsonb_build_object('left', 4 - o.attempts));
  end if;
  return private.otp_success(ph);
end $$;

-- external providers (Twilio Verify) report the outcome of their own check
create or replace function public.svc_otp_result(p_phone text, p_ok boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare ph text := private.norm_phone(p_phone); o private.otp_codes;
begin
  select * into o from private.otp_codes where phone = ph;
  if not found then return private.err('otp_missing'); end if;
  if o.expires_at < now() then return private.err('otp_expired'); end if;
  if o.attempts >= 5 then return private.err('otp_attempts'); end if;
  if not p_ok then
    update private.otp_codes set attempts = attempts + 1 where phone = ph;
    return private.err('otp_invalid', jsonb_build_object('left', 4 - o.attempts));
  end if;
  return private.otp_success(ph);
end $$;

create or replace function public.api_reset_password(p_reset_token text, p_username text, p_new_password text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r private.reset_tokens; a private.accounts; u text := lower(trim(coalesce(p_username, '')));
begin
  if p_reset_token is null or p_reset_token !~ '^[0-9a-f]{64}$' then return private.err('reset_invalid'); end if;
  select * into r from private.reset_tokens where token_hash = sha256(convert_to(p_reset_token, 'UTF8'));
  if not found or r.used or r.expires_at < now() then return private.err('reset_invalid'); end if;
  select * into a from private.accounts where username = u and phone = r.phone and active;
  if not found then return private.err('reset_invalid'); end if;
  if not private.valid_password(p_new_password) then return private.err('invalid_password'); end if;
  update private.accounts set pw_hash = extensions.crypt(p_new_password, extensions.gen_salt('bf', 10)), updated_at = now() where id = a.id;
  update private.reset_tokens set used = true where token_hash = r.token_hash;
  delete from private.sessions where account_id = a.id;
  delete from private.login_failures where username = u;
  return jsonb_build_object('ok', true, 'username', a.username);
end $$;

-- keep-alive / health check
create or replace function public.api_ping()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('ok', true, 'time', now())
$$;

-- ------------------------------------------------------------------
-- Grants: browser (anon) may call api_*; svc_* only with the service role
-- ------------------------------------------------------------------
revoke all on function public.api_register(text, text, text, text, int, text, text) from public;
revoke all on function public.api_login(text, text, text) from public;
revoke all on function public.api_logout(text) from public;
revoke all on function public.api_session(text) from public;
revoke all on function public.api_update_profile(text, text, text) from public;
revoke all on function public.api_change_phone(text, text, text) from public;
revoke all on function public.api_change_password(text, text, text) from public;
revoke all on function public.api_push(text, jsonb) from public;
revoke all on function public.api_pull(text, bigint, int) from public;
revoke all on function public.api_reset_password(text, text, text) from public;
revoke all on function public.api_ping() from public;
revoke all on function public.svc_otp_create(text, text, text) from public, anon, authenticated;
revoke all on function public.svc_otp_check(text, text) from public, anon, authenticated;
revoke all on function public.svc_otp_result(text, boolean) from public, anon, authenticated;

grant execute on function public.api_register(text, text, text, text, int, text, text) to anon, authenticated;
grant execute on function public.api_login(text, text, text) to anon, authenticated;
grant execute on function public.api_logout(text) to anon, authenticated;
grant execute on function public.api_session(text) to anon, authenticated;
grant execute on function public.api_update_profile(text, text, text) to anon, authenticated;
grant execute on function public.api_change_phone(text, text, text) to anon, authenticated;
grant execute on function public.api_change_password(text, text, text) to anon, authenticated;
grant execute on function public.api_push(text, jsonb) to anon, authenticated;
grant execute on function public.api_pull(text, bigint, int) to anon, authenticated;
grant execute on function public.api_reset_password(text, text, text) to anon, authenticated;
grant execute on function public.api_ping() to anon, authenticated;
grant execute on function public.svc_otp_create(text, text, text) to service_role;
grant execute on function public.svc_otp_check(text, text) to service_role;
grant execute on function public.svc_otp_result(text, boolean) to service_role;
