import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

// 加载真实源码：js/search.js 是 classic script（IIFE 赋给 const Search），
// 用 node:vm 在隔离上下文中执行原文，取回 Search 对象。
const src = readFileSync(fileURLToPath(new URL('../js/search.js', import.meta.url)), 'utf8');
const Search = vm.runInNewContext(src + '\n;Search', {});

describe('Search.search', () => {
  it('用例1: 空查询与空词条数组都返回 []', () => {
    const terms = [{ name: 'Prompt' }];
    expect(Search.search(terms, '')).toEqual([]);
    expect(Search.search(terms, '   ')).toEqual([]);
    expect(Search.search(terms, null)).toEqual([]);
    expect(Search.search([], 'prompt')).toEqual([]);
  });

  it('用例2: name 精确匹配返回该词条', () => {
    const terms = [{ name: 'Prompt' }];
    expect(Search.search(terms, 'prompt')).toHaveLength(1);
  });

  it('用例3: name 分数阶梯（精确 > 前缀），结果按分数降序排列', () => {
    const terms = [
      { name: 'Prompt Engineering' },
      { name: 'Prompt Template' },
      { name: 'Prompt' },
    ];
    const result = Search.search(terms, 'prompt');
    expect(result.map(t => t.name)).toEqual([
      'Prompt',
      'Prompt Engineering',
      'Prompt Template',
    ]);
  });

  it('用例4: 别名整串精确匹配（60 分）排在 definition 命中（10 分）之前', () => {
    const terms = [
      { name: 'Other', definition: '提示词说明' },
      { name: 'Skill', aliases: ['提示词'] },
    ];
    const result = Search.search(terms, '提示词');
    expect(result[0].name).toBe('Skill');
  });

  it('用例5: 别名多值以空格拼接后包含命中（30 分），排在仅 definition 命中的词条之前', () => {
    const terms = [
      { name: 'Doc', definition: '一种能力描述' },
      { name: 'Skill', aliases: ['技能', '能力'] },
    ];
    const result = Search.search(terms, '能力');
    const names = result.map(t => t.name);
    expect(names).toContain('Skill');
    expect(names.indexOf('Skill')).toBeLessThan(names.indexOf('Doc'));
  });

  it('用例6: 仅 definition 命中时仍返回该词条', () => {
    const terms = [{ name: 'Doc', definition: '这是提示词' }];
    const result = Search.search(terms, '提示词');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Doc');
  });

  it('用例7: 无任何匹配返回 []', () => {
    const terms = [{ name: 'Prompt' }];
    expect(Search.search(terms, 'zzz')).toEqual([]);
  });

  it('用例8: 同分结果保持稳定序（按原始数组顺序）', () => {
    const terms = [
      { name: 'X', definition: 'contains foo here' },
      { name: 'Y', definition: 'also foo there' },
    ];
    const result = Search.search(terms, 'foo');
    expect(result.map(t => t.name)).toEqual(['X', 'Y']);
  });

  it('用例9: 字段缺失（无 aliases、无 definition）不抛错且正常命中', () => {
    const terms = [{ name: 'Prompt' }];
    let result;
    expect(() => {
      result = Search.search(terms, 'prompt');
    }).not.toThrow();
    expect(result).toHaveLength(1);
  });

  it('用例10: 查询归一化（忽略大小写与首尾空白）', () => {
    const terms = [{ name: 'Prompt' }];
    const upper = Search.search(terms, 'PROMPT');
    const padded = Search.search(terms, '  prompt  ');
    expect(upper).toHaveLength(1);
    expect(padded).toHaveLength(1);
    expect(upper).toEqual(padded);
  });
});
