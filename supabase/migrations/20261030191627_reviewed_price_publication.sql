-- Apply with the matching API. Keeps the existing publication/audit hooks.
create or replace function public.zzws_publish_reviewed(p_draft uuid,p_actor uuid)
returns uuid language plpgsql security invoker set search_path='' as $$
declare d public.zzws_drafts; active_version uuid; result uuid;
begin
 select * into d from public.zzws_drafts where id=p_draft and actor=p_actor and kind='price' and expires>now() for update;
 if not found or jsonb_typeof(d.payload) is distinct from 'object' or jsonb_typeof(d.payload->'products') is distinct from 'array' or not(d.payload ? 'baseVersion') then
  raise exception 'Preview expired; reload file' using errcode='PT409';
 end if;
 select version into active_version from public.zzws_state where id=true for update;
 if active_version is distinct from (d.payload->>'baseVersion')::uuid then
  raise exception 'Price version changed; reload preview' using errcode='PT409';
 end if;
 update public.zzws_drafts set payload=d.payload->'products' where id=p_draft;
 result:=public.zzws_publish(p_draft,p_actor);
 return result;
end;
$$;
revoke all on function public.zzws_publish_reviewed(uuid,uuid) from public,anon,authenticated;
grant execute on function public.zzws_publish_reviewed(uuid,uuid) to service_role;
