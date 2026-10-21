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

describe('Search.search 多关键词与字段扩容', () => {
  it('多关键词 AND：prompt engineering 命中 Prompt Engineering', () => {
    const result = Search.search(terms, 'prompt engineering', index);
    expect(result.map(t => t.id)).toContain('prompt-engineering');
  });

  it('多关键词 AND：engineering prompt 同样命中（不要求顺序）', () => {
    const result = Search.search(terms, 'engineering prompt', index);
    expect(result.map(t => t.id)).toContain('prompt-engineering');
  });

  it('多关键词 AND：只含其中一个词的词条不出现在结果中', () => {
    const result = Search.search(terms, 'prompt engineering', index);
    const ids = result.map(t => t.id);
    // prompt 单独出现的词条很多，但 engineering 不出现的应被过滤
    expect(ids).not.toContain('prompt');
  });

  it('字段扩容：GPT-4 命中 LLM（出现在 LLM 的示例中）', () => {
    const result = Search.search(terms, 'GPT-4', index);
    expect(result.map(t => t.id)).toContain('llm');
  });

  it('引号短语："GPT-4o" 命中 Multimodal（示例中含 GPT-4o）', () => {
    const result = Search.search(terms, '"GPT-4o"', index);
    expect(result.map(t => t.id)).toContain('multimodal');
  });

  it('引号短语：只匹配完整短语，拆分后不相关词条不应靠前', () => {
    const result = Search.search(terms, '"large language"', index);
    expect(result.map(t => t.id)).toContain('llm');
  });

  it('phrase 跨标点："chain of thought" 命中 chain-of-thought', () => {
    const result = Search.search(terms, '"chain of thought"', index);
    expect(result.map(t => t.id)).toContain('chain-of-thought');
  });

  it('phrase 不跨字段匹配：拆分在 definition 中的词不会被引号串命中', () => {
    const synthetic = [
      { id: 'scatter', name: 'Scatter', definition: 'chain 一段 of 叙述 thought 分散' }
    ];
    const quoted = Search.search(synthetic, '"chain of thought"', null);
    const unquoted = Search.search(synthetic, 'chain of thought', null);
    expect(quoted.map(t => t.id)).not.toContain('scatter');
    expect(unquoted.map(t => t.id)).toContain('scatter');
  });

  it('字段扩容：无拼音索引时 acronym / nameZh / _subcategoryName 仍可命中', () => {
    const synthetic = [
      { id: 'alpha', name: 'Alpha', acronym: 'TCA' },
      { id: 'beta', name: 'Beta', nameZh: '图灵测试' },
      { id: 'gamma', name: 'Gamma', _subcategoryName: '模型架构' }
    ];
    expect(Search.search(synthetic, 'tca', null).map(t => t.id)).toContain('alpha');
    expect(Search.search(synthetic, '图灵', null).map(t => t.id)).toContain('beta');
    expect(Search.search(synthetic, '模型架构', null).map(t => t.id)).toContain('gamma');
  });

  it('中英混合查询：prompt 工程 首位为 prompt-engineering', () => {
    const result = Search.search(terms, 'prompt 工程', index);
    expect(result[0]?.id).toBe('prompt-engineering');
  });

  it('同分 tie-break：按 name 词数升序', () => {
    const synthetic = [
      { id: 'two-words', name: 'Two Words', definition: 'foo bar' },
      { id: 'one', name: 'One', definition: 'foo bar' }
    ];
    const result = Search.search(synthetic, 'foo bar', null);
    expect(result.map(t => t.id)).toEqual(['one', 'two-words']);
  });
});
