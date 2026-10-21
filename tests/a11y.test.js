// @vitest-environment jsdom
// @vitest-environment jsdom
// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import Axe from 'axe-core';

const axe = Axe;

function runAxe(path) {
  // 将文件 HTML 写入 vitest jsdom 的全局 document，使 axe-core 在同一 window 中扫描
  const html = readFileSync(path, 'utf8');
  document.open();
  document.write(html);
  document.close();
  return axe.run(document.documentElement, {
    rules: {
      'color-contrast': { enabled: false } // jsdom 不渲染配色
    }
  });
}

function seriousViolations(results) {
  return results.violations.filter(v => ['critical', 'serious'].includes(v.impact));
}

describe('axe 可访问性扫描', () => {
  it('index.html 无 critical/serious violation', async () => {
    const results = await runAxe('index.html');
    expect(seriousViolations(results)).toEqual([]);
  });

  it('term/llm/index.html 无 critical/serious violation', async () => {
    const results = await runAxe('term/llm/index.html');
    expect(seriousViolations(results)).toEqual([]);
  });
});
