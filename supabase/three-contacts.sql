create or replace function public.zzws_import_users(p_draft uuid,p_actor uuid,p_users jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare item jsonb; old public.zzws_users; v_profile jsonb; v_rows jsonb;
begin
 perform 1 from public.zzws_drafts where id=p_draft and actor=p_actor and kind='users' and expires>now() for update;
 if not found then raise exception 'Draft expired'; end if;
 for item in select * from jsonb_array_elements(p_users) loop
  select * into old from public.zzws_users where login=item->>'login' for update;
  if found then
   if old.profile->>'role'='admin' then raise exception 'Cannot import administrator'; end if;
   v_rows=item->'profile'->'rowsList';
   if coalesce((item->>'preserveExtraContacts')::boolean,false) and jsonb_array_length(old.profile->'rowsList')>1 then
    select v_rows || coalesce(jsonb_agg(r.value order by r.ordinality),'[]'::jsonb) into v_rows
    from jsonb_array_elements(old.profile->'rowsList') with ordinality r(value,ordinality) where r.ordinality between 2 and 3;
   end if;
   v_profile=old.profile || jsonb_build_object('client',item->'profile'->'client','sheet',item->'profile'->'sheet',
      'brands',item->'profile'->'brands','allBrands',item->'profile'->'allBrands','rowsList',v_rows);
   update public.zzws_users set profile=v_profile where id=old.id;
   delete from public.zzws_sessions where user_id=old.id;
  else
   insert into public.zzws_users(id,login,profile,active) values((item->>'id')::uuid,item->>'login',item->'profile',false);
  end if;
 end loop;
 delete from public.zzws_drafts where id=p_draft;
 insert into public.zzws_audit(actor,action,detail) values(p_actor,'users_import',jsonb_array_length(p_users)::text);
end $$;
revoke all on function public.zzws_import_users(uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.zzws_import_users(uuid,uuid,jsonb) to service_role;
