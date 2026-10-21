import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

// 加载 utils.js 中的 Utils 对象
const src = readFileSync(fileURLToPath(new URL('../js/utils.js', import.meta.url)), 'utf8');
const Utils = vm.runInNewContext(src + '\n;Utils', {
  setTimeout,
  clearTimeout
});

describe('Utils.parseHash', () => {
  it('用例1: 空 hash 返回 home', () => {
    expect(Utils.parseHash('')).toEqual({ view: 'home' });
    expect(Utils.parseHash('#')).toEqual({ view: 'home' });
    expect(Utils.parseHash('#/')).toEqual({ view: 'home' });
  });

  it('用例2: 解析词条详情 hash', () => {
    expect(Utils.parseHash('#term/skill')).toEqual({
      view: 'term',
      termId: 'skill'
    });
  });

  it('用例3: 解析分类 hash', () => {
    expect(Utils.parseHash('#category/technical/model-architecture')).toEqual({
      view: 'category',
      categoryId: 'technical',
      subcategoryId: 'model-architecture'
    });
  });

  it('用例4: 先 split 后 decode，处理含 / 或中文的搜索词', () => {
    // %E6%8F%90%E7%A4%BA = 提示
    expect(Utils.parseHash('#search/%E6%8F%90%E7%A4%BA')).toEqual({
      view: 'search',
      query: '提示'
    });

    // 含斜杠的搜索词：%2F 是 /，应先 split 再 decode，query 中保留 /
    expect(Utils.parseHash('#search/a%2Fb')).toEqual({
      view: 'search',
      query: 'a/b'
    });
  });
});

describe('Utils.debounce', () => {
  it('用例5: 防抖函数延迟执行', async () => {
    let count = 0;
    const fn = () => { count += 1; };
    const debounced = Utils.debounce(fn, 50);

    debounced();
    debounced();
    debounced();
    expect(count).toBe(0);

    await new Promise(resolve => setTimeout(resolve, 80));
    expect(count).toBe(1);
  });
});
