-- All returned values must be false for public browser roles.
select tablename,
 has_table_privilege('anon','public.'||tablename,'select') as anon_can_read,
 has_table_privilege('authenticated','public.'||tablename,'select') as auth_can_read,
 has_table_privilege('anon','public.'||tablename,'insert') as anon_can_write,
 has_table_privilege('authenticated','public.'||tablename,'update') as auth_can_write
from pg_tables where schemaname='public' and tablename like 'zzws_%';

select routine_name, grantee from information_schema.routine_privileges
where routine_schema='public' and routine_name like 'zzws_%'
and grantee in ('PUBLIC','anon','authenticated');
