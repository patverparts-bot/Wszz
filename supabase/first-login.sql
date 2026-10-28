-- Existing accounts that have already signed in keep their credentials.
alter table public.zzws_users add column needs_password_setup boolean not null default true;
alter table public.zzws_users add column password_setup_claim text;
alter table public.zzws_sessions add column setup_only boolean not null default false;
update public.zzws_users u set needs_password_setup=false
where exists(select 1 from public.zzws_audit a where a.actor=u.id and a.action in ('login','bootstrap'));
