(() => {
  const config=window.ZZWS_CONFIG;
  const key='zzws_session_v3';
  const responseSessions=new WeakMap();
  function upload(url,headers,options){return new Promise((resolve,reject)=>{
    const xhr=new XMLHttpRequest();xhr.open(options.method||'POST',url);xhr.timeout=options.timeoutMs||120000;
    headers.forEach((value,name)=>xhr.setRequestHeader(name,value));
    xhr.upload.onprogress=event=>options.onUploadProgress({loaded:event.loaded,total:event.lengthComputable?event.total:0});
    xhr.onload=()=>{if(!xhr.status){reject(new Error('Չհաջողվեց կապվել սերվերի հետ։'));return;}resolve(new Response(xhr.responseText,{status:xhr.status,headers:{'Content-Type':'application/json'}}));};
    const failed=message=>reject(Object.assign(new Error(message),{uploadUncertain:true}));
    xhr.onerror=()=>failed('Կապն ընդհատվել է։ Ստուգվում է հրապարակման արդյունքը։');
    xhr.ontimeout=()=>failed('Սպասման ժամանակն ավարտվել է։ Ստուգվում է հրապարակման արդյունքը։');
    xhr.onabort=()=>failed('Բեռնումն ընդհատվել է։');
    xhr.send(options.body);
  });}
  function staleSession(){const error=new Error('Հարցումն ավարտվել է նախկին աշխատաշրջանում։ Կրկին փորձեք։');error.status=409;error.staleSession=true;return error;}
  // A token is kept for this tab only. It contains no role or customer information.
  // The server rechecks status and permissions on every request.
  async function request(path,options={}){
    const headers=new Headers(options.headers||{});
    headers.set('apikey',config.publishableKey);
    const token=sessionStorage.getItem(key);if(token)headers.set('Authorization','Bearer '+token);
    if(options.body&&!(options.body instanceof FormData)&&!headers.has('Content-Type'))headers.set('Content-Type','application/json');
    let response;try{const url=new URL(path,config.api);response=options.onUploadProgress?await upload(url,headers,options):await fetch(url,{...options,signal:options.timeoutMs?AbortSignal.timeout(options.timeoutMs):options.signal,headers,credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'});}catch(error){if(sessionStorage.getItem(key)!==token)throw staleSession();if(error.uploadUncertain)throw error;throw new Error('Չհաջողվեց կապվել սերվերի հետ։ Ստուգեք ինտերնետային կապը և կրկին փորձեք։');}
    if(sessionStorage.getItem(key)!==token)throw staleSession();
    if(response.status===401)sessionStorage.removeItem(key);
    responseSessions.set(response,sessionStorage.getItem(key));
    return response;
  }
  async function json(path,options={},retried=false){
    const response=await request(path,options);let data;try{data=await response.json();}catch{throw new Error('Սերվերը վերադարձրել է սխալ պատասխան։');}
    if(sessionStorage.getItem(key)!==responseSessions.get(response))throw staleSession();
    if(response.status===428&&data.reauthRequired&&!retried&&window.requireReauthentication){await window.requireReauthentication();return json(path,options,true);}
    if(!response.ok){const missing=response.status===404&&data.error==='Չի գտնվել'&&/^(admin\/orders\/(customers|customer-|create|report-)|admin\/users\/channels|admin\/email-settings|admin\/offers|orders\/quote|catalog\/contract)/.test(path);const error=new Error(missing?'Այս հնարավորությունը դեռ հասանելի չէ գործող սերվերում։ Անհրաժեշտ է ZZWS սերվերի համաձայնեցված թարմացում։':data.error||'Հարցման սխալ');error.status=response.status;error.data=data;throw error;}
    if(['login','login/mfa','account/password'].includes(path)&&data.sessionToken){sessionStorage.setItem(key,data.sessionToken);delete data.sessionToken;}
    if(path==='logout')sessionStorage.removeItem(key);
    return data;
  }
  window.ZZWS=Object.freeze({request,json,message:error=>typeof error?.message==='string'&&/[\u0531-\u058f]/u.test(error.message)?error.message:'Գործողությունը չի կատարվել։ Կրկին փորձեք։',clearSession:()=>sessionStorage.removeItem(key)});
})();
