-- Deployment script, following this repository's SQL deployment-file convention.
-- Apply before deploying the matching Edge Function. No order/profile data is changed.
begin;
alter table public.zzws_state add column if not exists catalog_controls jsonb not null default '{}';
alter table public.zzws_state add column if not exists catalog_controls_revision uuid not null default gen_random_uuid();
create index if not exists zzws_orders_popularity_created on public.zzws_orders(created)
 where status in ('completed','received');
create or replace function public.zzws_catalog_popularity(p_user uuid,p_days integer,p_articul text default null)
returns table(articul text,orders bigint,customers bigint,personal_orders bigint)
language sql stable security invoker set search_path='' as $$
 with purchased as (
  select distinct o.id,o.user_id,line->>'articul' as articul
  from public.zzws_orders o
  join public.zzws_users u on u.id=o.user_id and u.profile->>'role'='client'
  cross join lateral jsonb_array_elements(o.lines) as line
  where o.status in ('completed','received') and o.created>=now()-greatest(1,least(365,p_days))*interval '1 day'
   and (p_articul is null or line->>'articul'=p_articul)
   and coalesce((line->>'qty')::numeric,0)>0
 ), totals as (
  select p.articul,count(*) as orders,count(distinct p.user_id) as customers,
   count(*) filter(where p.user_id=p_user) as personal_orders
  from purchased p where p.articul is not null group by p.articul
 ) select * from totals;
$$;
revoke all on function public.zzws_catalog_popularity(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.zzws_catalog_popularity(uuid,integer,text) to service_role;
commit;
