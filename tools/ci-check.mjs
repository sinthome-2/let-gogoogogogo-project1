/**
 * CI 一致性检查与 dist 暂存
 * 思路：跑完 build-pages 后，生成物必须与已提交内容完全一致；然后把站点文件复制到 dist/ 供上传。
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

const GENERATED = 'term sitemap.xml robots.txt';
const git = (cmd) => {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    return (err.stdout || '').toString().trim();
  }
};

// 生成物必须已提交。下面三条命令的并集等价于「工作区与 HEAD 的内容差异」：
//   1. git diff         —— 工作区 vs 索引（已改未暂存）
//   2. git diff --cached —— 索引 vs HEAD（已暂存未提交）
//   3. git ls-files --others —— 未跟踪的新文件
// 不能只用 git status：在 Windows + core.autocrlf 环境下，
// 它对逐字节相同的文件也会报 M（实测 156 个页面），会让门禁恒假。
// 也不能只用 git diff：它会漏掉后两类，新生成的页面从未 add 过就会静默放行。
const changed = [
  git(`git diff --name-only -- ${GENERATED}`),
  git(`git diff --cached --name-only -- ${GENERATED}`),
  git(`git ls-files --others --exclude-standard -- ${GENERATED}`)
].filter(Boolean);

if (changed.length) {
  console.error('生成物与提交不一致，请先本地跑 build-pages 并提交：');
  console.error(changed.join('\n'));
  process.exit(1);
}

if (existsSync('dist')) rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });

for (const file of SITE_FILES) {
  if (!existsSync(file)) {
    console.error(`缺少站点文件：${file}`);
    process.exit(1);
  }
  cpSync(file, join('dist', file), { recursive: true });
}

console.log('CLEAN');