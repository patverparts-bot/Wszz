begin;
alter sequence public.zzws_orders_number_seq restart with 1000000000;
do $$
declare uid uuid:=gen_random_uuid();other_uid uuid:=gen_random_uuid();actor uuid;actor2 uuid;ids uuid[]:='{}';orders jsonb[]:='{}';o jsonb;g jsonb;control jsonb;glob jsonb;notice uuid;req uuid:=gen_random_uuid();i integer;line jsonb:='[{"articul":"receipt-test","name":"Test","qty":1,"unitPrice":100}]';
begin
 select id into actor from public.zzws_users where profile->>'role'='admin' and active order by id limit 1;
 select id into actor2 from public.zzws_users where profile->>'role'='admin' and active and id<>actor order by id limit 1;
 insert into auth.users(id,email) values(uid,uid::text||'@receipt.test.invalid'),(other_uid,other_uid::text||'@receipt.test.invalid');
 insert into public.zzws_users(id,login,profile,active,needs_password_setup) values(uid,'receipt-test-'||uid::text,jsonb_build_object('role','client','sheet','Dealers','client','Receipt test'),true,false),(other_uid,'receipt-test-'||other_uid::text,jsonb_build_object('role','client','sheet','Dealers','client','Other test'),true,false);
 for i in 1..3 loop
  o=public.zzws_submit_order(uid,case when i=1 then req else gen_random_uuid() end,'{"client":"Receipt test"}','{}',line,100);ids=array_append(ids,(o->>'id')::uuid);orders=array_append(orders,o);
  g=public.zzws_receipt_state(uid);if(g->>'pendingCount')::integer<>i then raise exception 'Incorrect pending count';end if;
 end loop;
 if not(g->>'blocked')::boolean then raise exception 'Third order must latch the cycle';end if;
 o=public.zzws_submit_order(uid,req,'{}','{}',line,100);if(o->>'id')::uuid<>ids[1] then raise exception 'Retry must remain idempotent when blocked';end if;
 begin perform public.zzws_submit_order(uid,gen_random_uuid(),'{}','{}',line,100);raise exception 'Fourth order was incorrectly allowed';exception when sqlstate 'PT429' then null;end;
 begin perform public.zzws_confirm_receipt(uid,ids[1],1,true);raise exception 'New order receipt was allowed';exception when sqlstate 'PT409' then null;end;
 for i in 1..3 loop o=public.zzws_update_order(ids[i],1,line,(array['confirmed','in_progress','completed'])[i],'',100,'{}',actor);end loop;
 begin perform public.zzws_confirm_receipt(uid,ids[1],1,true);raise exception 'Stale revision was accepted';exception when sqlstate 'PT409' then null;end;
 begin perform public.zzws_confirm_receipt(other_uid,ids[1],2,true);raise exception 'Another customer confirmed receipt';exception when sqlstate 'PT404' then null;end;
 begin perform public.zzws_confirm_receipt(uid,ids[1],2,false);raise exception 'Attestation was not required';exception when sqlstate 'PT400' then null;end;
 o=public.zzws_confirm_receipt(uid,ids[1],2,true);if o->>'status'<>'received' or o->'receipt'->>'intact'<>'true' then raise exception 'Missing receipt proof';end if;
 g=public.zzws_receipt_state(uid);if not(g->>'blocked')::boolean or(g->>'pendingCount')::integer<>2 then raise exception 'Partial acknowledgement incorrectly released the cycle';end if;
 begin perform public.zzws_submit_order(uid,gen_random_uuid(),'{}','{}',line,100);raise exception 'Cycle was released too early';exception when sqlstate 'PT429' then null;end;
 begin perform public.zzws_update_order(ids[1],3,line,'confirmed','',100,'{}',actor);raise exception 'Closed order was editable';exception when sqlstate 'PT409' then null;end;
 perform public.zzws_confirm_receipt(uid,ids[1],2,true);
 perform public.zzws_confirm_receipt(uid,ids[2],2,true);perform public.zzws_confirm_receipt(uid,ids[3],2,true);
 g=public.zzws_receipt_state(uid);if(g->>'blocked')::boolean or(g->>'pendingCount')::integer<>0 then raise exception 'Completed cycle was not released';end if;
 if(select count(*) from public.zzws_receipt_notices where order_id=any(ids))<>3 then raise exception 'Receipt notification duplicated or missing';end if;
 select id into notice from public.zzws_receipt_notices where order_id=ids[1];insert into public.zzws_admin_notice_reads(notice_id,user_id) values(notice,actor);
 if exists(select 1 from jsonb_array_elements(public.zzws_admin_receipt_notices(actor)->'events') e where e->>'id'=notice::text) then raise exception 'Admin read acknowledgement failed';end if;
 if actor2 is not null and not exists(select 1 from jsonb_array_elements(public.zzws_admin_receipt_notices(actor2)->'events') e where e->>'id'=notice::text) then raise exception 'One admin cleared another admin notification';end if;
 o=public.zzws_submit_order(uid,gen_random_uuid(),'{}','{}',line,100);
 control=public.zzws_save_receipt_control(actor,uid,'until',now()+interval '1 hour',null);
 if(public.zzws_receipt_state(uid)->>'enabled')::boolean then raise exception 'Temporary exemption did not work';end if;
 for i in 1..3 loop perform public.zzws_submit_order(uid,gen_random_uuid(),'{}','{}',line,100);end loop;
 control=public.zzws_save_receipt_control(actor,uid,'on',null,(control->>'revision')::uuid);
 if not(public.zzws_receipt_state(uid)->>'blocked')::boolean then raise exception 'Re-enabled control did not block outstanding cycle';end if;
 control=public.zzws_save_receipt_control(actor,uid,'off',null,(control->>'revision')::uuid);
 if(public.zzws_receipt_state(uid)->>'enabled')::boolean then raise exception 'Permanent exemption did not work';end if;
 control=public.zzws_save_receipt_control(actor,uid,'until',now()+interval '1 hour',(control->>'revision')::uuid);update public.zzws_client_receipt_controls set disabled_until=now()-interval '1 second' where user_id=uid;
 if not(public.zzws_receipt_state(uid)->>'enabled')::boolean then raise exception 'Expired exemption did not resume control';end if;
 select to_jsonb(s) into glob from public.zzws_receipt_settings s where id=true;
 glob=public.zzws_save_receipt_control(actor,null,'off',null,(glob->>'revision')::uuid);if(public.zzws_receipt_state(uid)->>'enabled')::boolean then raise exception 'Global off did not work';end if;
 glob=public.zzws_save_receipt_control(actor,null,'on',null,(glob->>'revision')::uuid);
 for o in select to_jsonb(t) from public.zzws_orders t where user_id=uid and received_at is null loop perform public.zzws_update_order((o->>'id')::uuid,(o->>'revision')::integer,line,'rejected','',100,'{}',actor);end loop;
 if(public.zzws_receipt_state(uid)->>'blocked')::boolean then raise exception 'Rejected orders kept the cycle locked';end if;
 -- Confirm only eligible statuses. New/rejected must keep their status and produce no proof or notice.
 for i in 1..5 loop
  o=public.zzws_submit_order(other_uid,gen_random_uuid(),'{}','{}',line,100);
  if i>1 then o=public.zzws_update_order((o->>'id')::uuid,1,line,(array['new','confirmed','in_progress','completed','rejected'])[i],'',100,'{}',actor);end if;
  begin perform public.zzws_confirm_receipt(other_uid,(o->>'id')::uuid,null,true);raise exception 'Missing revision was accepted';exception when sqlstate 'PT409' then null;end;
  if o->>'status' in ('new','rejected') then
   begin perform public.zzws_confirm_receipt(other_uid,(o->>'id')::uuid,(o->>'revision')::integer,true);raise exception 'Ineligible status receipt allowed: %',o->>'status';exception when sqlstate 'PT409' then null;end;
   if exists(select 1 from public.zzws_orders where id=(o->>'id')::uuid and (received_at is not null or status<>o->>'status' or revision<>(o->>'revision')::integer)) then raise exception 'Rejected receipt mutated the order';end if;
   if exists(select 1 from public.zzws_receipt_notices where order_id=(o->>'id')::uuid) then raise exception 'Rejected receipt created a notice';end if;
   continue;
  end if;
  g=public.zzws_confirm_receipt(other_uid,(o->>'id')::uuid,(o->>'revision')::integer,true);
  if g->>'status'<>'received' or g->'receipt'->>'intact'<>'true' then raise exception 'Receipt rejected administrator status %',o->>'status';end if;
  if not exists(select 1 from public.zzws_order_events where order_id=(o->>'id')::uuid and detail->>'kind'='receipt' and detail->>'oldStatus'=o->>'status') then raise exception 'Original administrator status was lost';end if;
  perform public.zzws_confirm_receipt(other_uid,(o->>'id')::uuid,(o->>'revision')::integer,true);
  if(select count(*) from public.zzws_receipt_notices where order_id=(o->>'id')::uuid)<>1 then raise exception 'Duplicate status receipt notice';end if;
 end loop;

end $$;
rollback;
select 'PASS: new/rejected receipt denied without mutation, other three statuses allowed, receipt cycle, ownership, revisions, idempotency, exemptions, immutable closure and independent admin notices (all fixtures rolled back)' as result;
