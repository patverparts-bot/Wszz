create table if not exists public.zzws_admin_scopes(user_id uuid primary key references public.zzws_users(id) on delete cascade,scope text not null check(scope in ('owner','manager','price','viewer')));
alter table public.zzws_admin_scopes enable row level security;
revoke all on public.zzws_admin_scopes from anon,authenticated;
grant all on public.zzws_admin_scopes to service_role;

create policy service_only on public.zzws_admin_scopes for all to service_role using(true) with check(true);
