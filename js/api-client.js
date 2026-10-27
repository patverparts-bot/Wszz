(() => {
  const config=window.ZZWS_CONFIG;
  const key='zzws_session_v3';
  // A token is kept for this tab only. It contains no role or customer information.
  // The server rechecks status and permissions on every request.
  async function request(path,options={}){
    const headers=new Headers(options.headers||{});
    headers.set('apikey',config.publishableKey);
    const token=sessionStorage.getItem(key);if(token)headers.set('Authorization','Bearer '+token);
    if(options.body&&!(options.body instanceof FormData))headers.set('Content-Type','application/json');
    let response;try{response=await fetch(new URL(path,config.api),{...options,headers,credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'});}catch{throw new Error('Չհաջողվեց կապվել սերվերի հետ։ Ստուգեք ինտերնետային կապը։');}
    if(response.status===401)sessionStorage.removeItem(key);
    return response;
  }
  async function json(path,options={}){
    const response=await request(path,options);let data;try{data=await response.json();}catch{throw new Error('Սերվերը վերադարձրել է սխալ պատասխան։');}
    if(!response.ok){const error=new Error(data.error||'Հարցման սխալ');error.status=response.status;error.data=data;throw error;}
    if(['login','account/password'].includes(path)&&data.sessionToken){sessionStorage.setItem(key,data.sessionToken);delete data.sessionToken;}
    if(path==='logout')sessionStorage.removeItem(key);
    return data;
  }
  window.ZZWS=Object.freeze({request,json,clearSession:()=>sessionStorage.removeItem(key)});
})();
