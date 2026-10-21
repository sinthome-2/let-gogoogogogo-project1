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

describe('GitHub Pages 部署流水线', () => {
  it('deploy.yml 含官方 action 引用与必要权限', () => {
    const yml = readRoot('.github/workflows/deploy.yml');
    expect(yml).toContain('actions/configure-pages@v5');
    expect(yml).toContain('actions/upload-pages-artifact@v4');
    expect(yml).toContain('actions/deploy-pages@v4');
    expect(yml).toContain('pages: write');
    expect(yml).toContain('id-token: write');
    expect(yml).toContain('workflow_dispatch');
    expect(yml).toMatch(/deploy:[\s\S]*?needs:\s*build/);
    expect(yml).toMatch(/environment:[\s\S]*?name:\s*github-pages/);
    expect(yml).toMatch(/path:\s*dist/);
  });

  it('deploy.yml 调用一致性检查脚本', () => {
    const yml = readRoot('.github/workflows/deploy.yml');
    expect(yml).toContain('node tools/ci-check.mjs');
  });

  it('ci-check.mjs 语法正确且含关键逻辑', () => {
    const src = readRoot('tools/ci-check.mjs');
    expect(src).toContain('term/');
    expect(src).toContain('dist');
    expect(src).toContain('git status --porcelain');
    expect(src).toMatch(/process\.exit\(1\)/);
  });

  it('dist 清单覆盖九类站点文件且均存在', () => {
    const src = readRoot('tools/ci-check.mjs');
    const match = src.match(/const SITE_FILES = ([\s\S]*?);/);
    expect(match).not.toBeNull();
    const files = JSON.parse(match[1].replace(/'/g, '"'));

    for (const file of files) {
      expect(existsRoot(file)).toBe(true);
    }

    expect(files.some(f => f === 'index.html')).toBe(true);
    expect(files.some(f => f.startsWith('css'))).toBe(true);
    expect(files.some(f => f.startsWith('js'))).toBe(true);
    expect(files.some(f => f.startsWith('assets'))).toBe(true);
    expect(files.some(f => f.startsWith('term'))).toBe(true);
    expect(files.some(f => f.includes('sitemap'))).toBe(true);
    expect(files.some(f => f === 'robots.txt')).toBe(true);
    expect(files.some(f => f === '.nojekyll')).toBe(true);
    expect(files.some(f => f === 'sw.js')).toBe(true);
  });
});
