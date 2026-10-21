import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildPages, escapeHtml } from '../tools/build-pages.mjs';
import { formatGbt7714, formatApa } from '../tools/citation.mjs';

const termsData = JSON.parse(readFileSync(fileURLToPath(new URL('../data/terms.json', import.meta.url)), 'utf8'));
const categoriesData = JSON.parse(readFileSync(fileURLToPath(new URL('../data/categories.json', import.meta.url)), 'utf8'));

describe('引用格式与接线', () => {
  it('纯函数模板输出精确匹配', () => {
    const term = termsData.terms[0];
    const base = '/base';
    const date = '2026-10-21';
    const url = `${base}/term/${term.id}/`;
    expect(formatGbt7714({ name: term.name, url, date })).toBe(`AI 术语辞典. ${term.name}[EB/OL]. [${date}]. ${url}.`);
    expect(formatApa({ name: term.name, url, date })).toBe(`AI 术语辞典. (${date}). ${term.name}. AI 术语辞典. ${url}`);
  });

  it('name 含特殊字符时引用块被转义', () => {
    const term = { id: 'xss', name: 'A&B<C>', category: 'c', subcategory: 's', aliases: [], definition: 'd', examples: [], related: [] };
    const { files } = buildPages({ terms: [term], categories: [{ id: 'c', name: 'C', subcategories: [{ id: 's', name: 'S' }] }], base: '/b' });
    const html = files['term/xss/index.html'];
    const citation = html.match(/<details id="citation">([\s\S]*?)<\/details>/)[1];
    expect(citation).not.toContain('A&B<C>');
    expect(citation).toContain(escapeHtml('A&B<C>'));
  });

  it('每页含占位符且无真实日期', () => {
    const { files } = buildPages({ terms: termsData.terms, categories: categoriesData.categories, base: '/base' });
    const dateRe = /\d{4}-\d{2}-\d{2}/;
    let count = 0;
    for (const [path, html] of Object.entries(files)) {
      if (!path.startsWith('term/') || !path.endsWith('/index.html')) continue;
      const matches = html.match(/{{CITE_DATE}}/g) || [];
      expect(matches.length).toBeGreaterThanOrEqual(2);
      expect(html).not.toMatch(dateRe);
      count++;
    }
    expect(count).toBe(termsData.terms.length);
  });

  it('复制接线脚本存在', () => {
    const { files } = buildPages({ terms: termsData.terms, categories: categoriesData.categories, base: '/base' });
    const html = files['term/skill/index.html'];
    expect(html).toContain('navigator.clipboard.writeText');
    expect(html).toContain('data-copy');
  });

  it('幂等：两次 buildPages deep equal', () => {
    const first = buildPages({ terms: termsData.terms, categories: categoriesData.categories, base: '/x' });
    const second = buildPages({ terms: termsData.terms, categories: categoriesData.categories, base: '/x' });
    expect(first).toEqual(second);
  });
});
