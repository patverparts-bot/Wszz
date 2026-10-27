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
