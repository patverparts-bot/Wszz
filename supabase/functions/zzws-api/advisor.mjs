import {matchDimensions,dimensionMode} from './size-matching.mjs';
// Conversational selection runs locally: no model, API key or paid service is required.
const norm = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const categories = {
  washer: /стирал|լվացք|washing machine|\bwasher\b/i,
  dishwasher: /посудомо|սպասք լվաց|dishwasher/i,
  dryer: /сушильн|չորանոց|tumble dryer|\bdryer\b/i,
  fridge: /холодильник|սառնարան|refrigerator|fridge/i,
  tv: /телевизор|հեռուստացույց|television|\btv\b/i,
  vacuum: /пылесос|փոշեկուլ|vacuum/i,
  coffee: /кофемашин|кофевар|սրճեփ|coffee machine|coffee maker/i,
  laptop: /ноутбук|նոթբուք|laptop|notebook/i,
  microwave: /микроволн|միկրոալիք|microwave/i,
  kettle: /чайник|թեյնիկ|kettle/i,
  iron: /утюг|արդուկ|\biron\b/i
};
const axes = {width: /ширин|шире|width|լայնու/i, depth: /глубин|глубже|depth|խորու/i, height: /высот|выше|height|բարձրու/i};
const pendingValues = ['category','dimension','dimensionValue','budget','currency','relax'];
const labels = {
  ru: {category:'Какую технику подбираем?',dimension:'60 см — это максимальная ширина или глубина?'.replace('60','{n}'),dimensionValue:'Какой максимальный размер в сантиметрах?',budget:'Какой максимальный бюджет в драмах? Можно написать, например, «до 200 тысяч» или выбрать самые доступные варианты.',currency:'Укажите бюджет в армянских драмах (֏), чтобы сравнить его с ценами каталога.',low:'Самые доступные',width:'Ширина',depth:'Глубина',height:'Высота',washer:'Стиральная машина',dishwasher:'Посудомоечная машина',dryer:'Сушильная машина',fridge:'Холодильник',tv:'Телевизор',vacuum:'Пылесос',coffee:'Кофемашина',laptop:'Ноутбук',microwave:'Микроволновка',kettle:'Чайник',iron:'Утюг',found:'Нашёл подходящие варианты. Цены взяты из вашего текущего каталога, характеристики — с zigzag.am.',none:'По этим условиям подтверждённых вариантов в вашем каталоге не нашлось. Какое условие готовы изменить? Я сохраню остальные пожелания.',empty:'В вашем доступном каталоге сейчас нет подходящей категории. Какую другую технику поискать?',unknown:'Товары с неподтверждёнными параметрами не включены в подборку.',budgetChange:'Изменить бюджет',sizeChange:'Изменить размер',loadChange:'Изменить загрузку',brandChange:'Другой бренд',featureChange:'Изменить требования к функциям',features:'Уточните, нужна ли сушка и обязателен ли инверторный двигатель.',more:'Напишите, что изменить: бюджет, размер, загрузку, бренд или функции.',summary:'Ваши условия',budgetLabel:'Бюджет до',widthLabel:'Ширина до',depthLabel:'Глубина до',heightLabel:'Высота до',loadLabel:'Загрузка',loadMin:'Загрузка от',cheap:'Сначала дешевле',noLimit:'Без ограничения бюджета',brand:'Бренд',withDryer:'С сушкой',noDryer:'Без сушки',inverter:'Инверторный двигатель',cm:'см',kg:'кг',priceUnknown:'Не удалось подтвердить цену подходящих товаров. Уточните цену у менеджера.'},
  hy: {category:'Ի՞նչ տեխնիկա եք փնտրում։',dimension:'{n} սմ-ը առավելագույն լայնությո՞ւնն է, թե՞ խորությունը։',dimensionValue:'Որքա՞ն է առավելագույն չափը սանտիմետրերով։',budget:'Որքա՞ն է առավելագույն բյուջեն դրամով։ Օրինակ՝ «մինչև 200 հազար», կամ ընտրեք ամենամատչելիները։',currency:'Նշեք բյուջեն հայկական դրամով (֏)։',low:'Ամենամատչելիները',width:'Լայնություն',depth:'Խորություն',height:'Բարձրություն',washer:'Լվացքի մեքենա',dishwasher:'Սպասք լվացող մեքենա',dryer:'Չորանոց',fridge:'Սառնարան',tv:'Հեռուստացույց',vacuum:'Փոշեկուլ',coffee:'Սրճեփ',laptop:'Նոթբուք',microwave:'Միկրոալիքային վառարան',kettle:'Թեյնիկ',iron:'Արդուկ',found:'Գտա համապատասխան տարբերակներ։ Գները՝ ձեր ընթացիկ կատալոգից, բնութագրերը՝ zigzag.am-ից։',none:'Այս պայմաններով ձեր կատալոգում հաստատված տարբերակներ չգտնվեցին։ Ո՞ր պայմանը կփոխեք։ Մյուս ցանկությունները կպահպանեմ։',empty:'Ձեր հասանելի կատալոգում այս կատեգորիան հիմա չկա։ Ի՞նչ այլ տեխնիկա փնտրեմ։',unknown:'Չհաստատված պարամետրերով ապրանքները չեն ներառվել։',budgetChange:'Փոխել բյուջեն',sizeChange:'Փոխել չափը',loadChange:'Փոխել տարողությունը',brandChange:'Այլ բրենդ',featureChange:'Փոխել գործառույթները',features:'Նշեք՝ պե՞տք է չորացում, և պարտադի՞ր է ինվերտորային շարժիչը։',more:'Նշեք՝ ինչ փոխել՝ բյուջե, չափ, տարողություն, բրենդ կամ գործառույթներ։',summary:'Ձեր պայմանները',budgetLabel:'Բյուջե՝ մինչև',widthLabel:'Լայնություն՝ մինչև',depthLabel:'Խորություն՝ մինչև',heightLabel:'Բարձրություն՝ մինչև',loadLabel:'Տարողություն',loadMin:'Տարողություն՝ սկսած',cheap:'Սկզբում մատչելիները',noLimit:'Առանց բյուջեի սահմանափակման',brand:'Բրենդ',withDryer:'Չորացումով',noDryer:'Առանց չորացման',inverter:'Ինվերտորային շարժիչ',cm:'սմ',kg:'կգ',priceUnknown:'Համապատասխան ապրանքների գինը հաստատված չէ։ Ճշտեք մենեջերի հետ։'},
  en: {category:'What kind of appliance are you looking for?',dimension:'Is {n} cm the maximum width or depth?',dimensionValue:'What is the maximum size in centimetres?',budget:'What is your maximum budget in Armenian drams? For example, “up to 200 thousand”, or choose the lowest-priced options.',currency:'Please give your budget in Armenian drams (֏).',low:'Lowest-priced options',width:'Width',depth:'Depth',height:'Height',washer:'Washing machine',dishwasher:'Dishwasher',dryer:'Tumble dryer',fridge:'Fridge',tv:'TV',vacuum:'Vacuum cleaner',coffee:'Coffee machine',laptop:'Laptop',microwave:'Microwave',kettle:'Kettle',iron:'Iron',found:'Here are matching options. Prices are from your current catalogue; specifications are from zigzag.am.',none:'No verified options in your catalogue meet these requirements. Which requirement would you like to change? I will keep the others.',empty:'That category is not currently in your accessible catalogue. What other appliance should I look for?',unknown:'Products with unconfirmed required specifications were excluded.',budgetChange:'Change budget',sizeChange:'Change size',loadChange:'Change capacity',brandChange:'Another brand',featureChange:'Change feature requirements',features:'Please specify whether drying and an inverter motor are required.',more:'Tell me what to change: budget, size, capacity, brand or features.',summary:'Your requirements',budgetLabel:'Budget up to',widthLabel:'Width up to',depthLabel:'Depth up to',heightLabel:'Height up to',loadLabel:'Capacity',loadMin:'Capacity at least',cheap:'Lowest price first',noLimit:'No budget limit',brand:'Brand',withDryer:'With drying',noDryer:'Without drying',inverter:'Inverter motor',cm:'cm',kg:'kg',priceUnknown:'Matching product prices are unconfirmed. Please check with your manager.'}
};
Object.assign(labels.ru,{dimension:'{n} см — это ширина, глубина или высота?',dimensionValue:'Укажите размер в сантиметрах. Если это предел для ниши, напишите «не больше».',widthTarget:'Ширина',depthTarget:'Глубина',heightTarget:'Высота',near:'Сначала показаны точные размеры, затем близкие варианты с указанными отличиями. Проверьте размеры перед выбором.',found:'Подобрал варианты по вашим условиям. Характеристики — с zigzag.am, цены — из вашего каталога.'});
Object.assign(labels.hy,{dimension:'{n} սմ-ը լայնությո՞ւնն է, խորությո՞ւնը, թե՞ բարձրությունը։',dimensionValue:'Նշեք չափը սանտիմետրերով։ Եթե այն խորշի սահմանափակում է, գրեք «ոչ ավելի»։',widthTarget:'Լայնություն',depthTarget:'Խորություն',heightTarget:'Բարձրություն',near:'Սկզբում ճշգրիտ չափերով տարբերակներն են, ապա՝ մոտ չափերով՝ տարբերությունների նշումով։ Ընտրելուց առաջ ստուգեք չափերը։',found:'Ընտրեցի ձեր պայմաններին համապատասխան տարբերակներ։ Բնութագրերը՝ zigzag.am-ից, գները՝ ձեր կատալոգից։'});
Object.assign(labels.en,{dimension:'Is {n} cm the width, depth or height?',dimensionValue:'Enter the size in cm. If this is a hard space limit, say “no more than”.',widthTarget:'Width',depthTarget:'Depth',heightTarget:'Height',near:'Exact sizes appear first, followed by nearby sizes with explicit differences. Check dimensions before choosing.',found:'Here are options for your requirements. Specifications are from zigzag.am; prices are from your catalogue.'});

export function validateAdvisor(value) {
  if (value == null) return null;
  const invalid = () => {throw Object.assign(Error('Ընտրության պայմանները սխալ են։ Սկսեք նոր զրույց։'),{code:400});};
  if (typeof value !== 'object' || Array.isArray(value)) invalid();
  const result = {};
  for (const name of ['category','language','pending','dimensionAxis','brand','dimensionMode','widthMode','depthMode','heightMode']) if (value[name] != null) {
    if (typeof value[name] !== 'string' || value[name].length > 100) invalid(); result[name] = value[name];
  }
  if (result.category && !Object.hasOwn(categories,result.category)) invalid();
  if (result.language && !Object.hasOwn(labels,result.language)) invalid();
  if (result.pending && !pendingValues.includes(result.pending)) invalid();
  if (result.dimensionAxis && !Object.hasOwn(axes,result.dimensionAxis)) invalid();
  for(const name of ['dimensionMode','widthMode','depthMode','heightMode'])if(result[name]&&!['target','max','min','exact'].includes(result[name]))invalid();
  for (const name of ['budgetMax','width','depth','height','dimensionValue','capacity']) if (value[name] != null) {
    const max = name === 'budgetMax' ? 1e9 : name === 'capacity' ? 100 : 1000;
    if (typeof value[name] !== 'number' || !Number.isFinite(value[name]) || value[name] <= 0 || value[name] > max) invalid(); result[name] = value[name];
  }
  for (const name of ['cheap','budgetSkipped','capacityMin','drying','inverter']) if (value[name] != null) {
    if (typeof value[name] !== 'boolean') invalid(); result[name] = value[name];
  }
  return result;
}

const numeric = text => Number(String(text).replace(/[ \u00a0]/g,'').replace(',','.'));
const numberPattern = '(\\d+(?:[ \\u00a0]\\d{3})*(?:[.,]\\d+)?)';
const sizeUnits = '(см|сантиметр\\p{L}*|cm|centimet(?:er|re)s?|սմ|սանտիմետր|мм|миллиметр\\p{L}*|mm|մմ)';
const langOf = (message, prior) => /[а-яё]/i.test(message) ? 'ru' : /[\u0531-\u058f]/u.test(message) ? 'hy' : /[a-z]/i.test(message) ? 'en' : prior || 'ru';
const detectCategory = message => Object.entries(categories).find(([,pattern])=>pattern.test(message))?.[0];
function readSizeMode(text,start,matched){
  const prefix=text.slice(Math.max(0,start-30),start),scope=matched+' '+prefix;
  if(/ниш|про[её]м|встраива|built.?in|ներկառուցվող|fits? (?:in|into)|opening|տեղավորվ|խորշ/i.test(text))return 'max';
  if(/не\s*$/u.test(prefix)&&/^(?:шире|выше|глубже)/iu.test(matched))return 'max';
  if(/строго|точно|exactly|ճշգրիտ/i.test(scope))return 'exact';
  if(/\b(?:max(?:imum)?|up to)\b|не (?:больше|более|шире|выше|глубже)|ոչ ավելի|առավելագույն|մինչև|(?:^|\s)до(?:\s|\d)/iu.test(matched)||/(?:до|не больше|не более|не шире|не выше|не глубже|up to|no more than|մինչև|ոչ ավելի)\s*$/iu.test(prefix))return 'max';
  if(/at least|не меньше|не менее|առնվազն|(?:^|\s)от(?:\s|\d)/i.test(scope)||/(?:от)\s*$/u.test(prefix))return 'min';
  return 'target';
}

function parseRequirements(message, prior, visibleProducts, responseLanguage) {
  const category = detectCategory(message);
  const state = category && category !== prior?.category ? {} : {...prior};
  state.language = responseLanguage || langOf(message,state.language); if (category) state.category = category;
  const text = message.toLowerCase(), oldPending = state.pending; delete state.pending;
  if (/недорог|дешев|бюджетн|cheap|affordable|lowest.priced|մատչելի|էժան/i.test(text)) state.cheap = true;
  if (/без ограничени.*бюджет|без бюджета|no budget limit|առանց բյուջեի/i.test(text) || text.trim() === labels[state.language].low.toLowerCase()) {state.budgetSkipped=true;state.cheap=true;delete state.budgetMax;}
  let currencyError = false;
  for (const match of text.matchAll(new RegExp(numberPattern+'\\s*(тыс(?:яч[аиу]?)?|thousand|k|հազ(?:ար)?|млн|million|մլն)?\\s*(драм(?:ов|а)?|֏|amd|դրամ|руб(?:лей)?|₽|usd|eur|[$€])?','giu'))) {
    const before=text.slice(Math.max(0,match.index-28),match.index), after=text.slice(match.index+match[0].length,match.index+match[0].length+14);
    if (/^\s*(?:см|сантиметр|cm|սմ|mm|мм|մմ|кг|kg|կգ)/i.test(after)) continue;
    const amount=numeric(match[1])*(/млн|million|մլն/i.test(match[2]||'')?1e6:match[2]?1000:1);
    if (match[2] || match[3] || /бюджет|до\s*$|budget|up to\s*$|մինչև\s*$/i.test(before) || oldPending==='budget' || oldPending==='currency') {
      if (/руб|₽|usd|eur|[$€]/i.test(match[3]||'') || /[$€]\s*$/.test(before)) {currencyError=true;continue;}
      if (amount>0 && amount<=1e9) {state.budgetMax=amount;delete state.budgetSkipped;}
    }
  }
  if (/[$€₽]|\b(?:usd|eur)\b|рубл|доллар|евро|dollars?|euros?|դոլար|եվրո/i.test(text)) currencyError=true;
  let sized = false;
  for (const [axis,pattern] of Object.entries(axes)) {
    const named = new RegExp('(?:'+pattern.source+')\\p{L}*[^\\d]{0,14}'+numberPattern+'\\s*'+sizeUnits+'?','iu').exec(text);
    const reversed = new RegExp(numberPattern+'\\s*'+sizeUnits+'\\s*(?:по|в|in|of)?\\s*(?:'+pattern.source+')','iu').exec(text);
    const match=named||reversed;
    if (match) {const amount=numeric(match[1])*(/мм|mm|մմ|миллиметр/i.test(match[2]||'')?.1:1);if(amount>0&&amount<=1000){state[axis]=amount;state[axis+'Mode']=readSizeMode(text,match.index,match[0]);sized=true;delete state.dimensionValue;delete state.dimensionAxis;delete state.dimensionMode;}}
    else if (pattern.test(text)) {
      if (state.dimensionValue) {state[axis]=state.dimensionValue;state[axis+'Mode']=state.dimensionMode||'target';delete state.dimensionValue;delete state.dimensionMode;sized=true;}
      else if (!state[axis] || oldPending==='dimension') state.dimensionAxis=axis;
    }
  }
  const size = new RegExp(numberPattern+'\\s*'+sizeUnits+'(?!\\p{L})','iu').exec(text);
  if (size && !sized) {const amount=numeric(size[1])*(/мм|mm|մմ|миллиметр/i.test(size[2])?.1:1);if(amount>0&&amount<=1000){const mode=readSizeMode(text,size.index,size[0]);if(state.dimensionAxis){state[state.dimensionAxis]=amount;state[state.dimensionAxis+'Mode']=mode;delete state.dimensionAxis;}else{state.dimensionValue=amount;state.dimensionMode=mode;}}}
  if (oldPending==='dimensionValue' && !size && /^\s*\d+(?:[.,]\d+)?\s*$/.test(text)) {const amount=numeric(text);if(amount>0&&amount<=1000&&state.dimensionAxis){state[state.dimensionAxis]=amount;state[state.dimensionAxis+'Mode']='target';delete state.dimensionAxis;}}
  const load=/(?:от\s*|at least\s*)?(\d+(?:[.,]\d+)?)\s*(?:кг|килограмм\p{L}*|kg|կգ)/iu.exec(text);
  if(load){const amount=numeric(load[1]);if(amount>0&&amount<=100){state.capacity=amount;state.capacityMin=/от|at least/i.test(load[0]);}}
  if (/без суш|without dry|առանց չոր/i.test(text)) state.drying=false;
  else if (/с суш|with dry|չորացումով/i.test(text)) state.drying=true;
  if (/без инвертор|inverter not required|ինվերտոր.*պարտադիր չէ/i.test(text)) delete state.inverter;
  else if (/инвертор|inverter|ինվերտոր/i.test(text)) state.inverter=true;
  const brands=[...new Set([...visibleProducts.map(p=>p.brand), 'Bosch','Samsung','LG','Haier','Beko','Indesit','Electrolux','Miele','Hisense','Gorenje','Candy','Whirlpool'])].filter(Boolean);
  const brand=brands.find(b=>(' '+norm(text)+' ').includes(' '+norm(b)+' '));
  if(brand)state.brand=brand;
  if(/любой бренд|без предпочтений по бренду|any brand|ցանկացած բրենդ/i.test(text))delete state.brand;
  return {state,currencyError};
}

export function dimensions(specifications) {
  const result={};
  for(const {name,value} of specifications){
    const unit=String(name)+' '+String(value), scale=/(?:\bmm\b|мм|մմ)/i.test(unit)?.1:/(?:\bcm\b|см|սմ)/i.test(unit)?1:null;
    if(!scale)continue;
    const nums=String(value).replace(/,/g,'.').match(/\d+(?:\.\d+)?/g)?.map(Number)||[];
    for(const [axis,pattern] of Object.entries(axes))if(pattern.test(name)&&nums.length===1)result[axis]=nums[0]*scale;
    const order=String(name).toLowerCase().replace(/[\s()]/g,'');
    const ordered=order.match(/(?:dimensions|размеры)?([hwd])(?:x|×|х)([hwd])(?:x|×|х)([hwd])/);
    if(ordered&&new Set(ordered.slice(1)).size===3&&nums.length===3)ordered.slice(1).forEach((axis,i)=>result[{h:'height',w:'width',d:'depth'}[axis]]=nums[i]*scale);
  }
  return result;
}

const quantity = (specs,pattern) => {const value=specs.find(s=>pattern.test(s.name))?.value;if(value==null)return null;const parsed=Number(String(value).replace(',','.').match(/\d+(?:\.\d+)?/)?.[0]);return Number.isFinite(parsed)?parsed:null;};
const customerPrice = (p,mode) => {
  const price=mode==='KP'?p.kpPrice:p.wholesale;
  return typeof price==='number'&&Number.isFinite(price)&&price>0 ? {amount:price,kind:'customer',currency:'AMD'} : typeof p.retail==='number'&&Number.isFinite(p.retail)&&p.retail>0 ? {amount:p.retail,kind:'retail',currency:'AMD'} : null;
};
const categoryMatches = (p,category) => {
  const name=p.category||'';
  if(/параг|պարագա|аксессуар|accessor|cleaning product|մաքրող նյութ/i.test(name))return false;
  return categories[category].test(name);
};

export function requirementSummary(state) {
  const t=labels[state.language||'ru'],parts=[];
  if(state.category)parts.push(t[state.category]);
  if(state.budgetMax)parts.push(t.budgetLabel+' '+state.budgetMax.toLocaleString('en-US')+' ֏');
  if(state.cheap)parts.push(t.cheap);
  for(const axis of Object.keys(axes))if(state[axis])parts.push(t[axis+(dimensionMode(state,axis)==='max'?'Label':'Target')]+' '+(dimensionMode(state,axis)==='min'?'≥ ':dimensionMode(state,axis)==='exact'?'= ':'')+state[axis]+' '+t.cm);
  if(state.capacity)parts.push(t[state.capacityMin?'loadMin':'loadLabel']+' '+state.capacity+' '+t.kg);
  if(state.brand)parts.push(t.brand+': '+state.brand);
  if(state.drying!==undefined)parts.push(t[state.drying?'withDryer':'noDryer']);
  if(state.inverter)parts.push(t.inverter);
  return parts.join(' · ');
}

export function advise(message, prior, visibleProducts, verifiedProduct, responseLanguage, orderPriceMode='WS', publicProducts=[]) {
  const isRequest=/нуж|подбер|ищу|посовет|хочу|need|looking for|recommend|want|փնտր|ուզում|պետք/i.test(message);
  if(!prior&&!detectCategory(message)&&!isRequest)return null;
  const {state,currencyError}=parseRequirements(message,prior,[...visibleProducts,...publicProducts],responseLanguage),t=labels[state.language];
  const reply=(answer,pending=null,replies=[],recommendations=[],publicRecommendations=[])=>{
    if(pending)state.pending=pending;
    return {name:'ԶիգԶագ',answer,mode:'selection',modelUnavailable:false,products:[],choices:[],context:[],advisor:state,requirementSummary:requirementSummary(state),quickReplies:replies,recommendations,publicRecommendations};
  };
  if(!state.category)return reply(t.category,'category',['washer','fridge','dishwasher','tv','vacuum'].map(k=>t[k]));
  if(currencyError)return reply(t.currency,'currency');
  if(state.dimensionValue)return reply(t.dimension.replace('{n}',state.dimensionValue),'dimension',[t.width,t.depth,t.height]);
  if(state.dimensionAxis)return reply(t.dimensionValue,'dimensionValue');
  if(new RegExp('^'+t.budgetChange+'$','i').test(message.trim()))return reply(t.budget,'budget',[t.noLimit]);
  if(message.trim()===t.sizeChange)return reply(state.language==='ru'?'Какой размер изменить: ширину, глубину или высоту?':state.language==='hy'?'Ո՞ր չափը փոխել՝ լայնությունը, խորությունը, թե՞ բարձրությունը։':'Which size should change: width, depth or height?','dimension',[t.width,t.depth,t.height]);
  if(message.trim()===t.loadChange)return reply(state.language==='ru'?'Какая загрузка нужна в килограммах?':state.language==='hy'?'Քանի՞ կգ տարողություն է պետք։':'What capacity do you need in kg?','relax');
  if(message.trim()===t.brandChange)return reply(state.language==='ru'?'Какой бренд предпочитаете? Можно написать «любой бренд».':state.language==='hy'?'Ո՞ր բրենդն եք նախընտրում։ Կարող եք նշել «ցանկացած բրենդ»։':'Which brand do you prefer? You can say “any brand”.','relax');
  if(message.trim()===t.featureChange)return reply(t.features,'relax');
  if(state.cheap&&!state.budgetMax&&!state.budgetSkipped)return reply(t.budget,'budget',[t.low]);
  const categoryProducts=[...visibleProducts,...publicProducts].filter(p=>categoryMatches(p,state.category));
  if(!categoryProducts.length)return reply(t.empty,'category',['washer','fridge','dishwasher','tv','vacuum'].filter(k=>k!==state.category).map(k=>t[k]));
  const matches=[],publicMatches=[];let uncertain=0,unpriced=0;
  for(const p of categoryProducts){
    if(state.brand&&norm(p.brand)!==norm(state.brand))continue;
    const product=verifiedProduct(p);
    if(product.status!=='verified'){uncertain++;continue;}
    const specs=product.specifications,dims=dimensions(specs),load=quantity(specs,/load capacity|capacity.*kg|загрузка|տարողություն.*կգ/i);
    const sizeMatch=matchDimensions(state,dims);if(!sizeMatch.accepted&&!sizeMatch.unconfirmed)continue;
    if(state.capacity&&load!=null&&(state.capacityMin?load<state.capacity:Math.abs(load-state.capacity)>.001))continue;
    let missing=!!sizeMatch.unconfirmed||!!(state.capacity&&load==null);
    if(state.drying!==undefined){const dryer=/չորանոցներով|с суш|washer.dryer/i.test(p.category);const drying=specs.find(s=>/drying|сушка|չորացում/i.test(s.name));if(dryer){if(!state.drying)continue;}else if(state.category==='washer'&&!state.drying){}else if(drying){const yes=/yes|да|այո|\d/i.test(drying.value)&&!/no|нет|ոչ|^0(?:\D|$)/i.test(drying.value);if(yes!==state.drying)continue;}else missing=true;}
    if(state.inverter){const motor=specs.find(s=>/motor type|мotor type|двигатель|շարժիչ/i.test(s.name));if(!motor)missing=true;else if(!/inverter|инвертор|ինվերտոր/i.test(motor.value))continue;}
    if(missing){uncertain++;continue;}
    if(p.catalogScope==='public'){
      publicMatches.push({...product,catalogScope:'public',orderability:{status:'manager',reason:'outside_catalog'},budgetStatus:state.budgetMax?'unconfirmed':'unspecified',matchedDimensions:dims,match:{kind:sizeMatch.kind,distance:sizeMatch.distance,deviations:sizeMatch.deviations}});
      continue; // No private prices/stock; an unknown price never confirms a budget.
    }
    const price=customerPrice(p,orderPriceMode);if(!price){unpriced++;continue;}
    if(state.budgetMax&&price.amount>state.budgetMax)continue;
    matches.push({...product,price,orderability:price.kind==='customer'?{status:'orderable'}:{status:'manager',reason:'order_price_missing'},stockStatus:p.stockStatus||'',matchedDimensions:dims,match:{kind:sizeMatch.kind,distance:sizeMatch.distance,deviations:sizeMatch.deviations}});
  }
  matches.sort((a,b)=>(a.orderability.status==='manager')-(b.orderability.status==='manager')||(a.match.kind==='near')-(b.match.kind==='near')||a.match.distance-b.match.distance||a.price.amount-b.price.amount||a.articul.localeCompare(b.articul));
  publicMatches.sort((a,b)=>(a.match.kind==='near')-(b.match.kind==='near')||a.match.distance-b.match.distance||a.articul.localeCompare(b.articul));
  const publicOffers=publicMatches.slice(0,3);
  if(matches.length||publicOffers.length){
    // Keep a separate allowance for reference-only offers, so cheap retail
    // prices cannot crowd products with an actual permitted order price out.
    const orderable=matches.filter(p=>p.orderability.status==='orderable');
    const exact=orderable.filter(p=>p.match.kind==='exact').slice(0,3),near=orderable.filter(p=>p.match.kind==='near').slice(0,3);
    const manager=matches.filter(p=>p.orderability.status==='manager').slice(0,3);
    const publicNote=state.language==='hy'?'Ձեր կատալոգից դուրս գտնվել են նաև բնութագրերով համապատասխան մոդելներ։ Դրանց գինը, հասանելիությունը և ձեր բյուջեին համապատասխանությունը ճշտեք մենեջերի հետ։':state.language==='ru'?'Есть также модели с подходящими характеристиками вне вашего каталога. Цену, доступность и соответствие бюджету уточните у менеджера.':'Other models match the technical requirements outside your catalogue. Ask the manager about price, availability and budget fit.';
    return reply((matches.length?t.found:'')+([...near,...manager].some(p=>p.match.kind==='near')?' '+t.near:'')+(uncertain?' '+t.unknown:'')+(publicOffers.length?' '+publicNote:''),null,[],[...exact,...near,...manager],publicOffers);
  }
  const changes=[t.budgetChange,...(Object.keys(axes).some(axis=>state[axis])?[t.sizeChange]:[]),...(state.capacity?[t.loadChange]:[]),...(state.brand?[t.brandChange]:[]),...(state.drying!==undefined||state.inverter?[t.featureChange]:[])];
  return reply((unpriced?t.priceUnknown+' ':'')+t.none+(uncertain?' '+t.unknown:''),'relax',changes);
}
