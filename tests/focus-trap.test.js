// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

describe('FocusTrap', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    const src = readFileSync('js/focus-trap.js', 'utf8');
    new Function(src)();
  });

  it('Tab 到容器外时焦点被拉回容器内', () => {
    document.body.innerHTML = `
      <button id="outside">outside</button>
      <div id="container">
        <a href="#">first</a>
        <button>second</button>
      </div>
    `;
    const container = document.getElementById('container');
    const outside = document.getElementById('outside');
    const first = container.querySelector('a');

    const trap = window.FocusTrap.init(container, { focusAfterClosed: outside });
    expect(document.activeElement).toBe(first);

    outside.focus();
    expect(container.contains(document.activeElement)).toBe(true);

    trap.close();
    expect(document.activeElement).toBe(outside);
  });

  it('close() 后哨兵移除、监听移除、焦点归还', () => {
    document.body.innerHTML = `
      <button id="trigger">trigger</button>
      <div id="container"><input /></div>
    `;
    const container = document.getElementById('container');
    const trigger = document.getElementById('trigger');

    const beforeCount = document.body.querySelectorAll('div').length;
    const trap = window.FocusTrap.init(container, { focusAfterClosed: trigger });
    expect(document.body.querySelectorAll('div').length).toBe(beforeCount + 2);

    trap.close();
    expect(document.body.querySelectorAll('div').length).toBe(beforeCount);
    expect(document.body.classList.contains('focus-trap-active')).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('IgnoreUtilFocusChanges 期间不循环', () => {
    document.body.innerHTML = `<div id="container"><button>b</button></div>`;
    const container = document.getElementById('container');
    const trap = window.FocusTrap.init(container, {});
    // 直接调用 close 会设置 IgnoreUtilFocusChanges 并 focus，不应抛错或死循环
    expect(() => trap.close()).not.toThrow();
  });

  it('结构：含许可证头、关键 API 与 isFocusable，不含不该搬的内容', () => {
    const src = readFileSync('js/focus-trap.js', 'utf8');
    expect(src).toContain('W3C Software License');
    expect(src).toContain('Derived from w3c/aria-practices');
    expect(src).toContain("addEventListener('focus'");
    expect(src).toContain('tabIndex = 0');
    expect(src).toContain('isFocusable');
    expect(src).not.toContain('OpenDialogList');
    expect(src).not.toContain('backdrop');
  });
});
