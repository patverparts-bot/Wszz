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
