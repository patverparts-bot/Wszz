(() => {
  const labels={order_submit:['Отправлен заказ','orders'],order_update:['Изменён заказ','orders'],user_data_clear:['Очищены данные пользователя','users'],password_setup:['Установлен пароль','auth'],password_setup_reset:['Возвращён первый вход','users'],bootstrap:['Создан первый администратор','users'],login:['Вошёл в кабинет или каталог','auth'],logout:['Вышел из системы','auth'],login_failed:['Неудачная попытка входа','auth'],user_update:['Изменён пользователь','users'],user_delete:['Удалён пользователь','users'],password_reset:['Сменён пароль','users'],users_import:['Импортированы пользователи','users'],price_preview:['Проверен файл прайса','price'],price_publish:['Опубликован новый прайс','price'],price_rollback:['Восстановлена версия прайса','price'],export:['Скачан персональный прайс','price'],rules_update:['Изменены правила групп','rules']};
  const date=value=>new Intl.DateTimeFormat('ru-RU',{timeZone:'Asia/Yerevan',dateStyle:'short',timeStyle:'medium'}).format(new Date(value));
  const name=user=>user?(user.client&&user.client!==user.login?`${user.client} (${user.login})`:user.login):'Учётная запись, которой больше нет';
  function describe(rows,users,versions){
    const people=new Map(users.map(u=>[u.id,u])),prices=new Map(versions.map(v=>[v.id,v]));
    return rows.map(row=>{
      let info=null;try{info=JSON.parse(row.detail);}catch{}
      if(!info||typeof info!=='object'||Array.isArray(info))info={};
      const [label,group]=labels[row.action]||['Другое действие','other'];
      const actor=info.actor?name(info.actor):row.actor?name(people.get(row.actor)):'Без входа в систему';
      const target=info.target||people.get(row.detail);
      let action=label,description='';
      switch(row.action){
        case 'bootstrap':description='Первоначальная настройка кабинета завершена.';break;
        case 'login':description='Пользователь успешно вошёл в свою учётную запись.';break;
        case 'logout':description='Сессия пользователя завершена.';break;
        case 'login_failed':description='Вход не выполнен: неверные реквизиты или доступ отключён.';break;
        case 'user_update':
          action=info.created?(info.target?.role==='admin'?'Создан администратор':'Создан пользователь'):'Изменён пользователь';
          description=name(target)+(info.created?' · '+(target.active?'Доступ включён':'Доступ выключен'):info.changes?.length?' · '+info.changes.join('; '):' · сохранены настройки учётной записи.');break;
        case 'order_submit':description='Заказ №'+info.number+' получен и ожидает подтверждения.';break;
        case 'order_update':description='Заказ №'+info.number+' · версия '+info.revision+' · '+({new:'Новый',confirmed:'Подтверждён',in_progress:'В работе',completed:'Завершён',rejected:'Отклонён'}[info.status]||info.status);break;
        case 'user_data_clear':description=name(target)+' · '+({all:'Все рабочие данные',cart:'Текущая корзина',savedCarts:'Сохранённые корзины',favorites:'Избранное',history:'История заказов',filters:'Фильтры',preferences:'Настройки вида',draft:'Данные доставки'}[info.section]||'Выбранные данные');break;
        case 'password_setup':description='Пользователь установил свой пароль. Вход только по логину закрыт.';break;
        case 'password_setup_reset':description=name(target)+' · пароль сброшен; следующий вход по логину с обязательной настройкой пароля.';break;
        case 'user_delete':case 'password_reset':description=name(target);break;
        case 'users_import':description='Обработано пользователей: '+(Number.isFinite(Number(row.detail))?Number(row.detail):'см. подробности');break;
        case 'price_preview':description='Файл проверен. Товаров: '+(Number.isFinite(Number(row.detail))?Number(row.detail):'см. подробности')+'. Публикация выполняется отдельно.';break;
        case 'price_publish':case 'price_rollback':case 'export':{
          const version=prices.get(String(row.detail).split(':')[0]);description=version?'Прайс от '+date(version.created*1000):'Архивная версия прайса';break;
        }
        case 'rules_update':description='Обновлены общие правила доступа и подбора цен KP / Dealers.';break;
        default:description='Дополнительные сведения доступны ниже.';
      }
      return {time:date(row.created*1000),actor,action,group,description,raw:{event:row.id,actorId:row.actor,code:row.action,detail:row.detail}};
    });
  }
  window.ZZWS_AUDIT={describe};
})();
