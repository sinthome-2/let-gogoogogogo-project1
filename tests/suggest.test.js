import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const searchSrc = readFileSync(fileURLToPath(new URL('../js/search.js', import.meta.url)), 'utf8');
const Search = vm.runInNewContext(searchSrc + '\n;Search', {});

const termsData = JSON.parse(readFileSync(fileURLToPath(new URL('../data/terms.json', import.meta.url)), 'utf8'));
const indexData = JSON.parse(readFileSync(fileURLToPath(new URL('../data/term-index.json', import.meta.url)), 'utf8'));
const terms = termsData.terms;
const index = indexData.terms;

describe('Search.suggest 拼写建议', () => {
  it('transfomer → 首位 Transformer', () => {
    const result = Search.suggest(terms, 'transfomer', index);
    expect(result[0]?.name).toBe('Transformer');
  });

  it('zzzz → 返回空数组', () => {
    const result = Search.suggest(terms, 'zzzz', index);
    expect(result).toEqual([]);
  });

  it('距离恰好 2 收录、恰好 3 排除', () => {
    const synthetic = [{ id: 'abc', name: 'abc', aliases: [] }];
    expect(Search.suggest(synthetic, 'axd', null).map(t => t.id)).toContain('abc');
    expect(Search.suggest(synthetic, 'axde', null).map(t => t.id)).not.toContain('abc');
  });

  it('最多返回 3 条', () => {
    const synthetic = [
      { id: 'a', name: 'cat1', aliases: [] },
      { id: 'b', name: 'cat2', aliases: [] },
      { id: 'c', name: 'cat3', aliases: [] },
      { id: 'd', name: 'cat4', aliases: [] }
    ];
    const result = Search.suggest(synthetic, 'cat', null);
    expect(result.length).toBe(3);
  });

  it('距离小的排在距离大的前面', () => {
    const synthetic = [
      { id: 'dist2', name: 'c', aliases: [] },
      { id: 'dist0', name: 'cat', aliases: [] },
      { id: 'dist1', name: 'car', aliases: [] }
    ];
    const result = Search.suggest(synthetic, 'cat', null);
    const ids = result.map(t => t.id);
    expect(ids.indexOf('dist1')).toBeGreaterThan(ids.indexOf('dist0'));
    expect(ids.indexOf('dist2')).toBeGreaterThan(ids.indexOf('dist1'));
  });

  it('halucination → 建议含 Hallucination', () => {
    const result = Search.suggest(terms, 'halucination', index);
    expect(result.map(t => t.id)).toContain('hallucination');
  });

  it('首字母 dsmt + index → 建议含 Multimodal；不传 index 不抛错', () => {
    expect(Search.suggest(terms, 'dsmt', index).map(t => t.id)).toContain('multimodal');
    expect(() => Search.suggest(terms, 'dsmt', null)).not.toThrow();
  });
});
