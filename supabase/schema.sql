-- Closed application tables. The browser has no direct table or RPC privileges.
create table public.zzws_users (
 id uuid primary key references auth.users(id) on delete cascade,
 login text unique not null check (length(login) between 1 and 150),
 profile jsonb not null, active boolean not null default false
);
create table public.zzws_sessions (
 hash text primary key check (length(hash)=64),
 user_id uuid not null references public.zzws_users(id) on delete cascade,
 expires timestamptz not null
);
create index zzws_sessions_user on public.zzws_sessions(user_id);
create index zzws_sessions_expiry on public.zzws_sessions(expires);
create table public.zzws_versions (
 id uuid primary key default gen_random_uuid(), products jsonb not null,
 created timestamptz not null default now(), actor uuid references public.zzws_users(id)
);
create index zzws_versions_created on public.zzws_versions(created desc);
create table public.zzws_state (
 id boolean primary key default true check(id),
 version uuid references public.zzws_versions(id),
 rules jsonb not null default '{}'::jsonb,
 rules_revision uuid not null default gen_random_uuid()
);
insert into public.zzws_state(id) values(true);
create table public.zzws_drafts (
 id uuid primary key default gen_random_uuid(), actor uuid not null references public.zzws_users(id),
 kind text not null check(kind in ('price','users')), payload jsonb not null,
 expires timestamptz not null default now()+interval '30 minutes'
);
create index zzws_drafts_actor on public.zzws_drafts(actor);
create index zzws_drafts_expiry on public.zzws_drafts(expires);
create table public.zzws_audit (
 id bigint generated always as identity primary key, created timestamptz not null default now(),
 actor uuid, action text not null, detail text not null default ''
);
create table public.zzws_attempts (
 id uuid primary key default gen_random_uuid(), login text not null, ip text not null,
 created timestamptz not null default now()
);
create index zzws_attempts_login on public.zzws_attempts(login, created);
create index zzws_attempts_ip on public.zzws_attempts(ip, created);
create table public.zzws_setup (
 id boolean primary key default true check(id), hash text not null, expires timestamptz not null
);

do $$ declare t text; begin
 foreach t in array array['zzws_users','zzws_sessions','zzws_versions','zzws_state','zzws_drafts','zzws_audit','zzws_attempts','zzws_setup'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on table public.%I from public, anon, authenticated',t);
  execute format('grant all on table public.%I to service_role',t);
  execute format('create policy service_only on public.%I for all to service_role using (true) with check (true)',t);
 end loop;
end $$;
revoke all on sequence public.zzws_audit_id_seq from public, anon, authenticated;
grant usage, select on sequence public.zzws_audit_id_seq to service_role;

-- All functions are invokers. Only the Edge Function's service client can execute them.
create function public.zzws_login_gate(p_login text, p_ip text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare result uuid;
begin
 perform pg_advisory_xact_lock(877521);
 delete from public.zzws_attempts where created < now()-interval '15 minutes';
 delete from public.zzws_sessions where expires < now();
 delete from public.zzws_drafts where expires < now();
 if (select count(*) from public.zzws_attempts where login=p_login or ip=p_ip)>=10 then return null; end if;
 insert into public.zzws_attempts(login,ip) values(p_login,p_ip) returning id into result;
 return result;
end $$;

create function public.zzws_consume_setup(p_hash text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare consumed boolean;
begin
 if exists(select 1 from public.zzws_users where profile->>'role'='admin') then return false; end if;
 delete from public.zzws_setup where id and hash=p_hash and expires>now() returning true into consumed;
 return coalesce(consumed,false);
end $$;

create function public.zzws_publish(p_draft uuid,p_actor uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare draft public.zzws_drafts; v_version uuid;
begin
 select * into draft from public.zzws_drafts where id=p_draft and actor=p_actor and kind='price' and expires>now() for update;
 if not found then raise exception 'Draft expired'; end if;
 insert into public.zzws_versions(products,actor) values(draft.payload,p_actor) returning id into v_version;
 update public.zzws_state set version=v_version where id;
 delete from public.zzws_drafts where id=p_draft;
 insert into public.zzws_audit(actor,action,detail) values(p_actor,'price_publish',v_version::text);
 return v_version;
end $$;

create function public.zzws_save_user(p_id uuid,p_login text,p_profile jsonb,p_active boolean,p_actor uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare previous public.zzws_users; actor_info jsonb; changes text[] := '{}';
begin
 select * into previous from public.zzws_users where id=p_id;
 select jsonb_build_object('login',login,'client',profile->>'client') into actor_info from public.zzws_users where id=p_actor;
 if previous.id is not null then
  if previous.login is distinct from p_login then changes=array_append(changes,'Логин: '||previous.login||' → '||p_login); end if;
  if previous.active is distinct from p_active then changes=array_append(changes,case when p_active then 'Доступ включён' else 'Доступ выключен' end); end if;
  if previous.profile->>'role' is distinct from p_profile->>'role' then changes=array_append(changes,'Изменена роль'); end if;
  if previous.profile->>'sheet' is distinct from p_profile->>'sheet' then changes=array_append(changes,'Группа цен: '||(p_profile->>'sheet')); end if;
  if previous.profile->'rowsList' is distinct from p_profile->'rowsList' then changes=array_append(changes,'Обновлены контрагенты, адреса или контакты'); end if;
  if previous.profile->'catalogAccess' is distinct from p_profile->'catalogAccess' then changes=array_append(changes,'Обновлён доступ к брендам и категориям'); end if;
 end if;
 insert into public.zzws_users(id,login,profile,active) values(p_id,p_login,p_profile,p_active)
 on conflict(id) do update set login=excluded.login,profile=excluded.profile,active=excluded.active;
 delete from public.zzws_sessions where user_id=p_id;
 insert into public.zzws_audit(actor,action,detail) values(p_actor,'user_update',jsonb_build_object('actor',actor_info,'target',jsonb_build_object('id',p_id,'login',p_login,'client',p_profile->>'client','role',p_profile->>'role','active',p_active),'created',previous.id is null,'changes',to_jsonb(changes))::text);
end $$;

revoke all on function public.zzws_login_gate(text,text) from public, anon, authenticated;
revoke all on function public.zzws_consume_setup(text) from public, anon, authenticated;
revoke all on function public.zzws_publish(uuid,uuid) from public, anon, authenticated;
revoke all on function public.zzws_save_user(uuid,text,jsonb,boolean,uuid) from public, anon, authenticated;
grant execute on function public.zzws_login_gate(text,text),public.zzws_consume_setup(text),public.zzws_publish(uuid,uuid),public.zzws_save_user(uuid,text,jsonb,boolean,uuid) to service_role;

create function public.zzws_import_users(p_draft uuid,p_actor uuid,p_users jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare item jsonb; old public.zzws_users; v_profile jsonb; v_rows jsonb;
begin
 perform 1 from public.zzws_drafts where id=p_draft and actor=p_actor and kind='users' and expires>now() for update;
 if not found then raise exception 'Draft expired'; end if;
 for item in select * from jsonb_array_elements(p_users) loop
  select * into old from public.zzws_users where login=item->>'login' for update;
  if found then
   if old.profile->>'role'='admin' then raise exception 'Cannot import administrator'; end if;
   v_rows=item->'profile'->'rowsList';
   if coalesce((item->>'preserveExtraContacts')::boolean,false) and jsonb_array_length(old.profile->'rowsList')>1 then
    select v_rows || coalesce(jsonb_agg(r.value order by r.ordinality),'[]'::jsonb) into v_rows
    from jsonb_array_elements(old.profile->'rowsList') with ordinality r(value,ordinality) where r.ordinality between 2 and 3;
   end if;
   v_profile=old.profile || jsonb_build_object('client',item->'profile'->'client','sheet',item->'profile'->'sheet',
      'brands',item->'profile'->'brands','allBrands',item->'profile'->'allBrands','rowsList',v_rows);
   update public.zzws_users set profile=v_profile where id=old.id;
   delete from public.zzws_sessions where user_id=old.id;
  else
   insert into public.zzws_users(id,login,profile,active) values((item->>'id')::uuid,item->>'login',item->'profile',false);
  end if;
 end loop;
 delete from public.zzws_drafts where id=p_draft;
 insert into public.zzws_audit(actor,action,detail) values(p_actor,'users_import',jsonb_array_length(p_users)::text);
end $$;
revoke all on function public.zzws_import_users(uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.zzws_import_users(uuid,uuid,jsonb) to service_role;

create function public.zzws_update_rules(p_rules jsonb,p_expected uuid,p_actor uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare v_revision uuid;
begin
 update public.zzws_state set rules=p_rules,rules_revision=gen_random_uuid()
 where id and rules_revision=p_expected returning rules_revision into v_revision;
 if not found then raise exception 'Rules changed; reload before saving' using errcode='PT409'; end if;
 insert into public.zzws_audit(actor,action,detail) values(p_actor,'rules_update',jsonb_build_object('revision',v_revision,'rules',p_rules)::text);
 return v_revision;
end $$;
revoke all on function public.zzws_update_rules(jsonb,uuid,uuid) from public,anon,authenticated;
grant execute on function public.zzws_update_rules(jsonb,uuid,uuid) to service_role;

-- Existing accounts that have already signed in keep their credentials.
alter table public.zzws_users add column needs_password_setup boolean not null default true;
alter table public.zzws_users add column password_setup_claim text;
alter table public.zzws_sessions add column setup_only boolean not null default false;
update public.zzws_users u set needs_password_setup=false
where exists(select 1 from public.zzws_audit a where a.actor=u.id and a.action in ('login','bootstrap'));

create table public.zzws_user_memory(
 user_id uuid primary key references public.zzws_users(id) on delete cascade,
 data jsonb not null default '{}', versions jsonb not null default '{}'
);
create table public.zzws_saved_carts(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.zzws_users(id) on delete cascade,
 title text not null check(length(title) between 1 and 80), cart jsonb not null,
 draft jsonb not null default '{}', saved_at timestamptz not null default now(),
 request_id uuid not null, unique(user_id,request_id)
);
create index zzws_saved_carts_owner on public.zzws_saved_carts(user_id,saved_at,id);
do $$ declare t text;begin
 foreach t in array array['zzws_user_memory','zzws_saved_carts'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 execute format('create policy service_only on public.%I for all to service_role using(true) with check(true)',t);
 end loop;
end $$;
create function public.zzws_save_memory(p_user uuid,p_section text,p_value jsonb,p_version integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.zzws_user_memory;v integer;
begin
 if p_section not in ('cart','favorites','history','filters','preferences','draft') then raise exception 'Invalid section';end if;
 insert into public.zzws_user_memory(user_id) values(p_user) on conflict do nothing;
 select * into r from public.zzws_user_memory where user_id=p_user for update;
 v=coalesce((r.versions->>p_section)::integer,0);
 if v<>p_version then return jsonb_build_object('conflict',true,'value',r.data->p_section,'version',v);end if;
 update public.zzws_user_memory set data=jsonb_set(data,array[p_section],p_value),versions=jsonb_set(versions,array[p_section],to_jsonb(v+1)) where user_id=p_user;
 return jsonb_build_object('version',v+1);
end $$;
create function public.zzws_save_cart(p_user uuid,p_title text,p_cart jsonb,p_draft jsonb,p_request uuid,p_replace uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.zzws_saved_carts;n integer;was_replaced boolean=false;
begin
 perform 1 from public.zzws_users where id=p_user for update;
 select * into r from public.zzws_saved_carts where user_id=p_user and request_id=p_request;
 if found then return to_jsonb(r);end if;
 select count(*) into n from public.zzws_saved_carts where user_id=p_user;
 if n>=10 then
 select * into r from public.zzws_saved_carts where user_id=p_user order by saved_at,id limit 1;
 if p_replace is distinct from r.id then return jsonb_build_object('limit',true,'oldest',to_jsonb(r));end if;
 delete from public.zzws_saved_carts where id=r.id and user_id=p_user;was_replaced=true;
 end if;
 insert into public.zzws_saved_carts(user_id,title,cart,draft,request_id) values(p_user,p_title,p_cart,p_draft,p_request) returning * into r;
 return to_jsonb(r)||jsonb_build_object('replaced',was_replaced);
end $$;
revoke all on function public.zzws_save_memory(uuid,text,jsonb,integer) from public,anon,authenticated;
revoke all on function public.zzws_save_cart(uuid,text,jsonb,jsonb,uuid,uuid) from public,anon,authenticated;
grant execute on function public.zzws_save_memory(uuid,text,jsonb,integer) to service_role;
grant execute on function public.zzws_save_cart(uuid,text,jsonb,jsonb,uuid,uuid) to service_role;
