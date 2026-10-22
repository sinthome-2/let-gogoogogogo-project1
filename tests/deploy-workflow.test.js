import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
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

/**
 * 极简 GitHub Actions 工作流解析器（零依赖）。
 * 只提取判断「门禁是否真的成立」所需的四类事实：job 名、needs、run 文本、continue-on-error。
 * 目的：断言依赖图结构，而不是拿正则去撞文本——文本断言会把 bug 锁成期望。
 */
function parseWorkflow(yml) {
  const lines = yml.split(/\r?\n/).map(l => l.replace(/\t/g, '  '));
  const jobs = {};
  let inJobs = false;
  let cur = null;
  let mode = null; // 'needs' | 'steps' | null

  for (const line of lines) {
    if (/^jobs:\s*$/.test(line)) { inJobs = true; continue; }
    if (!inJobs) continue;
    if (/^\S/.test(line) && !/^\s*#/.test(line)) { inJobs = false; cur = null; continue; }

    const job = line.match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
    if (job) {
      cur = job[1];
      jobs[cur] = { needs: [], runs: [], continueOnError: false, condition: '' };
      mode = null;
      continue;
    }
    if (!cur) continue;

    if (/^ {4}steps:\s*$/.test(line)) { mode = 'steps'; continue; }

    if (/^ {4}needs:\s*$/.test(line)) { mode = 'needs'; continue; }
    const inlineNeeds = line.match(/^ {4}needs:\s*\[(.*)\]\s*$/);
    if (inlineNeeds) {
      jobs[cur].needs.push(...inlineNeeds[1].split(',').map(s => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean));
      mode = null;
      continue;
    }
    const scalarNeeds = line.match(/^ {4}needs:\s*([A-Za-z0-9_-]+)\s*$/);
    if (scalarNeeds) { jobs[cur].needs.push(scalarNeeds[1]); mode = null; continue; }

    if (/^ {4}continue-on-error:\s*true/.test(line)) jobs[cur].continueOnError = true;
    const cond = line.match(/^ {4}if:\s*(.+)$/);
    if (cond) jobs[cur].condition = cond[1].trim();

    if (mode === 'needs') {
      const item = line.match(/^ {6}- ([A-Za-z0-9_-]+)\s*$/);
      if (item) { jobs[cur].needs.push(item[1]); continue; }
      if (/^ {4}\S/.test(line)) mode = null;
    }

    const run = line.match(/^ {8}run:\s*(.+)$/);
    if (run) { jobs[cur].runs.push(run[1]); continue; }
    if (mode === 'steps' && /^ {10}\S/.test(line) && jobs[cur].runs.length) {
      jobs[cur].runs[jobs[cur].runs.length - 1] += ' ' + line.trim();
    }
  }
  return jobs;
}

/** 从 start 出发的传递依赖闭包（含 start 自身） */
function closure(jobs, start) {
  const seen = new Set();
  const stack = [start];
  while (stack.length) {
    const name = stack.pop();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const job = jobs[name];
    if (job) stack.push(...job.needs);
  }
  return seen;
}

function runsCommand(jobs, name, pattern) {
  const job = jobs[name];
  if (!job) return false;
  return job.runs.some(cmd => pattern.test(cmd));
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
    expect(yml).toMatch(/environment:[\s\S]*?name:\s*github-pages/);
    expect(yml).toMatch(/path:\s*dist/);
  });

  it('deploy.yml 能被解析出 build 与 deploy 两个 job', () => {
    const jobs = parseWorkflow(readRoot('.github/workflows/deploy.yml'));
    expect(Object.keys(jobs)).toEqual(expect.arrayContaining(['build', 'deploy']));
    expect(jobs.deploy.needs.length).toBeGreaterThan(0);
  });

  it('门禁成立：deploy 的传递依赖里必须真的跑 test 与 validate', () => {
    const jobs = parseWorkflow(readRoot('.github/workflows/deploy.yml'));
    const chain = closure(jobs, 'deploy');

    const testJob = [...chain].find(n => runsCommand(jobs, n, /\bp?npm\s+(run\s+)?test\b|\bvitest\b/));
    const validateJob = [...chain].find(n => runsCommand(jobs, n, /\bp?npm\s+(run\s+)?validate\b|tools\/validate\.mjs/));

    expect(testJob, 'deploy 的依赖链上没有任何 job 执行测试，测试红着也能上线').toBeTruthy();
    expect(validateJob, 'deploy 的依赖链上没有任何 job 执行 validate').toBeTruthy();
    expect(testJob, 'test 与 validate 必须在同一个 job 内执行，否则可能一个没跑完另一个就放行').toBe(validateJob);
  });

  it('依赖链上不允许 continue-on-error 或条件静默跳过', () => {
    const jobs = parseWorkflow(readRoot('.github/workflows/deploy.yml'));
    for (const name of closure(jobs, 'deploy')) {
      const job = jobs[name];
      if (!job) continue;
      expect(job.continueOnError, `${name} 允许失败后继续，等于门禁形同虚设`).toBe(false);
      expect(/^\s*false\s*$|always\(\)\s*==\s*false/.test(job.condition), `${name} 的 if 条件可能被写死为假`).toBe(false);
    }
  });

  it('deploy.yml 调用一致性检查脚本', () => {
    const yml = readRoot('.github/workflows/deploy.yml');
    expect(yml).toContain('node tools/ci-check.mjs');
  });

  it('ci.yml 作为 PR 门禁，同样执行 test 与 validate', () => {
    const jobs = parseWorkflow(readRoot('.github/workflows/ci.yml'));
    const names = Object.keys(jobs);
    const hasTest = names.some(n => runsCommand(jobs, n, /\bp?npm\s+(run\s+)?test\b|\bvitest\b/));
    const hasValidate = names.some(n => runsCommand(jobs, n, /\bp?npm\s+(run\s+)?validate\b|tools\/validate\.mjs/));
    expect(hasTest).toBe(true);
    expect(hasValidate).toBe(true);
  });

  it('ci-check.mjs 语法正确且含关键逻辑', () => {
    const src = readRoot('tools/ci-check.mjs');
    expect(src).toContain('term/');
    expect(src).toContain('dist');
    // 生成物一致性必须按**内容**比较：git status 会被 mtime/换行归一化弄脏，
    // 在这台 Windows 上即使逐字节相同也会报 M，导致门禁误杀（实测 156 个页面）。
    expect(src).toContain('git diff --name-only');
    expect(src).not.toContain('git status --porcelain');
    expect(src).toMatch(/process\.exit\(1\)/);
  });

  it('dist 清单覆盖仓库根目录下所有 html 页面', () => {
    const src = readRoot('tools/ci-check.mjs');
    const match = src.match(/const SITE_FILES = \[([\s\S]*?)\];/);
    expect(match).not.toBeNull();
    const files = match[1]
      .split(',')
      .map(s => s.trim().replace(/^['"`]|['"`]$/g, ''))
      .filter(Boolean);

    const rootHtml = readdirSync(rootDir).filter(f => f.endsWith('.html'));
    expect(rootHtml.length).toBeGreaterThan(1);
    for (const page of rootHtml) {
      expect(files, `根目录页面 ${page} 未进入 dist，线上永远拿不到它`).toContain(page);
    }
  });

  it('SITE_FILES 每项在仓库中真实存在', () => {
    const src = readRoot('tools/ci-check.mjs');
    const match = src.match(/const SITE_FILES = \[([\s\S]*?)\];/);
    const files = match[1]
      .split(',')
      .map(s => s.trim().replace(/^['"`]|['"`]$/g, ''))
      .filter(Boolean);
    for (const file of files) {
      expect(existsRoot(file), `SITE_FILES 里的 ${file} 不存在`).toBe(true);
    }
  });
});