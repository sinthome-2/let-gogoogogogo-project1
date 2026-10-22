#!/usr/bin/env node
/**
 * tools/status.mjs —— 一屏世界状态（只读）
 *
 * 设计约束：只读文件系统与 git，**不调用任何模型、不写任何文件**。
 * 因此它永远比「模型记得什么」可靠。会话启动第一件事就是跑它。
 *
 * 用法： node tools/status.mjs
 * 退出码：0 正常；1 当前目录不是 git 仓库
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const RUNS = join(ROOT, 'runs');

function git(...args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).replace(/\s+$/, '');
  } catch (err) {
    return err && err.status === 1 ? '' : `(git 失败: ${args.join(' ')} → ${err.status})`;
  }
}

function line(title) {
  console.log(`\n== ${title} ==`);
}

if (git('rev-parse', '--is-inside-work-tree') !== 'true') {
  console.error(`不是 git 仓库：${ROOT}`);
  process.exit(1);
}

/* ---------- 仓库 ---------- */
line('仓库');
const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
const head = git('log', '-1', '--format=%h %s');
const dirty = git('status', '--porcelain');
const dirtyCount = dirty ? dirty.split('\n').filter(Boolean).length : 0;
console.log(`root:   ${ROOT}`);
console.log(`branch: ${branch}`);
console.log(`head:   ${head}`);
console.log(`dirty:  ${dirtyCount} 个文件${dirtyCount ? '' : '（干净）'}`);
if (dirtyCount) {
  for (const f of dirty.split('\n').slice(0, 10)) console.log(`  ${f}`);
  if (dirtyCount > 10) console.log(`  … 另有 ${dirtyCount - 10} 项`);
}

/* ---------- 工作树 ---------- */
line('工作树');
const wtRaw = git('worktree', 'list', '--porcelain').split('\n');
let cur = null;
const worktrees = [];
for (const raw of wtRaw) {
  const s = raw.trim();
  if (s.startsWith('worktree ')) cur = { path: s.slice(9), head: '', branch: '' };
  else if (cur && s.startsWith('HEAD ')) cur.head = s.slice(5, 12);
  else if (cur && s.startsWith('branch ')) cur.branch = s.slice(7).replace('refs/heads/', '');
  else if (cur && s === 'detached') cur.branch = '(detached)';
  else if (s === '' && cur) {
    worktrees.push(cur);
    cur = null;
  }
}
if (cur) worktrees.push(cur);
for (const wt of worktrees) {
  let state = '?';
  try {
    const out = execFileSync('git', ['-C', wt.path, 'status', '--porcelain'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const n = out.split('\n').filter(Boolean).length;
    state = n === 0 ? 'clean' : `dirty(${n})`;
  } catch {
    state = 'missing';
  }
  console.log(`${wt.path}  ${wt.branch}  ${wt.head}  ${state}`);
}

/* ---------- 分支 ---------- */
line('分支');
const baseBranch = existsSync(join(ROOT, '.git')) ? 'main' : branch;
const unmerged = git('branch', '--no-merged', baseBranch).split('\n').filter((s) => s.trim()).map((s) => s.replace(/^\*?\s*/, ''));
const merged = git('branch', '--merged', baseBranch).split('\n').filter((s) => s.trim()).map((s) => s.replace(/^\*?\s*/, '')).filter((b) => b !== baseBranch);
console.log(`未合入 ${baseBranch}: ${unmerged.length ? unmerged.join(', ') : '（无）'}`);
console.log(`已合入未删: ${merged.length}${merged.length ? `（如 ${merged.slice(0, 5).join(', ')}…）` : ''}`);

/* ---------- runs ---------- */
line('runs/');
if (!existsSync(RUNS)) {
  console.log('（不存在：尚未初始化交接目录）');
} else {
  const lock = join(RUNS, '.lock');
  if (existsSync(lock)) {
    try {
      const j = JSON.parse(readFileSync(lock, 'utf8'));
      const ageH = ((Date.now() - new Date(j.started_at).getTime()) / 3600000).toFixed(1);
      console.log(`lock: ${j.session_id} @ ${j.host} · ${j.task_id} · ${ageH}h 前${Number(ageH) > 4 ? '（疑似残留，先问人）' : '（有人在做，勿动手）'}`);
    } catch {
      console.log('lock: 存在但无法解析');
    }
  } else {
    console.log('lock: 无');
  }

  const batchesDir = join(RUNS, 'batches');
  if (existsSync(batchesDir)) {
    const batches = readdirSync(batchesDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
    for (const b of batches) {
      const dir = join(batchesDir, b);
      const tasks = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
      const states = tasks.map((t) => {
        const p = join(dir, t, 'state.json');
        if (!existsSync(p)) return `${t}:?`;
        try {
          return `${t}:${JSON.parse(readFileSync(p, 'utf8')).state || '?'}`;
        } catch {
          return `${t}:bad-json`;
        }
      });
      console.log(`batch ${b}: ${states.length ? states.join('  ') : '（空）'}`);
    }
  }
  const handoff = join(RUNS, 'HANDOFF.md');
  console.log(`HANDOFF: ${existsSync(handoff) ? `${readFileSync(handoff, 'utf8').split('\n').length} 行` : '缺失'}`);
}

/* ---------- 下一步 ---------- */
line('下一步');
console.log('读 runs/HANDOFF.md 的「下一步第一条命令」，然后复述校验。');
