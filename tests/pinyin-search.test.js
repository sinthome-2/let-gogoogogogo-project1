import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

// 加载真实搜索模块
const searchSrc = readFileSync(fileURLToPath(new URL('../js/search.js', import.meta.url)), 'utf8');
const Search = vm.runInNewContext(searchSrc + '\n;Search', {});

// 加载真实数据与拼音索引
const termsData = JSON.parse(readFileSync(fileURLToPath(new URL('../data/terms.json', import.meta.url)), 'utf8'));
const indexData = JSON.parse(readFileSync(fileURLToPath(new URL('../data/term-index.json', import.meta.url)), 'utf8'));
const terms = termsData.terms;
const index = indexData.terms;

describe('Search.search 拼音/首字母索引', () => {
  it('huanjue → Hallucination', () => {
    const result = Search.search(terms, 'huanjue', index);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].name).toBe('Hallucination');
  });

  it('zhq → Transformer', () => {
    const result = Search.search(terms, 'zhq', index);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].name).toBe('Transformer');
  });

  it('zhuan huan qi → Transformer', () => {
    const result = Search.search(terms, 'zhuan huan qi', index);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].name).toBe('Transformer');
  });

  it('dmt → Multimodal', () => {
    const result = Search.search(terms, 'dmt', index);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].name).toBe('Multimodal');
  });

  it('无索引时返回结果与省略索引参数一致', () => {
    const withNull = Search.search(terms, 'huanjue', null);
    const omitted = Search.search(terms, 'huanjue');
    expect(withNull).toEqual([]);
    expect(omitted).toEqual([]);
    expect(withNull).toEqual(omitted);
  });

  it('索引缺少某 id 时不抛错，仍可命中 name', () => {
    const partialIndex = { ...index };
    delete partialIndex.llm;
    expect(() => Search.search(terms, 'llm', partialIndex)).not.toThrow();
    const result = Search.search(terms, 'llm', partialIndex);
    expect(result.map(t => t.name)).toContain('LLM');
  });

  it('空查询返回 []', () => {
    expect(Search.search(terms, '', index)).toEqual([]);
    expect(Search.search(terms, '   ', index)).toEqual([]);
    expect(Search.search(terms, null, index)).toEqual([]);
  });
});
