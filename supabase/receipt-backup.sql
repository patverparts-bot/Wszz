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
 'receipt_settings',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_receipt_settings t),
 'client_receipt_controls',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_client_receipt_controls t),
 'order_gate',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_order_gate t),
 'receipt_notices',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_receipt_notices t),
 'admin_notice_reads',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_admin_notice_reads t),
 'audit',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from public.zzws_audit t)
 ));
$$;