create or replace function public.zzws_save_user(p_id uuid,p_login text,p_profile jsonb,p_active boolean,p_actor uuid) returns void
language plpgsql security invoker set search_path='' as $$
declare previous public.zzws_users; actor_info jsonb; changes text[] := '{}';
begin
 select * into previous from public.zzws_users where id=p_id;
 select jsonb_build_object('login',login,'client',profile->>'client') into actor_info from public.zzws_users where id=p_actor;
 if previous.id is not null then
  if previous.login is distinct from p_login then changes=array_append(changes,'Логин: '||previous.login||' → '||p_login); end if;
  if previous.active is distinct from p_active then changes=array_append(changes,case when p_active then 'Доступ включён' else 'Доступ выключен' end); end if;
  if previous.profile->>'role' is distinct from p_profile->>'role' then changes=array_append(changes,'Изменена роль'); end if;
  if previous.profile->>'sheet' is distinct from p_profile->>'sheet' then changes=array_append(changes,'Группа цен: '||(p_profile->>'sheet')); end if;
  if previous.profile->'rowsList' is distinct from p_profile->'rowsList' then changes=array_append(changes,'Обновлены контрагенты, адреса или контакты'); end if;
  if previous.profile->'catalogAccess' is distinct from p_profile->'catalogAccess' then changes=array_append(changes,'Обновлён доступ к брендам и категориям'); end if;
 end if;
 insert into public.zzws_users(id,login,profile,active) values(p_id,p_login,p_profile,p_active)
 on conflict(id) do update set login=excluded.login,profile=excluded.profile,active=excluded.active;
 delete from public.zzws_sessions where user_id=p_id;
 insert into public.zzws_audit(actor,action,detail) values(p_actor,'user_update',jsonb_build_object('actor',actor_info,'target',jsonb_build_object('id',p_id,'login',p_login,'client',p_profile->>'client','role',p_profile->>'role','active',p_active),'created',previous.id is null,'changes',to_jsonb(changes))::text);
end $$;
