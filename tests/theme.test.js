import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('暗色模式', () => {
  it('css 三段式齐备', () => {
    const css = readFileSync('css/style.css', 'utf8');
    expect(css).toContain('[data-theme="dark"]');
    expect(css).toContain('prefers-color-scheme: dark');
    expect(css).toContain(':not([data-theme="light"]):not([data-theme="dark"])');

    const manual = css.match(/\[data-theme="dark"\]\s*\{([^}]*)\}/)?.[1] || '';
    const media = css.match(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{[^}]*\{([^}]*)\}\s*\}/)?.[1] || '';
    expect(manual).toContain('--bg:');
    expect(manual).toContain('--text:');
    expect(manual).toContain('--surface:');
    expect(media).toContain('--bg:');
    expect(media).toContain('--text:');
    expect(media).toContain('--surface:');
  });

  it('手动块与媒体查询块 --bg 值一致', () => {
    const css = readFileSync('css/style.css', 'utf8');
    const manual = css.match(/\[data-theme="dark"\]\s*\{([^}]*)\}/)?.[1] || '';
    const media = css.match(/@media\s*\(prefers-color-scheme:\s*dark\)\s*\{[^}]*\{([^}]*)\}\s*\}/)?.[1] || '';
    const manualBg = manual.match(/--bg:\s*([^;]+)/)?.[1];
    const mediaBg = media.match(/--bg:\s*([^;]+)/)?.[1];
    expect(manualBg).toBe(mediaBg);
  });

  it('暗色块不含白系 rgb 值', () => {
    const css = readFileSync('css/style.css', 'utf8');
    const block = css.match(/\[data-theme="dark"\]\s*\{([^}]*)\}/)?.[1] || '';
    expect(block).not.toMatch(/255/);
    expect(block).not.toContain('#fff');
    expect(block).not.toContain('#ffffff');
  });

  it('index.html 含 themeToggle 按钮', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).toContain('id="themeToggle"');
    expect(html).toContain('aria-label="切换暗色模式"');
  });

  it('js/app.js 含主题切换关键逻辑', () => {
    const js = readFileSync('js/app.js', 'utf8');
    expect(js).toContain("localStorage.getItem('theme')");
    expect(js).toContain("setAttribute('data-theme'");
    expect(js).toContain('matchMedia');
    expect(js).toContain('🌙');
  });
});
