import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildPages, escapeHtml } from '../tools/build-pages.mjs';

const termsData = JSON.parse(readFileSync(fileURLToPath(new URL('../data/terms.json', import.meta.url)), 'utf8'));
const categoriesData = JSON.parse(readFileSync(fileURLToPath(new URL('../data/categories.json', import.meta.url)), 'utf8'));

describe('每页 head 元数据与 JSON-LD', () => {
  it('title 数 == 词条数且全部互不重复，均符合后缀', () => {
    const { files } = buildPages({ terms: termsData.terms, categories: categoriesData.categories, base: '/base' });
    const titles = [];
    const titleRe = /是什么？— AI 术语辞典$/;
    for (const [path, html] of Object.entries(files)) {
      if (!path.startsWith('term/') || !path.endsWith('/index.html')) continue;
      const match = html.match(/<title>([^<]*)<\/title>/);
      expect(match).not.toBeNull();
      expect(match[1]).toMatch(titleRe);
      titles.push(match[1]);
    }
    expect(titles.length).toBe(termsData.terms.length);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('有 tldr 用 tldr，无 tldr 用 definition 截断且 ≤81 字', () => {
    const { files } = buildPages({ terms: termsData.terms, categories: categoriesData.categories, base: '' });
    for (const term of termsData.terms) {
      const html = files[`term/${term.id}/index.html`];
      const ldMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      expect(ldMatch).not.toBeNull();
      const data = JSON.parse(ldMatch[1]);
      const desc = data.description;
      expect(desc.length).toBeLessThanOrEqual(81);
      if (term.tldr) {
        expect(desc).toBe(term.tldr);
      } else {
        const def = String(term.definition || '').trim();
        const expected = def.length <= 80 ? def : def.slice(0, 80) + '…';
        expect(desc).toBe(expected);
      }
      const metaMatch = html.match(/<meta name="description" content="([^"]*)"/);
      expect(metaMatch[1]).toBe(escapeHtml(desc));
    }
  });

  it('JSON-LD 可解析，字段正确且与 canonical 一致', () => {
    const { files } = buildPages({ terms: termsData.terms, categories: categoriesData.categories, base: '/base' });
    for (const term of termsData.terms) {
      const html = files[`term/${term.id}/index.html`];
      const ldMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      expect(ldMatch).not.toBeNull();
      const data = JSON.parse(ldMatch[1]);
      expect(data['@type']).toBe('DefinedTerm');
      expect(data.inLanguage).toBe('zh-CN');
      expect(data.url).toBe(`/base/term/${term.id}/`);
      expect(data.isPartOf['@type']).toBe('DefinedTermSet');
      expect(data.isPartOf.url).toBe('/base/');
      const canonicalMatch = html.match(/<link rel="canonical" href="([^"]*)">/);
      expect(canonicalMatch[1]).toBe(data.url);
    }
  });

  it('og:title / og:description / og:url / favicon link 四项齐备', () => {
    const { files } = buildPages({ terms: termsData.terms, categories: categoriesData.categories, base: '/base' });
    for (const term of termsData.terms) {
      const html = files[`term/${term.id}/index.html`];
      expect(html).toMatch(/<meta property="og:title" content="[^"]*">/);
      expect(html).toMatch(/<meta property="og:description" content="[^"]*">/);
      expect(html).toMatch(/<meta property="og:type" content="article">/);
      expect(html).toMatch(/<meta property="og:url" content="[^"]*">/);
      expect(html).toContain('<link rel="icon" href="/base/assets/favicon.svg">');
    }
  });

  it('幂等：同输入两次 buildPages deep equal', () => {
    const first = buildPages({ terms: termsData.terms, categories: categoriesData.categories, base: '/x' });
    const second = buildPages({ terms: termsData.terms, categories: categoriesData.categories, base: '/x' });
    expect(first).toEqual(second);
  });
});
