/**
 * 移动端抽屉导航
 * 仅在小屏激活，零依赖。
 */
(function () {
  'use strict';

  const sidebar = document.getElementById('sidebar');
  const toggle = document.getElementById('drawerToggle');
  if (!sidebar || !toggle) return;

  let mask = null;

  function isMobile() {
    return matchMedia('(max-width: 768px)').matches;
  }

  function firstFocusable() {
    return sidebar.querySelector('a, button');
  }

  function open() {
    if (!isMobile()) return;
    sidebar.classList.add('open');
    toggle.setAttribute('aria-expanded', 'true');
    if (!mask) {
      mask = document.createElement('div');
      mask.className = 'drawer-mask';
      mask.addEventListener('click', close);
      document.body.appendChild(mask);
    }
    mask.style.display = 'block';
    const first = firstFocusable();
    if (first) first.focus();
  }

  function close() {
    sidebar.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
    if (mask) mask.style.display = 'none';
    toggle.focus();
  }

  function toggleDrawer() {
    if (sidebar.classList.contains('open')) close();
    else open();
  }

  toggle.addEventListener('click', toggleDrawer);

  sidebar.addEventListener('click', (e) => {
    if (e.target.closest('a, button')) close();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) close();
  });

  matchMedia('(max-width: 768px)').addEventListener('change', (e) => {
    if (!e.matches) close();
  });
})();
