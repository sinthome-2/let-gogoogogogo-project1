/**
 * K1 接线断言：抽屉打开时键盘焦点不得逃出侧边栏。
 *
 * 本文件由出题人（编排者）编写，执行者不得修改。
 * 断言的是**行为**，不是源码文本：不出现 toContain。
 *
 * 浏览器语义模拟：keydown(Tab) 先派发；若实现没有 preventDefault，
 * 由测试代替浏览器执行默认的焦点移动，再断言焦点最终位置。
 * 这样「自己接管 Tab」与「用 focus 事件把焦点拽回」两类实现都能通过。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const SOURCE = readFileSync('js/drawer.js', 'utf8');
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const HTML = `<!doctype html><html><body>
  <button id="drawerToggle" aria-expanded="false">菜单</button>
  <aside id="sidebar">
    <a href="#/term/a">术语 A</a>
    <a href="#/term/b">术语 B</a>
  </aside>
  <main>
    <a id="outsideLink" href="#/outside">正文链接</a>
    <button id="outsideBtn">正文按钮</button>
  </main>
</body></html>`;

function setup() {
  const dom = new JSDOM(HTML, { runScripts: 'outside-only', url: 'https://example.test/' });
  const win = dom.window;
  win.matchMedia = (query) => ({
    matches: true,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false;
    },
  });
  win.eval(SOURCE);
  return { win, doc: win.document };
}

function focusables(doc) {
  return Array.from(doc.querySelectorAll(FOCUSABLE));
}

/** 模拟浏览器按 Tab：先派发 keydown，未被拦截则代行默认焦点移动。 */
function pressTab(win, doc, shiftKey = false) {
  const target = doc.activeElement || doc.body;
  const event = new win.KeyboardEvent('keydown', {
    key: 'Tab',
    shiftKey,
    bubbles: true,
    cancelable: true,
  });
  const notPrevented = target.dispatchEvent(event);
  if (!notPrevented) return;
  const list = focusables(doc);
  const index = list.indexOf(target);
  let next;
  if (shiftKey) next = index <= 0 ? list[list.length - 1] : list[index - 1];
  else next = index === -1 || index === list.length - 1 ? list[0] : list[index + 1];
  if (next) next.focus();
}

describe('K1 抽屉焦点约束', () => {
  it('打开抽屉后焦点进入侧边栏', () => {
    const { doc } = setup();
    doc.getElementById('drawerToggle').click();
    expect(doc.getElementById('sidebar').classList.contains('open')).toBe(true);
    expect(doc.getElementById('sidebar').contains(doc.activeElement)).toBe(true);
  });

  it('焦点在侧边栏最后一个元素时按 Tab，焦点不离开侧边栏', () => {
    const { win, doc } = setup();
    const sidebar = doc.getElementById('sidebar');
    const links = sidebar.querySelectorAll('a');
    doc.getElementById('drawerToggle').click();
    links[links.length - 1].focus();
    pressTab(win, doc);
    expect(sidebar.contains(doc.activeElement)).toBe(true);
  });

  it('焦点在侧边栏第一个元素时按 Shift+Tab，焦点不离开侧边栏', () => {
    const { win, doc } = setup();
    const sidebar = doc.getElementById('sidebar');
    doc.getElementById('drawerToggle').click();
    sidebar.querySelector('a').focus();
    pressTab(win, doc, true);
    expect(sidebar.contains(doc.activeElement)).toBe(true);
  });

  it('从正文处尝试把焦点抢进已打开的抽屉外元素，焦点应被拉回抽屉内', () => {
    const { doc } = setup();
    doc.getElementById('drawerToggle').click();
    doc.getElementById('outsideBtn').focus();
    expect(doc.getElementById('sidebar').contains(doc.activeElement)).toBe(true);
  });

  it('按 Escape 关闭后焦点回到开关，且焦点不再被拉回侧边栏', () => {
    const { win, doc } = setup();
    const sidebar = doc.getElementById('sidebar');
    const toggle = doc.getElementById('drawerToggle');
    toggle.click();
    sidebar.querySelector('a').focus();
    doc.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(sidebar.classList.contains('open')).toBe(false);
    expect(doc.activeElement).toBe(toggle);

    // 关闭后陷阱必须解除：正文元素能被正常聚焦，且 Tab 能继续往后走
    doc.getElementById('outsideLink').focus();
    expect(sidebar.contains(doc.activeElement)).toBe(false);
    pressTab(win, doc);
    expect(doc.activeElement.id).toBe('outsideBtn');
  });
});
