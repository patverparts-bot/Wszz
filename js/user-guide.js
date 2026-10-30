(() => {
  const dialog = document.getElementById('userGuideDialog');
  if (!dialog) return;
  const content = document.getElementById('userGuideContent');
  const toc = document.getElementById('userGuideTocLinks');
  const tocDetails = document.getElementById('userGuideToc');
  const desktop = window.matchMedia('(min-width: 768px)');
  let loaded = false;
  let loading;
  let opener;

  async function loadGuide() {
    if (loaded) return;
    if (loading) return loading;
    content.setAttribute('aria-busy', 'true');
    content.textContent = 'Ուղեցույցը բեռնվում է…';
    loading = (async () => {
      try {
        const response = await fetch('help/user-guide.html?v=7.1.0-bilingual');
        if (!response.ok) throw new Error('Guide unavailable');
        const html = await response.text();
        const parsed=new DOMParser().parseFromString(html,'text/html');const article=parsed.querySelector('.zzws-guide');if(!article)throw Error('Guide unavailable');content.replaceChildren(...[...parsed.querySelectorAll('style')].map(style=>document.importNode(style,true)),document.importNode(article,true));
        toc.replaceChildren();
        content.querySelectorAll('h2[id]').forEach(heading => {
          const link = document.createElement('a');
          link.href = '#' + heading.id;
          link.textContent = heading.textContent;
          toc.appendChild(link);
        });
        loaded = true;
      } catch (error) {
        content.replaceChildren();
        const message = document.createElement('p');
        message.textContent = 'Չհաջողվեց բեռնել ուղեցույցը։ Ստուգեք ինտերնետ կապը և կրկին փորձեք։';
        const retry = document.createElement('button');
        retry.type = 'button';
        retry.className = 'zzws-guide-retry';
        retry.textContent = 'Կրկին փորձել';
        retry.addEventListener('click', loadGuide);
        content.append(message, retry);
      } finally {
        content.removeAttribute('aria-busy');
        loading = null;
      }
    })();
    return loading;
  }

  document.querySelectorAll('[data-open-user-guide]').forEach(button => {
    button.addEventListener('click', () => {
      opener = button;
      tocDetails.open = desktop.matches;
      dialog.showModal();
      document.body.classList.add('zzws-guide-open');
      loadGuide();
    });
  });
  document.getElementById('closeUserGuide').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('zzws-guide-open');
    if (opener && opener.isConnected) opener.focus({ preventScroll: true });
  });
  toc.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link) return;
    event.preventDefault();
    const heading = document.getElementById(link.hash.slice(1));
    if (!heading) return;
    if (!desktop.matches) tocDetails.open = false;
    requestAnimationFrame(() => {
      const top = content.scrollTop + heading.getBoundingClientRect().top - content.getBoundingClientRect().top - 16;
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      content.scrollTo({ top, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
  });
  desktop.addEventListener('change', () => { tocDetails.open = desktop.matches; });
})();
