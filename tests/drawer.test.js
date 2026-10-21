import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('移动端抽屉导航', () => {
  it('css 含抽屉关键规则且 translateX 只出现在媒体查询块内', () => {
    const css = readFileSync('css/style.css', 'utf8');
    expect(css).toContain('translateX(-100%)');
    expect(css).toContain('.sidebar.open');
    expect(css).toContain('.drawer-mask');

    const normalized = css.replace(/\r\n/g, '\n');
    const mediaStart = normalized.indexOf('@media (max-width: 768px)');
    const mediaEnd = normalized.indexOf('}\n\nmark {', mediaStart);
    const outside = normalized.slice(0, mediaStart) + normalized.slice(mediaEnd + 1);
    expect(/translateX/.test(outside)).toBe(false);
  });

  it('桌面端 .sidebar 未被改成固定抽屉', () => {
    const css = readFileSync('css/style.css', 'utf8');
    const mediaStart = css.indexOf('@media (max-width: 768px)');
    const outside = css.slice(0, mediaStart);
    expect(outside).toContain('position: fixed');
    expect(outside).not.toContain('.sidebar {\n    position: fixed;\n    left: 0;\n    top: 0;\n    bottom: 0;');
    expect(outside).not.toContain('.sidebar.open');
  });

  it('index.html 含 drawerToggle 且在 app.js 后引入 drawer.js', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).toContain('id="drawerToggle"');
    expect(html).toContain('aria-expanded');
    expect(html).toContain('js/drawer.js');
    const appPos = html.indexOf('js/app.js');
    const drawerPos = html.indexOf('js/drawer.js');
    expect(drawerPos).toBeGreaterThan(appPos);
  });

  it('js/drawer.js 含关键逻辑且语法正确', () => {
    const js = readFileSync('js/drawer.js', 'utf8');
    expect(js).toContain("matchMedia('(max-width: 768px)')");
    expect(js).toContain("'Escape'");
    expect(js).toContain('drawer-mask');
    expect(js).toContain('aria-expanded');
    expect(js).toContain('focus(');
  });
});
