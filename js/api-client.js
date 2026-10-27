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
    const response=await fetch(new URL(path,config.api),{...options,headers,credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'});
    if(response.status===401)sessionStorage.removeItem(key);
    return response;
  }
  async function json(path,options={}){
    const response=await request(path,options),data=await response.json();
    if(!response.ok){const error=new Error(data.error||'Ошибка запроса');error.status=response.status;error.data=data;throw error;}
    if(['login','account/password'].includes(path)&&data.sessionToken){sessionStorage.setItem(key,data.sessionToken);delete data.sessionToken;}
    if(path==='logout')sessionStorage.removeItem(key);
    return data;
  }
  window.ZZWS=Object.freeze({request,json,clearSession:()=>sessionStorage.removeItem(key)});
})();
