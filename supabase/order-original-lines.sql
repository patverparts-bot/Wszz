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
