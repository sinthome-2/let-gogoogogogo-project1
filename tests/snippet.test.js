import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

// 加载真实搜索模块
const searchSrc = readFileSync(fileURLToPath(new URL('../js/search.js', import.meta.url)), 'utf8');
const Search = vm.runInNewContext(searchSrc + '\n;Search', {});

// 加载真实数据
const termsData = JSON.parse(readFileSync(fileURLToPath(new URL('../data/terms.json', import.meta.url)), 'utf8'));
const indexData = JSON.parse(readFileSync(fileURLToPath(new URL('../data/term-index.json', import.meta.url)), 'utf8'));
const terms = termsData.terms;
const index = indexData.terms;

describe('Search.buildSnippet 摘要与高亮', () => {
  it('真实 hallucination 查 "幻觉"：含 <mark>幻觉</mark>', () => {
    const term = terms.find(t => t.id === 'hallucination');
    const html = Search.buildSnippet(term, '幻觉', index);
    expect(html).toContain('<mark>幻觉</mark>');
  });

  it('合成长定义命中点居中：含省略号、去标记文本 ≤62 字、mark 位置在 20–40 之间', () => {
    const prefix = '一二三四五六七八九十'.repeat(14);
    const term = {
      id: 'long',
      name: 'Long',
      definition: prefix + 'prompt' + '一二三四五六七八九十'.repeat(10)
    };
    const html = Search.buildSnippet(term, 'prompt', null);
    expect(html).toContain('…');
    const stripped = html.replace(/<mark>(.*?)<\/mark>/g, '$1');
    expect(stripped.length).toBeLessThanOrEqual(62);
    const markStart = stripped.indexOf('prompt');
    expect(markStart).toBeGreaterThanOrEqual(20);
    expect(markStart).toBeLessThanOrEqual(40);
  });

  it('合成定义含两个 prompt：<mark> 恰好出现 2 次', () => {
    const term = { id: 'two', name: 'Two', definition: 'prompt 开头，中间 prompt 结尾' };
    const html = Search.buildSnippet(term, 'prompt', null);
    expect((html.match(/<mark>/g) || []).length).toBe(2);
  });

  it('注入：definition 含脚本标签时先转义后包 mark', () => {
    const term = { id: 'xss', name: 'XSS', definition: '<script>alert(1)</script> 后续文字让 alert 出现在片段中' };
    const html = Search.buildSnippet(term, 'alert', null);
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('<mark>alert</mark>');
    expect(html).not.toContain('<script>');
  });

  it('大小写不敏感：查 PROMPT 标出小写 prompt', () => {
    const term = { id: 'case', name: 'Case', definition: 'Use prompt here' };
    const html = Search.buildSnippet(term, 'PROMPT', null);
    expect(html).toContain('<mark>prompt</mark>');
  });

  it('纯拼音命中 fallback 到 name、无 mark、不抛错', () => {
    const term = terms.find(t => t.id === 'hallucination');
    const html = Search.buildSnippet(term, 'huanjue', index);
    expect(html).not.toContain('<mark>');
    expect(html).toContain('Hallucination');
  });

  it('多 token：prompt 工程 在 Prompt Engineering 片段里两个词都有 mark', () => {
    const term = terms.find(t => t.id === 'prompt-engineering');
    const html = Search.buildSnippet(term, 'prompt 工程', index);
    expect(html).toContain('<mark>prompt</mark>');
    expect(html).toContain('<mark>工程</mark>');
  });
});
