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

alter table public.zzws_user_memory add column cleared jsonb not null default '{}';
create or replace function public.zzws_save_memory(p_user uuid,p_section text,p_value jsonb,p_version integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.zzws_user_memory;v integer;
begin
 if p_section not in ('cart','favorites','history','filters','preferences','draft') then raise exception 'Invalid section';end if;
 insert into public.zzws_user_memory(user_id) values(p_user) on conflict do nothing;
 select * into r from public.zzws_user_memory where user_id=p_user for update;
 v=coalesce((r.versions->>p_section)::integer,0);
 if v<>p_version then return jsonb_build_object('conflict',true,'value',r.data->p_section,'version',v,'cleared',coalesce((r.cleared->>p_section)::integer,0)>p_version);end if;
 update public.zzws_user_memory set data=jsonb_set(data,array[p_section],p_value),versions=jsonb_set(versions,array[p_section],to_jsonb(v+1)) where user_id=p_user;
 return jsonb_build_object('version',v+1);
end $$;
create function public.zzws_storage_revision(p_user uuid) returns text
language sql security invoker set search_path='' as $$
 select md5(coalesce((select versions::text from public.zzws_user_memory where user_id=p_user),'{}')||coalesce((select string_agg(id::text||saved_at::text,',' order by id) from public.zzws_saved_carts where user_id=p_user),''));
$$;
create function public.zzws_storage_report() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare db_bytes bigint;user_bytes bigint;storage_bytes bigint;storage_count bigint;people jsonb;
begin
 db_bytes=pg_database_size(current_database());
 select coalesce(sum(pg_total_relation_size(c.oid)),0) into user_bytes from pg_class c join pg_namespace n on c.relnamespace=n.oid
 where (n.nspname='public' and c.relname in ('zzws_users','zzws_sessions','zzws_user_memory','zzws_saved_carts'))
 or (n.nspname='auth' and c.relname in ('users','identities','sessions','refresh_tokens'));
 select coalesce(sum(case when metadata->>'size' ~ '^[0-9]+$' then (metadata->>'size')::bigint else 0 end),0),count(*) into storage_bytes,storage_count from storage.objects;
 select coalesce(jsonb_agg(info order by lower(info->>'login')),'[]') into people from (
  select jsonb_build_object('id',u.id,'login',u.login,'client',u.profile->>'client','active',u.active,'role',u.profile->>'role',
   'revision',public.zzws_storage_revision(u.id),'accountBytes',octet_length(convert_to(jsonb_build_object('login',u.login,'profile',u.profile,'active',u.active)::text,'UTF8')),
   'sessions',(select count(*) from public.zzws_sessions where user_id=u.id and expires>now()),
   'sections',coalesce((select jsonb_object_agg(k,jsonb_build_object('bytes',case when coalesce(m.data->k,'null'::jsonb) in ('null'::jsonb,'{}'::jsonb,'[]'::jsonb) then 0 else octet_length(convert_to((m.data->k)::text,'UTF8')) end,
    'count',case when jsonb_typeof(m.data->k)='array' then jsonb_array_length(m.data->k) when jsonb_typeof(m.data->k)='object' then (select count(*) from jsonb_object_keys(m.data->k)) else 0 end))
    from unnest(array['cart','favorites','history','filters','preferences','draft']) k),'{}') ||
    jsonb_build_object('savedCarts',(select jsonb_build_object('bytes',coalesce(sum(octet_length(convert_to(jsonb_build_object('title',title,'cart',cart,'draft',draft,'saved_at',saved_at)::text,'UTF8'))),0),'count',count(*)) from public.zzws_saved_carts where user_id=u.id))) info
  from public.zzws_users u left join public.zzws_user_memory m on m.user_id=u.id
 ) rows;
 return jsonb_build_object('measuredAt',now(),'databaseBytes',db_bytes,'userTablesBytes',user_bytes,'systemDatabaseBytes',greatest(0,db_bytes-user_bytes),'storageBytes',storage_bytes,'storageObjects',storage_count,'users',people);
end $$;
create function public.zzws_clear_user_data(p_user uuid,p_section text,p_revision text,p_actor uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare target public.zzws_users;section text;selected text[];v integer;
begin
 if p_section not in ('cart','favorites','history','filters','preferences','draft','savedCarts','all') then raise exception 'Invalid section';end if;
 select * into target from public.zzws_users where id=p_user for update;
 if not found then raise sqlstate 'PT404' using message='Пользователь не найден';end if;
 insert into public.zzws_user_memory(user_id) values(p_user) on conflict do nothing;
 perform 1 from public.zzws_user_memory where user_id=p_user for update;
 if public.zzws_storage_revision(p_user) is distinct from p_revision then raise sqlstate 'PT409' using message='Данные пользователя изменились. Обновите отчёт и повторите очистку';end if;
 selected=case when p_section='all' then array['cart','favorites','history','filters','preferences','draft'] when p_section='savedCarts' then array[]::text[] else array[p_section] end;
 foreach section in array selected loop
  select coalesce((versions->>section)::integer,0)+1 into v from public.zzws_user_memory where user_id=p_user;
  update public.zzws_user_memory set data=jsonb_set(data,array[section],case when section in ('favorites','history') then '[]'::jsonb else '{}'::jsonb end),
   versions=jsonb_set(versions,array[section],to_jsonb(v)),cleared=jsonb_set(cleared,array[section],to_jsonb(v)) where user_id=p_user;
 end loop;
 if p_section in ('all','savedCarts') then delete from public.zzws_saved_carts where user_id=p_user;end if;
 insert into public.zzws_audit(actor,action,detail) values(p_actor,'user_data_clear',jsonb_build_object('target',jsonb_build_object('id',p_user,'login',target.login,'client',target.profile->>'client'),'section',p_section)::text);
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.zzws_storage_revision(uuid),public.zzws_storage_report(),public.zzws_clear_user_data(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.zzws_storage_revision(uuid),public.zzws_storage_report(),public.zzws_clear_user_data(uuid,text,text,uuid) to service_role;

create table public.zzws_orders(
 id uuid primary key default gen_random_uuid(),number bigint generated always as identity unique,
 user_id uuid references public.zzws_users(id) on delete set null,
 request_id uuid not null,customer jsonb not null,delivery jsonb not null,
 lines jsonb not null,status text not null default 'new' check(status in ('new','confirmed','in_progress','completed','rejected')),
 revision integer not null default 1,total numeric not null check(total>=0),
 comment text not null default '',confirmation jsonb not null default '{}',created timestamptz not null default now(),updated timestamptz not null default now(),
 unique(user_id,request_id)
);
create index zzws_orders_owner on public.zzws_orders(user_id,created desc);
create index zzws_orders_status on public.zzws_orders(status,updated desc);
create table public.zzws_order_events(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.zzws_orders(id) on delete cascade,
 user_id uuid references public.zzws_users(id) on delete cascade,revision integer not null,
 detail jsonb not null,created timestamptz not null default now(),read_at timestamptz,
 unique(order_id,revision)
);
create index zzws_order_events_unread on public.zzws_order_events(user_id,created desc) where read_at is null;
do $$ declare t text;begin
 foreach t in array array['zzws_orders','zzws_order_events'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 execute format('create policy service_only on public.%I for all to service_role using(true) with check(true)',t);
 end loop;
end $$;
revoke all on sequence public.zzws_orders_number_seq from public,anon,authenticated;
grant usage,select on sequence public.zzws_orders_number_seq to service_role;
alter table public.zzws_drafts drop constraint zzws_drafts_kind_check;
alter table public.zzws_drafts add constraint zzws_drafts_kind_check check(kind in ('price','users','order'));
create function public.zzws_submit_order(p_user uuid,p_request uuid,p_customer jsonb,p_delivery jsonb,p_lines jsonb,p_total numeric) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result public.zzws_orders;
begin
 insert into public.zzws_orders(user_id,request_id,customer,delivery,lines,total) values(p_user,p_request,p_customer,p_delivery,p_lines,p_total)
 on conflict(user_id,request_id) do nothing returning * into result;
 if result.id is null then select * into result from public.zzws_orders where user_id=p_user and request_id=p_request;end if;
 return to_jsonb(result);
end $$;
create function public.zzws_update_order(p_order uuid,p_revision integer,p_lines jsonb,p_status text,p_comment text,p_total numeric,p_detail jsonb,p_actor uuid,p_draft uuid default null,p_delivery jsonb default null,p_confirmation jsonb default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result public.zzws_orders;old public.zzws_orders;
begin
 select * into old from public.zzws_orders where id=p_order for update;
 if not found then raise sqlstate 'PT404' using message='Заказ не найден';end if;
 if p_draft is not null and not exists(select 1 from public.zzws_drafts where id=p_draft and actor=p_actor and kind='order' and expires>now()) then raise sqlstate 'PT409' using message='Предпросмотр истёк или уже применён';end if;
 if old.revision<>p_revision then raise sqlstate 'PT409' using message='Заказ уже изменён. Откройте его заново';end if;
 if old.lines=p_lines and old.status=p_status and old.comment=p_comment and (p_delivery is null or old.delivery=p_delivery) and (p_confirmation is null or old.confirmation=p_confirmation) then if p_draft is not null then delete from public.zzws_drafts where id=p_draft;end if;return to_jsonb(old);end if;
 update public.zzws_orders set lines=p_lines,status=p_status,comment=p_comment,total=p_total,delivery=coalesce(p_delivery,delivery),confirmation=coalesce(p_confirmation,confirmation),revision=revision+1,updated=now() where id=p_order returning * into result;
 insert into public.zzws_order_events(order_id,user_id,revision,detail) values(result.id,result.user_id,result.revision,p_detail||jsonb_build_object('oldStatus',old.status,'status',result.status,'comment',p_comment,'total',p_total));
 insert into public.zzws_audit(actor,action,detail) values(p_actor,'order_update',jsonb_build_object('number',result.number,'revision',result.revision,'target',result.customer,'status',result.status)::text);
 if p_draft is not null then delete from public.zzws_drafts where id=p_draft;end if;
 return to_jsonb(result);
end $$;
revoke all on function public.zzws_submit_order(uuid,uuid,jsonb,jsonb,jsonb,numeric),public.zzws_update_order(uuid,integer,jsonb,text,text,numeric,jsonb,uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.zzws_submit_order(uuid,uuid,jsonb,jsonb,jsonb,numeric),public.zzws_update_order(uuid,integer,jsonb,text,text,numeric,jsonb,uuid,uuid,jsonb,jsonb) to service_role;

create or replace function public.zzws_storage_report() returns jsonb
language plpgsql security invoker set search_path='' as $$
declare db_bytes bigint;user_bytes bigint;storage_bytes bigint;storage_count bigint;people jsonb;
begin
 db_bytes=pg_database_size(current_database());
 select coalesce(sum(pg_total_relation_size(c.oid)),0) into user_bytes from pg_class c join pg_namespace n on c.relnamespace=n.oid
 where (n.nspname='public' and c.relname in ('zzws_users','zzws_sessions','zzws_user_memory','zzws_saved_carts','zzws_orders','zzws_order_events'))
 or (n.nspname='auth' and c.relname in ('users','identities','sessions','refresh_tokens'));
 select coalesce(sum(case when metadata->>'size' ~ '^[0-9]+$' then (metadata->>'size')::bigint else 0 end),0),count(*) into storage_bytes,storage_count from storage.objects;
 select coalesce(jsonb_agg(info order by lower(info->>'login')),'[]') into people from (
  select jsonb_build_object('id',u.id,'login',u.login,'client',u.profile->>'client','active',u.active,'role',u.profile->>'role',
   'revision',public.zzws_storage_revision(u.id),'accountBytes',octet_length(convert_to(jsonb_build_object('login',u.login,'profile',u.profile,'active',u.active)::text,'UTF8')),
   'sessions',(select count(*) from public.zzws_sessions where user_id=u.id and expires>now()),
   'sections',coalesce((select jsonb_object_agg(k,jsonb_build_object('bytes',case when coalesce(m.data->k,'null'::jsonb) in ('null'::jsonb,'{}'::jsonb,'[]'::jsonb) then 0 else octet_length(convert_to((m.data->k)::text,'UTF8')) end,
    'count',case when jsonb_typeof(m.data->k)='array' then jsonb_array_length(m.data->k) when jsonb_typeof(m.data->k)='object' then (select count(*) from jsonb_object_keys(m.data->k)) else 0 end))
    from unnest(array['cart','favorites','history','filters','preferences','draft']) k),'{}') ||
    jsonb_build_object('savedCarts',(select jsonb_build_object('bytes',coalesce(sum(octet_length(convert_to(jsonb_build_object('title',title,'cart',cart,'draft',draft,'saved_at',saved_at)::text,'UTF8'))),0),'count',count(*)) from public.zzws_saved_carts where user_id=u.id),
    'orders',(select jsonb_build_object('bytes',coalesce(sum(octet_length(convert_to(to_jsonb(o)::text,'UTF8'))),0),'count',count(*)) from public.zzws_orders o where o.user_id=u.id),
    'orderNotifications',(select jsonb_build_object('bytes',coalesce(sum(octet_length(convert_to(to_jsonb(e)::text,'UTF8'))),0),'count',count(*)) from public.zzws_order_events e where e.user_id=u.id))) info
  from public.zzws_users u left join public.zzws_user_memory m on m.user_id=u.id
 ) rows;
 return jsonb_build_object('measuredAt',now(),'databaseBytes',db_bytes,'userTablesBytes',user_bytes,'systemDatabaseBytes',greatest(0,db_bytes-user_bytes),'storageBytes',storage_bytes,'storageObjects',storage_count,'users',people);
end $$;

alter table public.zzws_orders add column original_lines jsonb;
-- Recover the original contents of orders created before immutable snapshots.
do $$ declare o record;e record;c jsonb;restored jsonb;begin
 for o in select id,lines from public.zzws_orders where original_lines is null for update loop
  restored=o.lines;
  for e in select detail from public.zzws_order_events where order_id=o.id order by revision desc loop
   for c in select value from jsonb_array_elements(coalesce(e.detail->'changes','[]'::jsonb)) loop
    if c->>'kind'='changed' and exists(select 1 from jsonb_array_elements(restored) where value->>'articul'=c->>'articul') then
     select jsonb_agg(case when value->>'articul'=c->>'articul' then c->'before' else value end order by ordinality) into restored from jsonb_array_elements(restored) with ordinality;
    elsif c->>'kind' in ('added','removed','changed') then
     select coalesce(jsonb_agg(value),'[]'::jsonb) into restored from jsonb_array_elements(restored) where value->>'articul' is distinct from c->>'articul';
     if c->>'kind' in ('removed','changed') and c->'before' is not null and c->'before'<>'null'::jsonb then restored=restored||jsonb_build_array(c->'before');end if;
    end if;
   end loop;
  end loop;
  update public.zzws_orders set original_lines=restored where id=o.id;
 end loop;
end $$;
alter table public.zzws_orders alter column original_lines set not null;
alter table public.zzws_orders alter column original_lines set default '[]';
create or replace function public.zzws_submit_order(p_user uuid,p_request uuid,p_customer jsonb,p_delivery jsonb,p_lines jsonb,p_total numeric) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result public.zzws_orders;
begin
 insert into public.zzws_orders(user_id,request_id,customer,delivery,lines,original_lines,total) values(p_user,p_request,p_customer,p_delivery,p_lines,p_lines,p_total)
 on conflict(user_id,request_id) do nothing returning * into result;
 if result.id is null then select * into result from public.zzws_orders where user_id=p_user and request_id=p_request;
 else insert into public.zzws_audit(actor,action,detail) values(p_user,'order_submit',jsonb_build_object('number',result.number,'target',p_customer)::text);end if;
 return to_jsonb(result);
end $$;
