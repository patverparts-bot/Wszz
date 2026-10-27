create table if not exists public.zzws_backup_keys(hash text primary key,expires timestamptz not null,created timestamptz not null default now());
alter table public.zzws_backup_keys enable row level security;
revoke all on public.zzws_backup_keys from anon,authenticated;
grant all on public.zzws_backup_keys to service_role;
create or replace function public.zzws_application_snapshot()
returns jsonb language sql set search_path='' as $$
 select jsonb_build_object('format','zzws-application-backup-v1','created',now(),'tables',jsonb_build_object(
 'users',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_users t),
 'versions',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_versions t),
 'state',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_state t),
 'orders',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_orders t),
 'order_events',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_order_events t),
 'saved_carts',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_saved_carts t),
 'user_memory',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_user_memory t),
 'admin_scopes',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_admin_scopes t),
 'audit',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_audit t)
 ));
$$;
revoke all on function public.zzws_application_snapshot() from public,anon,authenticated;
grant execute on function public.zzws_application_snapshot() to service_role;

create policy service_only on public.zzws_backup_keys for all to service_role using(true) with check(true);
