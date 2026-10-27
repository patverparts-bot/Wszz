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
