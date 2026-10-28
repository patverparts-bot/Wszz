-- Apply after receipt-confirmation.sql. Receipt depends on ownership and revision, not administrator status.
create or replace function public.zzws_confirm_receipt(p_user uuid,p_order uuid,p_revision integer,p_intact boolean) returns jsonb language plpgsql security invoker set search_path='' as $$
declare old public.zzws_orders;result public.zzws_orders;statement text='Հաստատում եմ, որ այս պատվերի ապրանքները ստացել եմ ամբողջությամբ և առանց վնասվածքների։';
begin
 perform public.zzws_receipt_state(p_user);
 if not exists(select 1 from public.zzws_users where id=p_user and active) then raise sqlstate 'PT403' using message='Հասանելիությունն արգելված է';end if;
 select * into old from public.zzws_orders where id=p_order and user_id=p_user for update;if not found then raise sqlstate 'PT404' using message='Պատվերը չի գտնվել';end if;
 if old.received_at is not null then return to_jsonb(old);end if;
 if p_intact is distinct from true then raise sqlstate 'PT400' using message='Հաստատեք ամբողջական և անվնաս ստացումը';end if;
 if old.revision is distinct from p_revision then raise sqlstate 'PT409' using message='Պատվերն արդեն փոխվել է։ Թարմացրեք տվյալները և կրկին հաստատեք ստացումը';end if;
 update public.zzws_orders set status='received',received_at=now(),received_by=p_user,receipt=jsonb_build_object('version',1,'intact',true,'statement',statement,'orderRevision',old.revision,'confirmedAt',now(),'customer',old.customer),revision=revision+1,updated=now() where id=old.id returning * into result;
 insert into public.zzws_order_events(order_id,user_id,revision,detail,read_at) values(result.id,p_user,result.revision,jsonb_build_object('kind','receipt','number',result.number,'oldStatus',old.status,'status','received','statement',statement),now());
 insert into public.zzws_receipt_notices(order_id,number,customer,revision,received_at) values(result.id,result.number,result.customer,result.revision,result.received_at);
 insert into public.zzws_audit(actor,action,detail) values(p_user,'order_received',jsonb_build_object('number',result.number,'target',result.customer,'statement',statement)::text);
 perform public.zzws_receipt_state(p_user);return to_jsonb(result);
end $$;
revoke all on function public.zzws_confirm_receipt(uuid,uuid,integer,boolean) from public,anon,authenticated;
grant execute on function public.zzws_confirm_receipt(uuid,uuid,integer,boolean) to service_role;
