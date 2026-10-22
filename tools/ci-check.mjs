/**
 * CI 一致性检查与 dist 暂存
 * 思路：跑完 build-pages 后工作区应无 diff；然后将站点文件复制到 dist/ 供上传。
 */
import { existsSync, cpSync, mkdirSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const SITE_FILES = [
  'index.html',
  'flashcards.html',
  'css',
  'js',
  'assets',
  'term',
  'sitemap.xml',
  'robots.txt',
  '.nojekyll',
  'sw.js'
];

const porcelain = execSync('git diff --name-only -- term/ sitemap.xml robots.txt', { encoding: 'utf8' });
if (porcelain.trim()) {
  console.error('生成物与提交不一致，请先本地跑 build-pages 并提交');
  process.exit(1);
}

if (existsSync('dist')) rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });

for (const file of SITE_FILES) {
  if (!existsSync(file)) {
    console.error(`缺失站点文件：${file}`);
    process.exit(1);
  }
  cpSync(file, join('dist', file), { recursive: true });
}

console.log('CLEAN');
