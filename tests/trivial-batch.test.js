// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

function readRoot(file) {
  return readFileSync(file, 'utf8');
}

function loadAppSrc() {
  const src = readRoot('js/app.js');
  // 将 IIFE 内容用 new Function 执行，暴露内部函数到全局 window
  // 由于 app.js 依赖 Search/Utils，测试中只 eval 纯函数段，不触发 init
  new Function(src)();
}

describe('T16 动态 title', () => {
  it('app.js 含搜索 title 与恢复语句', () => {
    const src = readRoot('js/app.js');
    expect(src).toMatch(/document\.title = `搜索：/);
    expect(src).toContain("document.title = 'AI 术语辞典'");
  });
});

describe('T22 键盘流', () => {
  it('app.js 含 / 聚焦、上下箭头与 Enter 分支', () => {
    const src = readRoot('js/app.js');
    expect(src).toContain("e.key === '/'");
    expect(src).toContain("'ArrowUp'");
    expect(src).toContain("'ArrowDown'");
    expect(src).toContain("'Enter'");
    expect(src).toContain("'Escape'");
  });
});

describe('T19 随机一词', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    loadAppSrc();
  });

  it('index.html 含 randomTerm 按钮', () => {
    const html = readRoot('index.html');
    expect(html).toContain('id="randomTerm"');
    expect(html).toContain('aria-label="随机词条"');
  });

  it('app.js 暴露 pickRandom 且可注入 rng', () => {
    expect(typeof window.pickRandom).toBe('function');
    const rng = (() => { let s = 7; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); })();
    const arr = ['a', 'b', 'c'];
    const first = window.pickRandom(arr, rng);
    const second = window.pickRandom(arr, rng);
    expect(arr).toContain(first);
    expect(arr).toContain(second);
  });

  it('app.js 含 term 跳转路径', () => {
    const src = readRoot('js/app.js');
    expect(src).toContain("./term/${term.id}/");
  });
});

describe('T13 缺口日志', () => {
  it('app.js 含 gap-log、Blob 与下载相关 API', () => {
    const src = readRoot('js/app.js');
    expect(src).toContain("'gap-log'");
    expect(src).toContain('Blob');
    expect(src).toContain('createObjectURL');
    expect(src).toContain('gap-log.json');
  });
});

describe('T27 页脚', () => {
  it('index.html 含 site-footer 与 termCount', () => {
    const html = readRoot('index.html');
    expect(html).toContain('site-footer');
    expect(html).toContain('id="termCount"');
  });

  it('style.css 含 .site-footer', () => {
    const css = readRoot('css/style.css');
    expect(css).toContain('.site-footer');
  });

  it('源码无硬编码词条总数', () => {
    const html = readRoot('index.html');
    const app = readRoot('js/app.js');
    const combined = html + '\n' + app;
    expect(combined).not.toMatch(/\d+\s*条/);
  });
});

describe('T28 Issue 模板', () => {
  it('term-request.yml 含四种 body 段、labels 与 title 前缀', () => {
    const yml = readRoot('.github/ISSUE_TEMPLATE/term-request.yml');
    expect(yml).toContain("name: 词条请求");
    expect(yml).toContain("title: '[词条请求] '");
    expect(yml).toContain('labels:');
    expect(yml).toContain('type: input');
    expect(yml).toContain('type: textarea');
    expect(yml).toContain('type: checkboxes');
    expect(yml).toContain('type: markdown');
    expect(yml).toContain('required: true');
  });

  it('config.yml 含 blank_issues_enabled', () => {
    const yml = readRoot('.github/ISSUE_TEMPLATE/config.yml');
    expect(yml).toContain('blank_issues_enabled: true');
  });
});
