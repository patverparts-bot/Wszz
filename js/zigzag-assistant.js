(() => {
  const copy = {
    hy: {subtitle:'Ձեր օգնականը տեխնիկայի աշխարհում',title:'Բարև, ես ԶիգԶագն եմ։',intro:'Գտնենք բնութագրերը և համեմատենք տեխնիկան։ Գրեք ապրանքի մոդելը կամ արտիկուլը։',placeholder:'Մոդել, արտիկուլ կամ հարց…',send:'Ուղարկել',close:'Փակել',clear:'Նոր զրույց',you:'Դուք',pending:'Ստուգում եմ բնութագրերը…',mode:'Բնութագրերի որոնում',ai:'Խելացի օգնական',note:'Տվյալների աղբյուրը՝ zigzag.am · ստուգման ամսաթիվը՝ պատասխանում',choose:'Համեմատել',compare:'Համեմատել ընտրվածները',resetContext:'Մաքրել ընտրությունը',missing:'Ճշգրիտ մոդելի հաստատված բնութագրեր դեռ չկան։',checked:'Ստուգված է՝ ',saved:'Պահպանված տվյալներ',live:'Հենց նոր ստուգված',refresh:'Թարմացնել zigzag.am-ից',unavailable:'Կայքն այժմ հասանելի չէ թարմացման համար։ Ցուցադրված են պահպանված տվյալները։',modelUnavailable:'AI պատասխանը հիմա հասանելի չէ։ Ցուցադրված են հաստատված բնութագրերը։',error:'Չհաջողվեց ստանալ պատասխանը։ Կրկին փորձեք։',notDeployed:'Օգնականը պատրաստվում է գործարկման։ Փորձեք ավելի ուշ։',retry:'Կրկին փորձել',limit:'Համեմատելու համար ընտրեք առավելագույնը երկու ապրանք։',example:'Բնութագրեր՝ ',ask:'Հարցնել ԶիգԶագին'},
  };
  const shoppingCopy={
    hy:{intro:'Նկարագրեք՝ ինչ տեխնիկա է պետք։ Կօգնեմ ընտրել ըստ բյուջեի, չափի և ցանկությունների, իսկ անհրաժեշտության դեպքում կհարցնեմ մանրամասները։',placeholder:'Օրինակ՝ մատչելի լվացքի մեքենա, 60 սմ…',selection:'Տեխնիկայի ընտրություն',shoppingExample:'Պետք է մատչելի լվացքի մեքենա, 60 սմ',price:'Ձեր գինը',retailPrice:'Մանրածախ գին',catalogPrice:'Գինը՝ ձեր ընթացիկ կատալոգից',offerDetails:'Բնութագրերը',newSelection:'Նոր ընտրություն'},
  };
  for(const lang of Object.keys(shoppingCopy))Object.assign(copy[lang],shoppingCopy[lang]);
  const locale = 'hy';
  let context = [], selected = [], advisor = null, requirements = '', currentMode = 'specifications', controller, revision = 0, busy = false, owner = null;
  const t = key => copy[locale][key];
  const create = (tag, className, text) => { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; };
  const button = (text, onClick, className) => { const b = create('button', className, text); b.type = 'button'; b.addEventListener('click', onClick); return b; };
  const avatar = size => { const img = create('img'); img.src = 'zigzag-avatar.svg?v=1.2-hy-blue'; img.alt = ''; img.width = img.height = size; return img; };
  const launcher = button('', open, 'zigzag-launcher'); launcher.id = 'zigzagLauncher'; launcher.setAttribute('aria-haspopup', 'dialog'); launcher.append(avatar(43));
  const launcherText = create('span', '', 'ԶիգԶագ'); launcherText.append(create('small', '', 'Ձեր օգնականը')); launcher.append(launcherText);
  document.getElementById('mainApp').append(launcher);
  const dialog = create('dialog', 'zigzag-dialog'); dialog.id = 'zigzagAssistant'; dialog.setAttribute('aria-labelledby', 'zigzagTitle');
  const header = create('header', 'zigzag-header'), headingCopy = create('div', 'zigzag-header-copy'), title = create('h2', '', 'ԶիգԶագ'); title.id = 'zigzagTitle';
  const subtitle = create('p'); headingCopy.append(title, subtitle); const close = button('×', () => dialog.close(), 'zigzag-close'); header.append(avatar(52), headingCopy, close);
  const toolbar = create('div', 'zigzag-toolbar'), mode = create('span', 'zigzag-mode');
  const clear = button('', () => reset(false)); toolbar.append(mode, clear);
  const messages = create('div', 'zigzag-messages'); messages.setAttribute('role', 'log'); messages.setAttribute('aria-live', 'polite'); messages.setAttribute('aria-relevant', 'additions');
  const contextBar = create('div', 'zigzag-context');
  const form = create('form', 'zigzag-composer'), row = create('div', 'zigzag-input-row'), input = create('input'), send = create('button', 'zigzag-send', '↑'), note = create('p');
  input.id = 'zigzagInput'; input.maxLength = 1200; input.autocomplete = 'off'; input.required = true; send.type = 'submit'; row.append(input, send); form.append(row, note);
  dialog.append(header, toolbar, messages, contextBar, form); document.body.append(dialog);
  function labels() { dialog.lang = locale; subtitle.textContent = t('subtitle'); close.setAttribute('aria-label', t('close')); clear.textContent = t('clear'); input.placeholder = t('placeholder'); input.setAttribute('aria-label', t('placeholder')); send.setAttribute('aria-label', t('send')); note.textContent = t('note'); mode.textContent = t(currentMode==='selection'?'selection':currentMode==='ai'?'ai':'mode'); launcher.setAttribute('aria-label', t('ask')); }
  function visibleProduct(id) { return allProducts.find(p => p.articul === id); }
  function updateContext() {
    contextBar.replaceChildren();
    if(advisor){if(requirements)contextBar.append(create('span','zigzag-requirements',requirements));contextBar.append(button(t('newSelection'),()=>reset(false)));return;}
    if (!context.length && !selected.length) return;
    for (const id of [...new Set([...context, ...selected])]) { const p = visibleProduct(id); if (p) contextBar.append(create('span', '', p.name)); }
    contextBar.append(button(t('resetContext'), () => { context = []; selected = []; updateContext(); }));
    if (selected.length === 2) contextBar.append(button(t('compare'), () => { const ids = [...selected]; selected = []; context = ids; submit((locale === 'ru' ? 'Сравни характеристики: ' : locale === 'en' ? 'Compare specifications: ' : 'Համեմատիր բնութագրերը՝ ') + ids.join(', ')); }));
  }
  function welcome() {
    messages.replaceChildren(); const box = create('div', 'zigzag-welcome'); box.append(avatar(94), create('div', 'zigzag-eyebrow', 'ԶԻԳԶԱԳ · ՁԵՐ ՕԳՆԱԿԱՆԸ'), create('h3', '', t('title')), create('p', '', t('intro')));
    const examples = create('div', 'zigzag-examples');
    examples.append(button(t('shoppingExample'),()=>submit(t('shoppingExample'))));
    for (const p of allProducts.slice(0, 2)) examples.append(button(p.name, () => submit(t('example') + p.articul)));
    box.append(examples); messages.append(box);
  }
  function open() {
    if (!serverIdentity || document.getElementById('mainApp').classList.contains('hidden')) return;
    if (owner !== serverIdentity.id) { reset(true); owner = serverIdentity.id; }
    if (!dialog.open) dialog.showModal();
    if (!messages.children.length) welcome(); input.focus();
  }
  function reset(closeDialog = true) {
    revision++; controller?.abort(); busy = false; controller = null; send.disabled = false; input.value = ''; context = []; selected = []; advisor = null; requirements = ''; currentMode = 'specifications'; messages.replaceChildren(); messages.removeAttribute('aria-busy'); updateContext(); mode.textContent = t('mode');
    if (closeDialog) { if (dialog.open) dialog.close(); owner = null; } else { welcome(); input.focus(); }
  }
  function bubble(text, user = false) { const el = create('div', 'zigzag-message' + (user ? ' zigzag-message-user' : '')); el.append(create('span', 'zigzag-message-label', user ? t('you') : 'ԶիգԶագ'), document.createTextNode(text)); messages.append(el); return el; }
  function scroll() { messages.scrollTop = messages.scrollHeight; }
  function revealReply(reply){messages.scrollTo({top:reply.getBoundingClientRect().top-messages.getBoundingClientRect().top+messages.scrollTop-8,behavior:'instant'});}
  function showProduct(product) {
    const box = create('section', 'zigzag-product'); box.append(create('h4', '', product.name));
    if(product.price&&typeof product.price.amount==='number'&&product.price.amount>0){
      const price=create('div','zigzag-offer-price');price.append(create('strong','',t(product.price.kind==='customer'?'price':'retailPrice')+': '+product.price.amount.toLocaleString(locale==='ru'?'ru-RU':locale==='hy'?'hy-AM':'en-GB')+' ֏'),create('small','',t('catalogPrice')));box.append(price);
    }
    if (product.status !== 'verified') { box.append(create('p', 'zigzag-source', t('missing'))); return box; }
    const dl = create('dl', 'zigzag-specs');
    for (const spec of product.specifications || []) { const pair = create('div', 'zigzag-spec-row'), name=create('dt','',ZZWS_ARMENIAN_SPECS.label(spec.name)), value=create('dd','',ZZWS_ARMENIAN_SPECS.value(spec.value)); name.title=spec.name;value.title=String(spec.value);pair.append(name,value);dl.append(pair); }
    box.append(dl); const source = create('div', 'zigzag-source');
    try { const url = new URL(product.sourceUrl); if (url.protocol === 'https:' && url.hostname === 'www.zigzag.am' && !url.username && !url.password) { const a = create('a', '', 'zigzag.am ↗'); a.href = url.href; a.target = '_blank'; a.rel = 'noopener noreferrer'; source.append(a); } } catch {}
    const date = new Date(product.checkedAt); source.append(create('small', '', t('checked') + (Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(locale === 'hy' ? 'hy-AM' : locale === 'ru' ? 'ru-RU' : 'en-GB')) + ' · ' + t(product.sourceMode === 'live' ? 'live' : 'saved')));
    if (product.refreshUnavailable) source.append(create('small', '', t('unavailable'))); box.append(source); return box;
  }
  async function submit(text, refresh = false) {
    const message = String(text || '').trim(); if (!message || message.length > 1200 || busy || !serverIdentity) return;
    const userId = serverIdentity.id, currentRevision = revision;
    if (messages.querySelector('.zigzag-welcome')) messages.replaceChildren();
    // A bounded, in-memory transcript is discarded at logout and on a new conversation.
    if (messages.children.length > 42) messages.replaceChildren(...Array.from(messages.children).slice(-30));
    bubble(message, true); input.value = ''; busy = true; send.disabled = true; messages.setAttribute('aria-busy', 'true');
    const pending = create('div', 'zigzag-pending', t('pending')); messages.append(pending); scroll(); controller = new AbortController();
    const requestController = controller, timeout = setTimeout(() => requestController.abort(), 45000);
    try {
      const data = await secureApi('assistant/chat', {method: 'POST', body: JSON.stringify({message, context, refresh, advisor, locale}), signal: requestController.signal});
      if (currentRevision !== revision || serverIdentity?.id !== userId) return;
      pending.remove(); currentMode=data.mode;mode.textContent = t(data.mode==='selection'?'selection':data.mode === 'ai' ? 'ai' : 'mode'); const reply = bubble(data.answer);
      context = (data.context || []).filter(id => visibleProduct(id)).slice(0, 2); advisor=data.advisor||null;requirements=data.requirementSummary||'';updateContext();
      if (data.modelUnavailable) reply.append(create('p', 'zigzag-note', t('modelUnavailable')));
      if(data.quickReplies?.length){const quick=create('div','zigzag-quick-replies');for(const text of data.quickReplies)quick.append(button(text,()=>submit(text),'zigzag-choice'));reply.append(quick);}
      if(data.recommendations?.length){
        const offers=create('div','zigzag-products zigzag-recommendations');
        for(const product of data.recommendations){const card=showProduct(product);card.append(button(t('offerDetails'),()=>askProduct(product.articul),'zigzag-offer-details'));offers.append(card);}reply.append(offers);
      }
      if (data.products?.length) {
        const cards = create('div', 'zigzag-products'); for (const product of data.products) cards.append(showProduct(product)); reply.append(cards);
        const ids = data.products.map(p => p.articul);
        reply.append(button(t('refresh'), () => { context = ids; submit(t('example') + ids.join(', '), true); }, 'zigzag-refresh'));
      }
      if (data.choices?.length) {
        const choices = create('div', 'zigzag-choices');
        for (const p of data.choices) {
          const entry = create('div'), choose = button(p.name, () => askProduct(p.articul), 'zigzag-choice'); choose.append(create('small', '', p.articul));
          const compare = button('+ ' + t('choose'), () => { if (busy) return; if (selected.includes(p.articul)) selected = selected.filter(id => id !== p.articul); else if (selected.length < 2) selected.push(p.articul); else { input.value = ''; input.placeholder = t('limit'); } context = []; compare.setAttribute('aria-pressed', String(selected.includes(p.articul))); updateContext(); }, 'zigzag-choice');
          compare.setAttribute('aria-pressed', 'false'); entry.append(choose, document.createTextNode(' '), compare); choices.append(entry);
        }
        reply.append(choices);
      }
      revealReply(reply);
    } catch (error) {
      if (currentRevision !== revision || serverIdentity?.id !== userId) return;
      pending.remove(); const reply = bubble(error.status === 404 ? t('notDeployed') : error.status === 429 ? error.message : t('error')); reply.classList.add('zigzag-message-error');
      reply.append(create('br'), button(t('retry'), () => submit(message, refresh), 'zigzag-refresh')); scroll();
    } finally {
      clearTimeout(timeout); if (currentRevision === revision) { pending.remove(); busy = false; send.disabled = false; controller = null; messages.removeAttribute('aria-busy'); }
    }
  }
  form.addEventListener('submit', event => { event.preventDefault(); submit(input.value); });
  function askProduct(articul){if(busy)return;open();advisor=null;requirements='';context=[];selected=[];updateContext();return submit(t('example')+articul);}
  document.addEventListener('click', event => { const b = event.target.closest?.('[data-zigzag-art]'); if (b) askProduct(b.dataset.zigzagArt); });
  labels();
  window.ZZWS_ASSISTANT = Object.freeze({open, reset, ask: askProduct});
})();
