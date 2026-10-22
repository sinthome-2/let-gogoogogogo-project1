// @vitest-environment jsdom
// T26 学习路径 + T31/T32/T33 内容批机检
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

function loadJSON(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const termsData = loadJSON('data/terms.json');
const terms = termsData.terms;
const termIds = new Set(terms.map(t => t.id));
const pathsData = loadJSON('data/learning-paths.json');

const NEW_IDS = [
  // T31 高引用缺口
  'generalization', 'training', 'uncertainty', 'reasoning', 'nlp', 'deployment',
  // T32 低引用缺口
  'autonomy', 'bert', 'classification', 'cognition', 'consciousness',
  'content-moderation', 'diffusion-model', 'digital-divide', 'dropout', 'ethics',
  'evaluation', 'factuality', 'fairness', 'feedback-loop', 'generative-ai', 'gpt',
  'gpu', 'information-extraction', 'information-theory', 'instruction-following',
  'intelligence', 'knowledge-graph', 'media-literacy', 'metrics', 'moderation',
  'neuron', 'optimization', 'philosophy-of-mind', 'preference-data', 'probability',
  'sampling', 'search', 'security', 'similarity-search', 'society-impact',
  'statistics', 'system', 'tool-use', 'top-p', 'understanding', 'validation',
  'voice-mode', 'algorithm',
  // T33 净新增
  'tokenization', 'top-k', 'epoch', 'batch-size', 'ai-governance'
];

describe('T31/T32/T33 新增词条完整性', () => {
  it('54 个新词条 id 全部收录且不撞车', () => {
    expect(NEW_IDS.length).toBe(54);
    expect(new Set(NEW_IDS).size).toBe(54);
    for (const id of NEW_IDS) {
      expect(termIds.has(id), `缺少词条 ${id}`).toBe(true);
    }
  });

  it('每个新词条都有非空 definition/tldr/examples', () => {
    for (const id of NEW_IDS) {
      const t = terms.find(x => x.id === id);
      expect(t.definition && t.definition.length > 20, `${id} definition 过短`).toBe(true);
      expect(t.tldr && t.tldr.length > 5, `${id} 缺 tldr`).toBe(true);
      expect(Array.isArray(t.examples) && t.examples.length >= 2, `${id} 缺 examples`).toBe(true);
    }
  });

  it('related/related_reading 全部指向存在的词条（悬空为 0）', () => {
    for (const t of terms) {
      for (const r of t.related || []) {
        expect(termIds.has(r), `${t.id} 悬空引用 ${r}`).toBe(true);
      }
      for (const r of t.related_reading || []) {
        expect(termIds.has(r), `${t.id} 悬空 reading ${r}`).toBe(true);
      }
    }
  });

  it('别名不与既有词条 name/alias 冲突', () => {
    const seen = new Map();
    for (const t of terms) {
      const names = [t.name, ...(t.aliases || [])];
      for (const n of names) {
        const key = String(n).toLowerCase();
        expect(seen.has(key), `别名冲突: ${n}（${seen.get(key)} vs ${t.id}）`).toBe(false);
        seen.set(key, t.id);
      }
    }
  });
});

describe('T26 学习路径', () => {
  it('learning-paths.json 结构合法：paths 非空、字段齐全', () => {
    expect(Array.isArray(pathsData.paths)).toBe(true);
    expect(pathsData.paths.length).toBeGreaterThanOrEqual(3);
    for (const p of pathsData.paths) {
      expect(p.id && p.name && p.description).toBeTruthy();
      expect(Array.isArray(p.steps) && p.steps.length >= 5, `${p.id} 步骤太少`).toBe(true);
    }
  });

  it('所有路径步骤指向已存在词条且无重复', () => {
    const all = [];
    for (const p of pathsData.paths) {
      for (const s of p.steps) {
        expect(termIds.has(s), `路径 ${p.id} 引用不存在词条 ${s}`).toBe(true);
        all.push(s);
      }
    }
    expect(new Set(all).size).toBe(all.length);
  });

  it('app.js 加载并渲染学习路径', () => {
    const src = readFileSync('js/app.js', 'utf8');
    expect(src).toContain("fetch('data/learning-paths.json')");
    expect(src).toContain("class=\"learning-paths\"");
    expect(src).toContain('state.paths');
  });

  it('样式文件含学习路径规则', () => {
    const css = readFileSync('css/style.css', 'utf8');
    expect(css).toContain('.learning-path');
    expect(css).toContain('.path-steps');
  });
});

describe('计数纪律', () => {
  it('源码任何处不得出现硬编码词条总数', () => {
    const combined = readFileSync('js/app.js', 'utf8') + readFileSync('index.html', 'utf8');
    expect(combined).not.toMatch(/\d{3,}\s*个词条/);
  });
});
