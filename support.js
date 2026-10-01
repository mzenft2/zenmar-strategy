'use strict';
(() => {
  const header = document.querySelector('header');
  new ResizeObserver(() => document.documentElement.style.setProperty('--header-height', header.getBoundingClientRect().height + 'px')).observe(header);
  const panel = document.getElementById('supportPanel');
  const frame = document.getElementById('supportFrame');
  panel.addEventListener('toggle', () => {
    if (panel.open && !frame.hasAttribute('src')) {
      frame.src = 'https://ko-fi.com/zenmar/?hidefeed=true&widget=true&embed=true';
    }
  });
  document.getElementById('closeSupport').addEventListener('click', () => {
    panel.open = false;
    panel.querySelector('summary').focus();
  });
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      panel.open = false;
      panel.querySelector('summary').focus();
    }
  });
})();
