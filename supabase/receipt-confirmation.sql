-- Receipt attestations and a latched three-order cycle. Existing profiles/pricing stay untouched.
alter table public.zzws_orders add column received_at timestamptz;
alter table public.zzws_orders add column received_by uuid references public.zzws_users(id) on delete set null;
alter table public.zzws_orders add column receipt jsonb not null default '{}';
alter table public.zzws_orders drop constraint zzws_orders_status_check;
alter table public.zzws_orders add constraint zzws_orders_status_check check(status in ('new','confirmed','in_progress','completed','rejected','received'));
alter table public.zzws_orders add constraint zzws_orders_receipt_consistency check((status='received')=(received_at is not null));
create index zzws_orders_receipt_pending on public.zzws_orders(user_id) where received_at is null and status not in ('rejected','received');
create table public.zzws_receipt_settings(id boolean primary key default true check(id),mode text not null default 'on' check(mode in ('on','off','until')),disabled_until timestamptz,revision uuid not null default gen_random_uuid(),updated_by uuid references public.zzws_users(id),updated timestamptz not null default now(),check((mode='until')=(disabled_until is not null)));
insert into public.zzws_receipt_settings(id) values(true);
create table public.zzws_client_receipt_controls(user_id uuid primary key references public.zzws_users(id) on delete cascade,mode text not null check(mode in ('inherit','on','off','until')),disabled_until timestamptz,revision uuid not null default gen_random_uuid(),updated_by uuid references public.zzws_users(id),updated timestamptz not null default now(),check((mode='until')=(disabled_until is not null)));
create table public.zzws_order_gate(user_id uuid primary key references public.zzws_users(id) on delete cascade,locked boolean not null default false);
create table public.zzws_receipt_notices(id uuid primary key default gen_random_uuid(),order_id uuid not null unique references public.zzws_orders(id) on delete cascade,number bigint not null,customer jsonb not null,revision integer not null,received_at timestamptz not null,created timestamptz not null default now());
create table public.zzws_admin_notice_reads(notice_id uuid not null references public.zzws_receipt_notices(id) on delete cascade,user_id uuid not null references public.zzws_users(id) on delete cascade,read_at timestamptz not null default now(),primary key(notice_id,user_id));
do $$declare t text;begin foreach t in array array['zzws_receipt_settings','zzws_client_receipt_controls','zzws_order_gate','zzws_receipt_notices','zzws_admin_notice_reads'] loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant all on public.%I to service_role',t);execute format('create policy service_only on public.%I for all to service_role using(true) with check(true)',t);
end loop;end $$;
create function public.zzws_receipt_state(p_user uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare g public.zzws_receipt_settings;c public.zzws_client_receipt_controls;latched boolean;pending bigint;enabled boolean;kind text;items jsonb;
begin
 select * into g from public.zzws_receipt_settings where id=true for share;
 select profile->>'role' into kind from public.zzws_users where id=p_user;if not found then raise sqlstate 'PT404' using message='Հաշիվը չի գտնվել';end if;
 insert into public.zzws_order_gate(user_id) values(p_user) on conflict do nothing;
 select locked into latched from public.zzws_order_gate where user_id=p_user for update;
 select * into c from public.zzws_client_receipt_controls where user_id=p_user;
 select count(*) into pending from public.zzws_orders where user_id=p_user and received_at is null and status not in ('rejected','received');
 if pending=0 then latched=false;elsif pending>=3 then latched=true;end if;
 update public.zzws_order_gate set locked=latched where user_id=p_user and locked is distinct from latched;
 enabled=kind='client' and not(g.mode='off' or(g.mode='until' and g.disabled_until>now())) and not(coalesce(c.mode,'inherit')='off' or(coalesce(c.mode,'inherit')='until' and c.disabled_until>now()));
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'number',q.number,'status',q.status)),'[]') into items from (select id,number,status from public.zzws_orders where user_id=p_user and received_at is null and status not in ('rejected','received') order by number limit 50) q;
 return jsonb_build_object('enabled',enabled,'blocked',enabled and latched,'latched',latched,'pendingCount',pending,'remaining',case when enabled then case when latched then 0 else greatest(0,3-pending) end else null end,'limit',3,'outstanding',items,'global',to_jsonb(g),'client',coalesce(to_jsonb(c),jsonb_build_object('mode','inherit','revision',null)));
end $$;
create or replace function public.zzws_submit_order(p_user uuid,p_request uuid,p_customer jsonb,p_delivery jsonb,p_lines jsonb,p_total numeric) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result public.zzws_orders;gate jsonb;
begin
 gate=public.zzws_receipt_state(p_user);
 if not exists(select 1 from public.zzws_users where id=p_user and active) then raise sqlstate 'PT403' using message='Հասանելիությունն արգելված է';end if;
 select * into result from public.zzws_orders where user_id=p_user and request_id=p_request;if found then return to_jsonb(result);end if;
 if (gate->>'blocked')::boolean then raise sqlstate 'PT429' using message='Նոր պատվերի համար նախ հաստատեք բոլոր չստացված պատվերների ստացումը';end if;
 insert into public.zzws_orders(user_id,request_id,customer,delivery,lines,original_lines,total) values(p_user,p_request,p_customer,p_delivery,p_lines,p_lines,p_total) returning * into result;
 insert into public.zzws_audit(actor,action,detail) values(p_user,'order_submit',jsonb_build_object('number',result.number,'target',p_customer)::text);
 perform public.zzws_receipt_state(p_user);return to_jsonb(result);
end $$;
create or replace function public.zzws_update_order(p_order uuid,p_revision integer,p_lines jsonb,p_status text,p_comment text,p_total numeric,p_detail jsonb,p_actor uuid,p_draft uuid default null,p_delivery jsonb default null,p_confirmation jsonb default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result public.zzws_orders;old public.zzws_orders;owner uuid;
begin
 select user_id into owner from public.zzws_orders where id=p_order;if owner is not null then perform public.zzws_receipt_state(owner);end if;
 select * into old from public.zzws_orders where id=p_order for update;
 if not found then raise sqlstate 'PT404' using message='Պատվերը չի գտնվել';end if;
 if old.received_at is not null or p_status='received' then raise sqlstate 'PT409' using message='Ստացված պատվերը չի խմբագրվում․ ստացումը հաստատում է միայն հաճախորդը';end if;
 if p_draft is not null and not exists(select 1 from public.zzws_drafts where id=p_draft and actor=p_actor and kind='order' and expires>now()) then raise sqlstate 'PT409' using message='Նախադիտման ժամկետը լրացել է';end if;
 if old.revision<>p_revision then raise sqlstate 'PT409' using message='Պատվերն արդեն փոխվել է';end if;
 if old.lines=p_lines and old.status=p_status and old.comment=p_comment and (p_delivery is null or old.delivery=p_delivery) and (p_confirmation is null or old.confirmation=p_confirmation) then if p_draft is not null then delete from public.zzws_drafts where id=p_draft;end if;return to_jsonb(old);end if;
 update public.zzws_orders set lines=p_lines,status=p_status,comment=p_comment,total=p_total,delivery=coalesce(p_delivery,delivery),confirmation=coalesce(p_confirmation,confirmation),revision=revision+1,updated=now() where id=p_order returning * into result;
 insert into public.zzws_order_events(order_id,user_id,revision,detail) values(result.id,result.user_id,result.revision,p_detail||jsonb_build_object('oldStatus',old.status,'status',result.status,'comment',p_comment,'total',p_total));
 insert into public.zzws_audit(actor,action,detail) values(p_actor,'order_update',jsonb_build_object('number',result.number,'revision',result.revision,'target',result.customer,'status',result.status)::text);
 if p_draft is not null then delete from public.zzws_drafts where id=p_draft;end if;
 if owner is not null then perform public.zzws_receipt_state(owner);end if;return to_jsonb(result);
end $$;
create function public.zzws_confirm_receipt(p_user uuid,p_order uuid,p_revision integer,p_intact boolean) returns jsonb language plpgsql security invoker set search_path='' as $$
declare old public.zzws_orders;result public.zzws_orders;statement text='Հաստատում եմ, որ այս պատվերի ապրանքները ստացել եմ ամբողջությամբ և առանց վնասվածքների։';
begin
 perform public.zzws_receipt_state(p_user);
 if not exists(select 1 from public.zzws_users where id=p_user and active) then raise sqlstate 'PT403' using message='Հասանելիությունն արգելված է';end if;
 select * into old from public.zzws_orders where id=p_order and user_id=p_user for update;if not found then raise sqlstate 'PT404' using message='Պատվերը չի գտնվել';end if;
 if old.received_at is not null then return to_jsonb(old);end if;
 if p_intact is distinct from true then raise sqlstate 'PT400' using message='Հաստատեք ամբողջական և անվնաս ստացումը';end if;
 if old.revision<>p_revision or old.status<>'completed' then raise sqlstate 'PT409' using message='Ստուգեք պատվերի տարբերակը․ ստացումը հաստատվում է միայն առաքումից հետո';end if;
 update public.zzws_orders set status='received',received_at=now(),received_by=p_user,receipt=jsonb_build_object('version',1,'intact',true,'statement',statement,'orderRevision',old.revision,'confirmedAt',now(),'customer',old.customer),revision=revision+1,updated=now() where id=old.id returning * into result;
 insert into public.zzws_order_events(order_id,user_id,revision,detail,read_at) values(result.id,p_user,result.revision,jsonb_build_object('kind','receipt','number',result.number,'oldStatus',old.status,'status','received','statement',statement),now());
 insert into public.zzws_receipt_notices(order_id,number,customer,revision,received_at) values(result.id,result.number,result.customer,result.revision,result.received_at);
 insert into public.zzws_audit(actor,action,detail) values(p_user,'order_received',jsonb_build_object('number',result.number,'target',result.customer,'statement',statement)::text);
 perform public.zzws_receipt_state(p_user);return to_jsonb(result);
end $$;
create function public.zzws_save_receipt_control(p_actor uuid,p_user uuid,p_mode text,p_until timestamptz,p_revision uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare prior uuid;result jsonb;
begin
 if not exists(select 1 from public.zzws_users u left join public.zzws_admin_scopes s on s.user_id=u.id where u.id=p_actor and u.active and u.profile->>'role'='admin' and coalesce(s.scope,'owner')='owner') then raise sqlstate 'PT403' using message='Անհրաժեշտ է սեփականատիրոջ իրավունք';end if;
 if p_mode is null or p_mode not in ('inherit','on','off','until') or(p_user is null and p_mode='inherit') or(p_mode='until' and(p_until is null or p_until<=now())) then raise sqlstate 'PT400' using message='Ստուգեք վերահսկման ռեժիմն ու ժամկետը';end if;
 if p_mode<>'until' then p_until=null;end if;
 if p_user is null then
  select revision into prior from public.zzws_receipt_settings where id=true for update;if prior is distinct from p_revision then raise sqlstate 'PT409' using message='Կարգավորումն արդեն փոխվել է';end if;
  update public.zzws_receipt_settings set mode=p_mode,disabled_until=p_until,revision=gen_random_uuid(),updated_by=p_actor,updated=now() where id=true returning to_jsonb(zzws_receipt_settings.*) into result;
 else
  perform public.zzws_receipt_state(p_user);select revision into prior from public.zzws_client_receipt_controls where user_id=p_user for update;if prior is distinct from p_revision then raise sqlstate 'PT409' using message='Կարգավորումն արդեն փոխվել է';end if;
  insert into public.zzws_client_receipt_controls(user_id,mode,disabled_until,updated_by) values(p_user,p_mode,p_until,p_actor) on conflict(user_id) do update set mode=p_mode,disabled_until=p_until,revision=gen_random_uuid(),updated_by=p_actor,updated=now() returning to_jsonb(zzws_client_receipt_controls.*) into result;
 end if;
 insert into public.zzws_audit(actor,action,detail) values(p_actor,'receipt_control_update',jsonb_build_object('userId',p_user,'mode',p_mode,'until',p_until)::text);return result;
end $$;
create function public.zzws_admin_receipt_notices(p_admin uuid) returns jsonb language sql security invoker set search_path='' as $$
 select jsonb_build_object('unreadCount',(select count(*) from public.zzws_receipt_notices n where not exists(select 1 from public.zzws_admin_notice_reads r where r.notice_id=n.id and r.user_id=p_admin)),'events',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from (select n.* from public.zzws_receipt_notices n where not exists(select 1 from public.zzws_admin_notice_reads r where r.notice_id=n.id and r.user_id=p_admin) order by n.created desc limit 50)t));
$$;
revoke all on function public.zzws_receipt_state(uuid),public.zzws_confirm_receipt(uuid,uuid,integer,boolean),public.zzws_save_receipt_control(uuid,uuid,text,timestamptz,uuid),public.zzws_admin_receipt_notices(uuid) from public,anon,authenticated;
grant execute on function public.zzws_receipt_state(uuid),public.zzws_confirm_receipt(uuid,uuid,integer,boolean),public.zzws_save_receipt_control(uuid,uuid,text,timestamptz,uuid),public.zzws_admin_receipt_notices(uuid) to service_role;

revoke all on function public.zzws_submit_order(uuid,uuid,jsonb,jsonb,jsonb,numeric),public.zzws_update_order(uuid,integer,jsonb,text,text,numeric,jsonb,uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.zzws_submit_order(uuid,uuid,jsonb,jsonb,jsonb,numeric),public.zzws_update_order(uuid,integer,jsonb,text,text,numeric,jsonb,uuid,uuid,jsonb,jsonb) to service_role;
