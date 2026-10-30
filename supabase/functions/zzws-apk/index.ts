import {createClient} from 'npm:@supabase/supabase-js@2.95.0';
import {createApkHandler} from './handler.mjs';
const key=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const service=createClient(Deno.env.get('SUPABASE_URL')!,key,{auth:{persistSession:false,autoRefreshToken:false}});
const origins=(Deno.env.get('ZZWS_ALLOWED_ORIGINS')||'https://patverparts-bot.github.io').split(',').map(s=>s.trim()).filter(Boolean);
Deno.serve(createApkHandler({service,origins}));
