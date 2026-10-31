alter table public.zzws_mail_transport add column security text not null default 'starttls' check(security in ('starttls','tls'));
update public.zzws_mail_transport set security=case when port=465 then 'tls' else 'starttls' end;
alter table public.zzws_mail_transport drop constraint zzws_mail_transport_port_check;
alter table public.zzws_mail_transport add constraint zzws_mail_transport_port_check check(port between 1 and 65535);

create function public.zzws_mail_transport_save_v2(p_actor uuid,p_revision uuid,p_settings_revision uuid,p_cc jsonb,p_from text,p_host text,p_port integer,p_username text,p_security text,p_password text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.zzws_mail_transport;s jsonb;begin
 if not exists(select 1 from public.zzws_users u join public.zzws_admin_scopes a on a.user_id=u.id where u.id=p_actor and u.active and u.profile->>'role'='admin' and a.scope='owner') then raise sqlstate 'PT403';end if;
 if p_host is null or length(p_host)>253 or p_host!~'^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,63}$' or p_port is null or p_port not between 1 and 65535 or p_security is null or p_security not in ('starttls','tls') or p_username is null or length(p_username) not between 1 and 320 or p_username~'[[:cntrl:]]' or p_password is not null and length(p_password) not between 1 and 4096 then raise sqlstate 'PT400';end if;
 if p_from is null or p_from='' then raise sqlstate 'PT400';end if;
 select * into m from public.zzws_mail_transport where id for update;
 if m.revision is distinct from p_revision then raise sqlstate 'PT409';end if;
 if p_password is null and (m.secret_id is null or m.host<>p_host or m.username<>p_username) then raise sqlstate 'PT400' using message='Մուտքագրեք փոստի գաղտնաբառը նոր սերվերի կամ մուտքանվան համար';end if;
 s=public.zzws_email_settings_save(p_actor,p_settings_revision,p_cc,p_from);
 if p_password is not null then
  if m.secret_id is null then m.secret_id=vault.create_secret(p_password,'zzws_mail_transport_password','ZZWS report mailbox password');
  else perform vault.update_secret(m.secret_id,p_password);end if;
 end if;
 update public.zzws_mail_transport set host=p_host,port=p_port,security=p_security,username=p_username,secret_id=m.secret_id,revision=gen_random_uuid(),updated=now(),updated_by=p_actor where id;
 insert into public.zzws_audit(actor,action,detail) values(p_actor,'report_email_settings','Mail connection updated');
 return s;
end $$;
revoke all on function public.zzws_mail_transport_save_v2(uuid,uuid,uuid,jsonb,text,text,integer,text,text,text) from public,anon,authenticated;
grant execute on function public.zzws_mail_transport_save_v2(uuid,uuid,uuid,jsonb,text,text,integer,text,text,text) to service_role;

-- Keep previously cached clients compatible with the original port-based modes.
create or replace function public.zzws_mail_transport_save(p_actor uuid,p_revision uuid,p_settings_revision uuid,p_cc jsonb,p_from text,p_host text,p_port integer,p_username text,p_password text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 return public.zzws_mail_transport_save_v2(p_actor,p_revision,p_settings_revision,p_cc,p_from,p_host,p_port,p_username,case when p_port=465 then 'tls' else 'starttls' end,p_password);
end $$;
