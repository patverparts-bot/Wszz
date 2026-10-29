(() => {
  const desktop = window.matchMedia('(min-width: 768px) and (hover: hover)');
  let preview;
  let frame = 0;

  function hidePreview() {
    cancelAnimationFrame(frame);
    if (preview) preview.classList.remove('is-visible');
  }

  document.addEventListener('pointerover', event => {
    if (!desktop.matches || event.pointerType === 'touch') return;
    const container = event.target.closest?.('.product-img-container');
    if (!container || container.contains(event.relatedTarget)) return;
    const image = container.querySelector('.product-img.image-loaded');
    if (!image || !image.complete || !image.naturalWidth) return;
    if (!preview) {
      preview = document.createElement('div');
      preview.className = 'desktop-photo-preview';
      preview.setAttribute('aria-hidden', 'true');
      preview.appendChild(document.createElement('img'));
      document.body.appendChild(preview);
    }
    cancelAnimationFrame(frame);
    const rect = image.getBoundingClientRect();
    const gap = 12;
    const size = Math.min(rect.width * 11.5934, window.innerWidth - gap * 2, window.innerHeight - gap * 2);
    const left = Math.max(gap, Math.min(rect.left + rect.width / 2 - size / 2, window.innerWidth - size - gap));
    const top = Math.max(gap, Math.min(rect.top + rect.height / 2 - size / 2, window.innerHeight - size - gap));
    preview.style.width = size + 'px';
    preview.style.height = size + 'px';
    preview.style.left = left + 'px';
    preview.style.top = top + 'px';
    preview.firstElementChild.src = image.currentSrc || image.src;
    preview.firstElementChild.alt = image.alt;
    preview.style.setProperty('--preview-shift-x', (rect.left - left) + 'px');
    preview.style.setProperty('--preview-shift-y', (rect.top - top) + 'px');
    preview.style.setProperty('--preview-start-scale', String(rect.width / size));
    preview.classList.remove('is-visible');
    // Commit the thumbnail-sized starting state before opening the preview.
    void preview.offsetWidth;
    frame = requestAnimationFrame(() => preview.classList.add('is-visible'));
  });

  document.addEventListener('pointerout', event => {
    const container = event.target.closest?.('.product-img-container');
    if (container && !container.contains(event.relatedTarget)) hidePreview();
  });
  document.addEventListener('scroll', hidePreview, true);
  window.addEventListener('resize', hidePreview);
  window.addEventListener('blur', hidePreview);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') hidePreview();
  });
})();
