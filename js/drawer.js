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
  let trapActive = false;

  const FOCUSABLE_SELECTOR =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function isMobile() {
    return matchMedia('(max-width: 768px)').matches;
  }

  function focusables() {
    return Array.from(sidebar.querySelectorAll(FOCUSABLE_SELECTOR));
  }

  function firstFocusable() {
    const list = focusables();
    return list[0] || null;
  }

  function lastFocusable() {
    const list = focusables();
    return list[list.length - 1] || null;
  }

  function onTabKeydown(e) {
    if (!sidebar.classList.contains('open') || e.key !== 'Tab') return;
    const list = focusables();
    if (!list.length) return;
    const first = list[0];
    const last = list[list.length - 1];
    const active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || !sidebar.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else if (active === last || !sidebar.contains(active)) {
      e.preventDefault();
      first.focus();
    }
  }

  function onFocusCapture(e) {
    if (!sidebar.classList.contains('open')) return;
    if (sidebar.contains(e.target)) return;
    // 焦点被抢到抽屉外时，把它拉回抽屉内
    const first = firstFocusable();
    if (first) first.focus();
  }

  function startTrap() {
    if (trapActive) return;
    trapActive = true;
    document.addEventListener('keydown', onTabKeydown, true);
    document.addEventListener('focus', onFocusCapture, true);
  }

  function stopTrap() {
    if (!trapActive) return;
    trapActive = false;
    document.removeEventListener('keydown', onTabKeydown, true);
    document.removeEventListener('focus', onFocusCapture, true);
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
    startTrap();
    const first = firstFocusable();
    if (first) first.focus();
  }

  function close() {
    stopTrap();
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
