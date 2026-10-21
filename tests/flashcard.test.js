// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

function readRoot(file) {
  return readFileSync(join(rootDir, file), 'utf8');
}

function loadFlashcards() {
  const src = readRoot('js/flashcard.js');
  new Function(src)();
}

function seededRng(seed) {
  return function () {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

describe('Flashcards 调度', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    loadFlashcards();
  });

  it('pickRound 不重复且长度 == min(size, 候选数)，同种子结果确定', () => {
    const candidates = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
    const rng = seededRng(42);
    const round = window.Flashcards.pickRound(candidates, 3, rng);
    expect(round.length).toBe(3);
    expect(new Set(round.map(t => t.id)).size).toBe(3);

    const rng2 = seededRng(42);
    const round2 = window.Flashcards.pickRound(candidates, 3, rng2);
    expect(round2.map(t => t.id)).toEqual(round.map(t => t.id));
  });

  it('gradeTerm 答错进错题本、答对移出、重复答错不重复', () => {
    let wrong = ['x'];
    wrong = window.Flashcards.gradeTerm('a', false, wrong);
    expect(wrong.sort()).toEqual(['a', 'x']);
    wrong = window.Flashcards.gradeTerm('a', false, wrong);
    expect(wrong.sort()).toEqual(['a', 'x']);
    wrong = window.Flashcards.gradeTerm('a', true, wrong);
    expect(wrong.sort()).toEqual(['x']);
  });

  it('nextCandidates 把错题全部排在候选前部', () => {
    const allTerms = [
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
      { id: 'd' }
    ];
    const wrongIds = ['c', 'a'];
    const candidates = window.Flashcards.nextCandidates(allTerms, wrongIds);
    const front = candidates.slice(0, wrongIds.length);
    const frontIds = front.map(t => t.id);
    expect(new Set(frontIds)).toEqual(new Set(wrongIds));
    expect(frontIds.length).toBe(wrongIds.length);
  });

  it('ROUND_SIZE 为 10', () => {
    expect(window.Flashcards.ROUND_SIZE).toBe(10);
  });
});

describe('Flashcards 集成', () => {
  it('flashcards.html 存在且含 data-flashcard 容器与脚本引用', () => {
    const html = readRoot('flashcards.html');
    expect(html).toContain('data-flashcard');
    expect(html).toContain('js/flashcard.js');
    expect(html).toContain('css/style.css');
  });

  it('index.html 含闪卡练习链接', () => {
    const html = readRoot('index.html');
    expect(html).toContain('flashcards.html');
    expect(html).toContain('aria-label="闪卡练习"');
  });

  it('sw.js PRECACHE_URLS 含闪卡相关文件且磁盘存在', () => {
    const sw = readRoot('sw.js');
    const match = sw.match(/const PRECACHE_URLS = ([\s\S]*?);/);
    expect(match).not.toBeNull();
    const urls = JSON.parse(match[1].replace(/'/g, '"'));
    expect(urls).toContain('flashcards.html');
    expect(urls).toContain('js/flashcard.js');
    for (const url of urls) {
      const path = url === './' ? 'index.html' : url;
      expect(existsSync(join(rootDir, path))).toBe(true);
    }
  });
});
