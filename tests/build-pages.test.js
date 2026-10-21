import { describe, it, expect } from 'vitest';
import { buildPages } from '../tools/build-pages.mjs';

function idsFromFiles(files) {
  return Object.keys(files)
    .filter(p => p.startsWith('term/') && p.endsWith('/index.html'))
    .map(p => p.replace(/^term\//, '').replace(/\/index\.html$/, ''))
    .sort();
}

function locsFromSitemap(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
}

describe('buildPages 静态页生成器', () => {
  it('合成 3 词条：输出 3 个 term 页 + sitemap 3 个 loc', () => {
    const terms = [
      { id: 'zeta', name: 'Zeta', category: 'c', subcategory: 's', aliases: [], definition: 'def zeta', examples: [], related: [] },
      { id: 'alpha', name: 'Alpha', category: 'c', subcategory: 's', aliases: [], definition: 'def alpha', examples: [], related: [] },
      { id: 'beta', name: 'Beta', category: 'c', subcategory: 's', aliases: [], definition: 'def beta', examples: [], related: [] }
    ];
    const categories = [{ id: 'c', name: '分类', subcategories: [{ id: 's', name: '子类' }] }];
    const { files } = buildPages({ terms, categories, base: '' });

    expect(idsFromFiles(files)).toEqual(['alpha', 'beta', 'zeta']);
    expect(locsFromSitemap(files['sitemap.xml'])).toHaveLength(3);
  });

  it('定义含 <script> 的词条：页面里被转义', () => {
    const terms = [{
      id: 'xss',
      name: 'XSS',
      category: 'c',
      subcategory: 's',
      aliases: [],
      definition: '恶意 <script>alert(1)</script> 内容',
      examples: [],
      related: []
    }];
    const categories = [{ id: 'c', name: '分类', subcategories: [{ id: 's', name: '子类' }] }];
    const { files } = buildPages({ terms, categories, base: '' });
    const html = files['term/xss/index.html'];
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('悬空 related 渲染「待收录」且不成链接', () => {
    const terms = [{
      id: 'a',
      name: 'A',
      category: 'c',
      subcategory: 's',
      aliases: [],
      definition: 'def',
      examples: [],
      related: ['missing-id']
    }];
    const categories = [{ id: 'c', name: '分类', subcategories: [{ id: 's', name: '子类' }] }];
    const { files } = buildPages({ terms, categories, base: '' });
    const html = files['term/a/index.html'];
    expect(html).toContain('missing-id<small>（待收录）</small>');
    expect(html).not.toMatch(/href="[^"]*missing-id/);
  });

  it('canonical 与「打开交互版」href 均含 base 且指向正确 id', () => {
    const terms = [{
      id: 'foo',
      name: 'Foo',
      category: 'c',
      subcategory: 's',
      aliases: [],
      definition: 'def',
      examples: [],
      related: []
    }];
    const categories = [{ id: 'c', name: '分类', subcategories: [{ id: 's', name: '子类' }] }];
    const { files } = buildPages({ terms, categories, base: '/base' });
    const html = files['term/foo/index.html'];
    expect(html).toContain('href="/base/term/foo/"');
    expect(html).toContain('href="/base/#term/foo"');
  });

  it('幂等：同输入两次 buildPages 输出 deep equal', () => {
    const terms = [
      { id: 'b', name: 'B', category: 'c', subcategory: 's', aliases: [], definition: 'def b', examples: [], related: [] },
      { id: 'a', name: 'A', category: 'c', subcategory: 's', aliases: [], definition: 'def a', examples: [], related: [] }
    ];
    const categories = [{ id: 'c', name: '分类', subcategories: [{ id: 's', name: '子类' }] }];
    const first = buildPages({ terms, categories, base: '/x' });
    const second = buildPages({ terms, categories, base: '/x' });
    expect(first).toEqual(second);
  });
});
