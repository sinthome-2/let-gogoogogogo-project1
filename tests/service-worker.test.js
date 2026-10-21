import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

function readRoot(file) {
  return readFileSync(join(rootDir, file), 'utf8');
}

function existsRoot(file) {
  return existsSync(join(rootDir, file));
}

async function fetchSource() {
  const url = 'https://raw.githubusercontent.com/GoogleChrome/samples/gh-pages/service-worker/basic/service-worker.js';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch source: ${res.status}`);
  return res.text();
}

describe('Service Worker', () => {
  it('sw.js 含 Apache 许可证头、Derived-from 行与三个事件监听器', () => {
    const sw = readRoot('sw.js');
    expect(sw).toContain('Apache License');
    expect(sw).toContain('Copyright 2016 Google');
    expect(sw).toContain('Derived from GoogleChrome/samples (gh-pages), Apache-2.0');
    expect(sw).toContain("self.addEventListener('install'");
    expect(sw).toContain("self.addEventListener('activate'");
    expect(sw).toContain("self.addEventListener('fetch'");
  });

  it('PRECACHE_URLS 可解析、文件均存在且覆盖四类资源', () => {
    const sw = readRoot('sw.js');
    const match = sw.match(/const PRECACHE_URLS = ([\s\S]*?);/);
    expect(match).not.toBeNull();
    const urls = JSON.parse(match[1].replace(/'/g, '"'));
    for (const url of urls) {
      const path = url === './' ? 'index.html' : url;
      expect(existsRoot(path)).toBe(true);
    }
    expect(urls.some(u => u === 'index.html' || u === './')).toBe(true);
    expect(urls.some(u => u.startsWith('css/'))).toBe(true);
    expect(urls.some(u => u.startsWith('js/'))).toBe(true);
    expect(urls.some(u => u.startsWith('assets/'))).toBe(true);
  });

  it('缓存名符合规范且常量定义不含旧名', () => {
    const sw = readRoot('sw.js');
    const lines = sw.split('\n');
    const precacheLine = lines.find(l => l.includes('const PRECACHE'));
    const runtimeLine = lines.find(l => l.includes('const RUNTIME'));
    expect(precacheLine).toMatch(/const PRECACHE = 'ai-dict-precache-v\d+';/);
    expect(runtimeLine).toMatch(/const RUNTIME = 'ai-dict-runtime';/);
    expect(precacheLine).not.toContain("'precache-v1'");
    expect(runtimeLine).not.toContain("'runtime'");
  });

  it('js/app.js 含 serviceWorker.register 与守卫', () => {
    const app = readRoot('js/app.js');
    expect(app).toContain("'serviceWorker' in navigator");
    expect(app).toContain("serviceWorker.register('sw.js')");
  });

  it('sw.js 代码行序列与搬运源一致', async () => {
    const sw = readRoot('sw.js');
    const source = await fetchSource();

    function extractCodeLines(text) {
      return text
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('//'));
    }

    function dropUrlsBlock(lines) {
      const start = lines.findIndex(l => l.includes('const PRECACHE_URLS'));
      const end = lines.findIndex((l, i) => i > start && l === '];');
      if (start === -1 || end === -1) return lines;
      return [...lines.slice(0, start), '/* PRECACHE_URLS */', ...lines.slice(end + 1)];
    }

    const swLines = dropUrlsBlock(extractCodeLines(sw));
    const sourceLines = dropUrlsBlock(extractCodeLines(source));

    const normalize = lines => lines
      .map(l => l.replace(/'ai-dict-precache-v\d+'/, "'PRECACHE'"))
      .map(l => l.replace(/'ai-dict-runtime'/, "'RUNTIME'"))
      .map(l => l.replace(/'precache-v1'/, "'PRECACHE'"))
      .map(l => l.replace(/'runtime'/, "'RUNTIME'"));

    expect(normalize(swLines)).toEqual(normalize(sourceLines));
  });
});
