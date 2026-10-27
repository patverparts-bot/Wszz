alter table public.zzws_state add column rules jsonb not null default '{}'::jsonb;
alter table public.zzws_state add column rules_revision uuid not null default gen_random_uuid();

create function public.zzws_update_rules(p_rules jsonb,p_expected uuid,p_actor uuid) returns uuid
language plpgsql security invoker set search_path='' as $$
declare v_revision uuid;
begin
 update public.zzws_state set rules=p_rules,rules_revision=gen_random_uuid()
 where id and rules_revision=p_expected returning rules_revision into v_revision;
 if not found then raise exception 'Rules changed; reload before saving' using errcode='PT409'; end if;
 insert into public.zzws_audit(actor,action,detail) values(p_actor,'rules_update',jsonb_build_object('revision',v_revision,'rules',p_rules)::text);
 return v_revision;
end $$;
revoke all on function public.zzws_update_rules(jsonb,uuid,uuid) from public,anon,authenticated;
grant execute on function public.zzws_update_rules(jsonb,uuid,uuid) to service_role;
