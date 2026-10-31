-- Only metadata is stored here; the password is encrypted by Supabase Vault.
create table public.zzws_mail_transport(
 id boolean primary key default true check(id),
 host text not null default 'mail.zigzag.am',
 port integer not null default 587 check(port in (465,587)),
 username text not null default E'zz\\Reports-1C',
 secret_id uuid references vault.secrets(id),
 revision uuid not null default gen_random_uuid(),
 updated timestamptz not null default now(),
 updated_by uuid references public.zzws_users(id)
);
insert into public.zzws_mail_transport(id) values(true);
alter table public.zzws_mail_transport enable row level security;
revoke all on public.zzws_mail_transport from public,anon,authenticated;
grant select on public.zzws_mail_transport to service_role;
create policy service_read on public.zzws_mail_transport for select to service_role using(true);

-- These functions need Vault access, which is intentionally not granted to API users.
-- Only the server's service_role can execute them; the application actor is checked again.
create function public.zzws_mail_transport_save(p_actor uuid,p_revision uuid,p_settings_revision uuid,p_cc jsonb,p_from text,p_host text,p_port integer,p_username text,p_password text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.zzws_mail_transport;s jsonb;begin
 if not exists(select 1 from public.zzws_users u join public.zzws_admin_scopes a on a.user_id=u.id where u.id=p_actor and u.active and u.profile->>'role'='admin' and a.scope='owner') then raise sqlstate 'PT403';end if;
 if p_host is null or length(p_host)>253 or p_host!~'^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,63}$' or p_port not in (465,587) or p_username is null or length(p_username) not between 1 and 320 or p_username~'[[:cntrl:]]' or p_password is not null and length(p_password) not between 1 and 4096 then raise sqlstate 'PT400';end if;
 if p_from is null or p_from='' then raise sqlstate 'PT400';end if;
 select * into m from public.zzws_mail_transport where id for update;
 if m.revision is distinct from p_revision then raise sqlstate 'PT409';end if;
 if p_password is null and (m.secret_id is null or m.host<>p_host or m.port<>p_port or m.username<>p_username) then raise sqlstate 'PT400' using message='Մուտքագրեք փոստի գաղտնաբառը նոր սերվերի կամ մուտքանվան համար';end if;
 s=public.zzws_email_settings_save(p_actor,p_settings_revision,p_cc,p_from);
 if p_password is not null then
  if m.secret_id is null then m.secret_id=vault.create_secret(p_password,'zzws_mail_transport_password','ZZWS report mailbox password');
  else perform vault.update_secret(m.secret_id,p_password);end if;
 end if;
 update public.zzws_mail_transport set host=p_host,port=p_port,username=p_username,secret_id=m.secret_id,revision=gen_random_uuid(),updated=now(),updated_by=p_actor where id;
 insert into public.zzws_audit(actor,action,detail) values(p_actor,'report_email_settings','Mail connection updated');
 return s;
end $$;
create function public.zzws_mail_transport_get(p_actor uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.zzws_mail_transport;secret text;begin
 if not public.zzws_report_authorized(p_actor) then raise sqlstate 'PT403';end if;
 select * into m from public.zzws_mail_transport where id;
 if m.secret_id is null then return jsonb_build_object('configured',false);end if;
 select decrypted_secret into secret from vault.decrypted_secrets where id=m.secret_id;
 if secret is null then raise sqlstate 'PT500';end if;
 return jsonb_build_object('configured',true,'password',secret);
end $$;
revoke all on function public.zzws_mail_transport_save(uuid,uuid,uuid,jsonb,text,text,integer,text,text),public.zzws_mail_transport_get(uuid) from public,anon,authenticated;
grant execute on function public.zzws_mail_transport_save(uuid,uuid,uuid,jsonb,text,text,integer,text,text),public.zzws_mail_transport_get(uuid) to service_role;
