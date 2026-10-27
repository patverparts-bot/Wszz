(() => {
  const labels={mfa_enroll:['Երկփուլ պաշտպանությունն ակտիվացված է','auth'],admin_scope_update:['Աշխատակցի իրավունքները փոփոխված են','users'],order_submit:['Պատվերն ուղարկված է','orders'],order_update:['Պատվերը փոփոխված է','orders'],user_data_clear:['Օգտատիրոջ տվյալները մաքրված են','users'],password_setup:['Գաղտնաբառը սահմանված է','auth'],password_setup_reset:['Առաջին մուտքը վերականգնված է','users'],bootstrap:['Առաջին ադմինիստրատորը ստեղծված է','users'],login:['Մուտք է գործել կաբինետ կամ կատալոգ','auth'],logout:['Դուրս է եկել համակարգից','auth'],login_failed:['Մուտքի անհաջող փորձ','auth'],user_update:['Օգտատերը փոփոխված է','users'],user_delete:['Օգտատերը ջնջված է','users'],password_reset:['Գաղտնաբառը փոխված է','users'],users_import:['Օգտատերերը ներմուծված են','users'],price_preview:['Գնացուցակի ֆայլը ստուգված է','price'],price_publish:['Նոր գնացուցակը հրապարակված է','price'],price_rollback:['Գնացուցակի տարբերակը վերականգնված է','price'],export:['Անհատական գնացուցակը ներբեռնված է','price'],rules_update:['Խմբերի կանոնները փոփոխված են','rules']};
  const date=value=>new Intl.DateTimeFormat('hy-AM',{timeZone:'Asia/Yerevan',dateStyle:'short',timeStyle:'medium'}).format(new Date(value));
  const name=user=>user?(user.client&&user.client!==user.login?`${user.client} (${user.login})`:user.login):'Այլևս գոյություն չունեցող հաշիվ';
  function changeText(value){
    const text=String(value),known={'Доступ включён':'Հասանելիությունը միացված է','Доступ выключен':'Հասանելիությունն անջատված է','Изменена роль':'Դերը փոփոխված է','Обновлены контрагенты, адреса или контакты':'Գործընկերները, հասցեները կամ կոնտակտները թարմացված են','Обновлён доступ к брендам и категориям':'Ապրանքանիշերի և կատեգորիաների հասանելիությունը թարմացված է'};
    if(known[text])return known[text];
    if(text.startsWith('Логин: '))return 'Մուտքանուն՝ '+text.slice(7);
    if(text.startsWith('Группа цен: '))return 'Գների խումբ՝ '+text.slice(12);
    return /[А-Яа-яЁё]/.test(text)?'Հաշվի կարգավորումները փոփոխված են':text;
  }
  function describe(rows,users,versions){
    const people=new Map(users.map(u=>[u.id,u])),prices=new Map(versions.map(v=>[v.id,v]));
    return rows.map(row=>{
      let info=null;try{info=JSON.parse(row.detail);}catch{}
      if(!info||typeof info!=='object'||Array.isArray(info))info={};
      const [label,group]=labels[row.action]||['Այլ գործողություն','other'];
      const actor=info.actor?name(info.actor):row.actor?name(people.get(row.actor)):'Առանց համակարգ մուտք գործելու';
      const target=info.target||people.get(row.detail);
      let action=label,description='';
      switch(row.action){
        case 'mfa_enroll':description='Հաշվի մուտքի համար այժմ պահանջվում է նաև նույնականացնող հավելվածի կոդը։';break;
        case 'admin_scope_update':description='Աշխատակցի դերը՝ '+({owner:'Սեփականատեր',manager:'Պատվերների մենեջեր',price:'Գնացուցակի օպերատոր',viewer:'Դիտող'}[info.scope]||'փոփոխված է');break;
        case 'bootstrap':description='Կաբինետի սկզբնական կարգավորումն ավարտված է։';break;
        case 'login':description='Օգտատերը հաջողությամբ մուտք է գործել իր հաշիվ։';break;
        case 'logout':description='Օգտատիրոջ աշխատաշրջանն ավարտված է։';break;
        case 'login_failed':description='Մուտքը չի կատարվել․ տվյալները սխալ են կամ հասանելիությունն անջատված է։';break;
        case 'user_update':
          action=info.created?(info.target?.role==='admin'?'Ստեղծվել է ադմինիստրատոր':'Ստեղծվել է օգտատեր'):'Օգտատերը փոփոխված է';
          description=name(target)+(info.created?' · '+(target.active?'Հասանելիությունը միացված է':'Հասանելիությունն անջատված է'):info.changes?.length?' · '+info.changes.map(changeText).join('; '):' · հաշվի կարգավորումները պահպանված են։');break;
        case 'order_submit':description='Պատվեր №'+info.number+' ստացվել է և սպասում է հաստատման։';break;
        case 'order_update':description='Պատվեր №'+info.number+' · տարբերակ '+info.revision+' · '+({new:'Նոր',confirmed:'Հաստատված',in_progress:'Ընթացքում',completed:'Ավարտված',rejected:'Մերժված'}[info.status]||info.status);break;
        case 'user_data_clear':description=name(target)+' · '+({all:'Բոլոր աշխատանքային տվյալները',cart:'Ընթացիկ զամբյուղ',savedCarts:'Պահպանված զամբյուղներ',favorites:'Ընտրվածներ',history:'Պատվերների պատմություն',filters:'Ֆիլտրեր',preferences:'Տեսքի կարգավորումներ',draft:'Առաքման տվյալներ'}[info.section]||'Ընտրված տվյալները');break;
        case 'password_setup':description='Օգտատերը սահմանել է իր գաղտնաբառը։ Միայն մուտքանունով մուտքն այլևս հասանելի չէ։';break;
        case 'password_setup_reset':description=name(target)+' · գաղտնաբառը վերակայված է․ հաջորդ մուտքը մուտքանունով է՝ գաղտնաբառի պարտադիր սահմանմամբ։';break;
        case 'user_delete':case 'password_reset':description=name(target);break;
        case 'users_import':description='Մշակված օգտատերեր՝ '+(Number.isFinite(Number(row.detail))?Number(row.detail):'տես մանրամասները');break;
        case 'price_preview':description='Ֆայլը ստուգված է։ Ապրանքներ՝ '+(Number.isFinite(Number(row.detail))?Number(row.detail):'տես մանրամասները')+'։ Հրապարակումը կատարվում է առանձին։';break;
        case 'price_publish':case 'price_rollback':case 'export':{
          const version=prices.get(String(row.detail).split(':')[0]);description=version?'Գնացուցակ՝ '+date(version.created*1000):'Գնացուցակի արխիվային տարբերակ';break;
        }
        case 'rules_update':description='KP / Dealers խմբերի հասանելիության և գների ընտրության ընդհանուր կանոնները թարմացված են։';break;
        default:description='Լրացուցիչ տեղեկությունները հասանելի են ստորև։';
      }
      return {time:date(row.created*1000),actor,action,group,description,raw:{event:row.id,actorId:row.actor,code:row.action,detail:row.detail}};
    });
  }
  window.ZZWS_AUDIT={describe};
})();
