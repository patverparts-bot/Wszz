(() => {
 const el=id=>document.getElementById(id);
 const labels={frontend:'Կայքի էջը հասանելի է',api:'API-ն հասանելի է',auth:'Չարտոնված կատալոգի հարցումը մերժվում է',backupAge:'Պահուստային պատճենը մինչև 30 ժամ հնության է',backupIntegrity:'Գաղտնագրված պատճենը վերծանվում և ստուգվում է',restoreRehearsal:'Տվյալները վերականգնվում են մեկուսացված փորձնական բազայում',scheduler:'Պահուստավորման ժամանակացույցն ակտիվ է'};
 let epoch=0;
 async function load(summaryOnly=false){
  const ticket=epoch,data=await api('admin/operations');if(ticket!==epoch)return;
  const text=({ok:'Վերջին ստուգումը հաջող է։',attention:'Կան ստուգման խնդիրներ։',stale:'Ստուգման հաշվետվությունը հնացել է։',unknown:'Ստուգման հաշվետվություն դեռ չկա։'})[data.status]||'Ստուգման վիճակն անհայտ է։';
  el('backupHelp').textContent=text+' Բացեք «Աշխատունակություն» բաժինը։';if(summaryOnly)return;
  el('operationsStatus').textContent=text+(data.report?.checkedAt?' '+new Date(data.report.checkedAt).toLocaleString('hy-AM',{timeZone:'Asia/Yerevan'}):'');
  el('operationsChecks').replaceChildren(table(['Ստուգում','Արդյունք'],(data.report?.checks||[]).map(c=>[labels[c.id]||c.id,data.stale?'Հնացած տվյալներ':c.ok?'Հաջող':'Ստուգել'])));
 }
 el('operationsRefresh').onclick=()=>run(()=>load());
 window.ZZWS_ADMIN_OPERATIONS={load,reset(){epoch++;el('operationsStatus').textContent='';el('operationsChecks').replaceChildren();}};
})();
