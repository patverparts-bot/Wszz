import {email} from './report-email.mjs';
export function senderAddress(settings,env,{invitation=false}={}){
 const fallback=(invitation?env('ZZWS_INVITATION_FROM'):null)||env('ZZWS_REPORT_FROM')||'';
 const chosen=settings?.from_email||fallback,from=email(chosen);
 const addresses=(env('ZZWS_EMAIL_ALLOWED_FROM_ADDRESSES')||'').split(',').map(s=>s.trim()).filter(Boolean).map(s=>email(s));
 if(addresses.length){if(!addresses.includes(from))throw Error('Նշեք միացված փոստային հաշվի հասցեն։ Այլ հասցեի համար նախ միացրեք համապատասխան հաշիվը։');return from;}
 const domains=(env('ZZWS_EMAIL_ALLOWED_FROM_DOMAINS')||fallback.split('@')[1]||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
 if(!domains.includes(from.split('@')[1]))throw Error('Ուղարկողի տիրույթը թույլատրված չէ։ Այն պետք է հաստատված լինի փոստային ծառայությունում։');
 return from;
}

