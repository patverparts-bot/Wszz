create table if not exists public.zzws_invitations (
 user_id uuid primary key references public.zzws_users(id) on delete cascade,
 hash text not null, expires timestamptz not null, actor uuid references public.zzws_users(id), created timestamptz not null default now()
);
create table if not exists public.zzws_auth_challenges (
 hash text primary key, user_id uuid not null references public.zzws_users(id) on delete cascade,
 payload jsonb not null, attempts integer not null default 0, expires timestamptz not null
);
alter table public.zzws_invitations enable row level security;
alter table public.zzws_auth_challenges enable row level security;
revoke all on public.zzws_invitations,public.zzws_auth_challenges from anon,authenticated;
grant all on public.zzws_invitations,public.zzws_auth_challenges to service_role;
alter table public.zzws_sessions add column if not exists invitation_hash text;
alter table public.zzws_sessions add column if not exists mfa_verified boolean not null default false;
create or replace function public.zzws_take_auth_challenge(p_hash text)
returns jsonb language plpgsql set search_path='' as $$
declare result jsonb;
begin
 update public.zzws_auth_challenges set attempts=attempts+1 where hash=p_hash and expires>now() and attempts<5 returning jsonb_build_object('user_id',user_id,'payload',payload) into result;
 return result;
end $$;
revoke all on function public.zzws_take_auth_challenge(text) from public,anon,authenticated;
grant execute on function public.zzws_take_auth_challenge(text) to service_role;

create policy service_only on public.zzws_invitations for all to service_role using(true) with check(true);
create policy service_only on public.zzws_auth_challenges for all to service_role using(true) with check(true);
