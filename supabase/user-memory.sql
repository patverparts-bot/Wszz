create table public.zzws_user_memory(
 user_id uuid primary key references public.zzws_users(id) on delete cascade,
 data jsonb not null default '{}', versions jsonb not null default '{}'
);
create table public.zzws_saved_carts(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.zzws_users(id) on delete cascade,
 title text not null check(length(title) between 1 and 80), cart jsonb not null,
 draft jsonb not null default '{}', saved_at timestamptz not null default now(),
 request_id uuid not null, unique(user_id,request_id)
);
create index zzws_saved_carts_owner on public.zzws_saved_carts(user_id,saved_at,id);
do $$ declare t text;begin
 foreach t in array array['zzws_user_memory','zzws_saved_carts'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public,anon,authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 execute format('create policy service_only on public.%I for all to service_role using(true) with check(true)',t);
 end loop;
end $$;
create function public.zzws_save_memory(p_user uuid,p_section text,p_value jsonb,p_version integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.zzws_user_memory;v integer;
begin
 if p_section not in ('cart','favorites','history','filters','preferences','draft') then raise exception 'Invalid section';end if;
 insert into public.zzws_user_memory(user_id) values(p_user) on conflict do nothing;
 select * into r from public.zzws_user_memory where user_id=p_user for update;
 v=coalesce((r.versions->>p_section)::integer,0);
 if v<>p_version then return jsonb_build_object('conflict',true,'value',r.data->p_section,'version',v);end if;
 update public.zzws_user_memory set data=jsonb_set(data,array[p_section],p_value),versions=jsonb_set(versions,array[p_section],to_jsonb(v+1)) where user_id=p_user;
 return jsonb_build_object('version',v+1);
end $$;
create function public.zzws_save_cart(p_user uuid,p_title text,p_cart jsonb,p_draft jsonb,p_request uuid,p_replace uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare r public.zzws_saved_carts;n integer;was_replaced boolean=false;
begin
 perform 1 from public.zzws_users where id=p_user for update;
 select * into r from public.zzws_saved_carts where user_id=p_user and request_id=p_request;
 if found then return to_jsonb(r);end if;
 select count(*) into n from public.zzws_saved_carts where user_id=p_user;
 if n>=10 then
 select * into r from public.zzws_saved_carts where user_id=p_user order by saved_at,id limit 1;
 if p_replace is distinct from r.id then return jsonb_build_object('limit',true,'oldest',to_jsonb(r));end if;
 delete from public.zzws_saved_carts where id=r.id and user_id=p_user;was_replaced=true;
 end if;
 insert into public.zzws_saved_carts(user_id,title,cart,draft,request_id) values(p_user,p_title,p_cart,p_draft,p_request) returning * into r;
 return to_jsonb(r)||jsonb_build_object('replaced',was_replaced);
end $$;
revoke all on function public.zzws_save_memory(uuid,text,jsonb,integer) from public,anon,authenticated;
revoke all on function public.zzws_save_cart(uuid,text,jsonb,jsonb,uuid,uuid) from public,anon,authenticated;
grant execute on function public.zzws_save_memory(uuid,text,jsonb,integer) to service_role;
grant execute on function public.zzws_save_cart(uuid,text,jsonb,jsonb,uuid,uuid) to service_role;
