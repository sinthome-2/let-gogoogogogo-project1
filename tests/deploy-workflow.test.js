import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync, appendFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

const readRoot = (file) => readFileSync(join(rootDir, file), 'utf8');

/**
 * 极简 GitHub Actions 解析器（零依赖）。
 * 提取：job 名、needs、job 级 if/continue-on-error、每个 step 的 run/if/continue-on-error。
 * 目的：断言依赖图与跳过条件，而不是拿正则撞文本——文本断言会把写法锁死。
 */
function parseWorkflow(yml) {
  const lines = yml.split(/\r?\n/).map((l) => l.replace(/\t/g, '  '));
  const jobs = {};
  let inJobs = false;
  let job = null;
  let inSteps = false;
  let step = null;
  let blockIndent = -1;

  const newStep = () => ({ run: '', condition: '', cont: false });

  for (const line of lines) {
    if (/^jobs:\s*$/.test(line)) { inJobs = true; continue; }
    if (!inJobs) continue;
    if (/^\S/.test(line)) { inJobs = false; job = null; continue; }

    const head = line.match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
    if (head) {
      job = head[1];
      jobs[job] = { needs: [], condition: '', cont: false, steps: [] };
      inSteps = false;
      step = null;
      continue;
    }
    if (!job) continue;

    if (/^ {4}steps:\s*$/.test(line)) { inSteps = true; continue; }

    if (/^ {4}needs:\s*$/.test(line)) continue;
    const inlineNeeds = line.match(/^ {4}needs:\s*\[(.*)\]\s*$/);
    if (inlineNeeds) {
      jobs[job].needs.push(...inlineNeeds[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean));
      continue;
    }
    const scalarNeeds = line.match(/^ {4}needs:\s*([A-Za-z0-9_-]+)\s*$/);
    if (scalarNeeds) { jobs[job].needs.push(scalarNeeds[1]); continue; }
    const listNeeds = line.match(/^ {6}- ([A-Za-z0-9_-]+)\s*$/);
    if (listNeeds && !inSteps) { jobs[job].needs.push(listNeeds[1]); continue; }

    const jobCond = line.match(/^ {4}if:\s*(.+)$/);
    if (jobCond) { jobs[job].condition = jobCond[1].trim(); continue; }
    if (/^ {4}continue-on-error:\s*true/.test(line)) { jobs[job].cont = true; continue; }

    if (!inSteps) continue;

    if (/^ {6}-\s/.test(line) || /^ {6}-\s*$/.test(line)) {
      step = newStep();
      jobs[job].steps.push(step);
      blockIndent = -1;
      const inline = line.match(/^ {6}-\s+(.*)$/);
      if (inline) applyStepKey(step, inline[1], '');
      continue;
    }
    if (!step) continue;

    if (blockIndent >= 0) {
      if (line.trim() === '' || (line.match(/^ */)[0].length) >= blockIndent) {
        step.run += '\n' + line.trim();
        continue;
      }
      blockIndent = -1;
    }

    const kv = line.match(/^ {8}([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    const [, key, value] = kv;
    if (key === 'run' && value === '') { blockIndent = 10; continue; }
    applyStepKey(step, `${key}: ${value}`, '');
  }

  function applyStepKey(target, text, _unused) {
    const kv = text.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) return;
    const [, key, value] = kv;
    if (key === 'run') target.run = value;
    else if (key === 'if') target.condition = value.trim();
    else if (key === 'continue-on-error') target.cont = /^true$/i.test(value.trim());
  }

  return jobs;
}

function closure(jobs, start) {
  const seen = new Set();
  const stack = [start];
  while (stack.length) {
    const name = stack.pop();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    if (jobs[name]) stack.push(...jobs[name].needs);
  }
  return seen;
}

const isTestCmd = (cmd) => /\bp?npm\s+(run\s+)?test\b|\bvitest\b/.test(cmd);
const isValidateCmd = (cmd) => /\bp?npm\s+(run\s+)?validate\b|tools\/validate\.mjs/.test(cmd);
const isFalsy = (cond) => {
  if (!cond) return false;
  const c = cond.replace(/\$\{\{|\}\}/g, '').trim();
  return /^(false|0)$/.test(c) || /^0\s*==\s*1$/.test(c);
};

describe('GitHub Pages 部署流水线', () => {
  it('deploy.yml 引用官方 action 且声明必要权限', () => {
    const yml = readRoot('.github/workflows/deploy.yml');
    expect(yml).toMatch(/actions\/configure-pages@v\d+/);
    expect(yml).toMatch(/actions\/upload-pages-artifact@v\d+/);
    expect(yml).toMatch(/actions\/deploy-pages@v\d+/);
    expect(yml).toContain('pages: write');
    expect(yml).toContain('id-token: write');
    expect(yml).toContain('workflow_dispatch');
    expect(yml).toMatch(/environment:[\s\S]*?name:\s*github-pages/);
    expect(yml).toMatch(/path:\s*dist/);
  });

  it('deploy.yml 可解析出 build 与 deploy', () => {
    const jobs = parseWorkflow(readRoot('.github/workflows/deploy.yml'));
    expect(Object.keys(jobs)).toEqual(expect.arrayContaining(['build', 'deploy']));
    expect(jobs.deploy.needs.length).toBeGreaterThan(0);
  });

  it('门禁成立：deploy 依赖闭包里同时存在 test 与 validate', () => {
    const jobs = parseWorkflow(readRoot('.github/workflows/deploy.yml'));
    const chain = [...closure(jobs, 'deploy')];
    const runs = (n) => (jobs[n] ? jobs[n].steps.map((s) => s.run).join('\n') : '');

    const testJob = chain.find((n) => runs(n).split('\n').some(isTestCmd));
    const validateJob = chain.find((n) => runs(n).split('\n').some(isValidateCmd));

    expect(testJob, '依赖链上没有任何 job 跑测试，测试红着也能上线').toBeTruthy();
    expect(validateJob, '依赖链上没有任何 job 跑 validate').toBeTruthy();
  });

  it('依赖链上不存在 job 级或 step 级的静默跳过', () => {
    const jobs = parseWorkflow(readRoot('.github/workflows/deploy.yml'));
    for (const name of closure(jobs, 'deploy')) {
      const job = jobs[name];
      if (!job) continue;
      expect(job.cont, `${name} 是 continue-on-error`).toBe(false);
      expect(isFalsy(job.condition), `${name} 的条件恒假`).toBe(false);
      job.steps.forEach((s, i) => {
        expect(s.cont, `${name} 第 ${i + 1} 个 step 允许失败后继续`).toBe(false);
        expect(isFalsy(s.condition), `${name} 第 ${i + 1} 个 step 被条件跳过`).toBe(false);
      });
    }
  });

  it('门禁命令不得用 shell 逃逸吞掉失败', () => {
    const jobs = parseWorkflow(readRoot('.github/workflows/deploy.yml'));
    for (const name of closure(jobs, 'deploy')) {
      const job = jobs[name];
      if (!job) continue;
      for (const step of job.steps) {
        const cmd = step.run.trim();
        if (!cmd) continue;
        expect(/\|\||;|&&|\bexit 0\b|--if-present/.test(cmd), `${name} 的命令可能吞掉失败: ${cmd}`).toBe(false);
      }
    }
  });

  it('ci.yml 作为 PR 门禁，同样执行 test 与 validate', () => {
    const jobs = parseWorkflow(readRoot('.github/workflows/ci.yml'));
    const all = Object.values(jobs).flatMap((j) => j.steps.map((s) => s.run)).join('\n').split('\n');
    expect(all.some(isTestCmd)).toBe(true);
    expect(all.some(isValidateCmd)).toBe(true);
  });

  it('dist 清单覆盖仓库根目录下所有 html 页面', () => {
    const src = readRoot('tools/ci-check.mjs');
    const match = src.match(/const SITE_FILES = \[([\s\S]*?)\];/);
    expect(match).not.toBeNull();
    const files = match[1].split(',').map((s) => s.trim().replace(/^['"`]|['"`]$/g, '')).filter(Boolean);
    const rootHtml = readdirSync(rootDir).filter((f) => f.endsWith('.html'));
    expect(rootHtml.length).toBeGreaterThan(1);
    for (const page of rootHtml) {
      expect(files, `根目录页面 ${page} 未进入 dist`).toContain(page);
    }
  });

  it('SITE_FILES 每项在仓库中真实存在', () => {
    const src = readRoot('tools/ci-check.mjs');
    const match = src.match(/const SITE_FILES = \[([\s\S]*?)\];/);
    const files = match[1].split(',').map((s) => s.trim().replace(/^['"`]|['"`]$/g, '')).filter(Boolean);
    for (const file of files) {
      expect(existsSync(join(rootDir, file)), `SITE_FILES 里的 ${file} 不存在`).toBe(true);
    }
  });
});

/**
 * 行为级测试：把 ci-check.mjs 放进一个临时 git 仓库真实执行。
 * 只有真实执行才能区分「命令文本里出现 pnpm test」与「失败真的会阻断」，
 * 也才能覆盖 untracked / staged 这两类 git diff 看不见的状态。
 */
function withFixture(setup) {
  const dir = mkdtempSync(join(tmpdir(), 'cicheck-'));
  try {
    for (const d of ['css', 'js', 'assets', 'term/demo', 'tools']) mkdirSync(join(dir, d), { recursive: true });
    writeFileSync(join(dir, 'index.html'), '<html><body>index</body></html>\n');
    writeFileSync(join(dir, 'flashcards.html'), '<html><body>flashcards</body></html>\n');
    writeFileSync(join(dir, 'sitemap.xml'), '<?xml version="1.0"?><urlset></urlset>\n');
    writeFileSync(join(dir, 'robots.txt'), 'User-agent: *\n');
    writeFileSync(join(dir, 'sw.js'), '// service worker\n');
    writeFileSync(join(dir, '.nojekyll'), '');
    writeFileSync(join(dir, 'term/demo/index.html'), '<html><body>demo</body></html>\n');
    copyFileSync(join(rootDir, 'tools/ci-check.mjs'), join(dir, 'tools/ci-check.mjs'));

    const git = (...args) => spawnSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...args], { cwd: dir, encoding: 'utf8' });
    git('init', '-q');
    git('add', '-A');
    git('commit', '-qm', 'init');

    if (setup) setup(dir, git);

    const res = spawnSync(process.execPath, [join(dir, 'tools/ci-check.mjs')], { cwd: dir, encoding: 'utf8' });
    return {
      status: res.status,
      out: `${res.stdout || ''}${res.stderr || ''}`,
      distHasFlashcards: existsSync(join(dir, 'dist', 'flashcards.html'))
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('ci-check 行为', () => {
  it('生成物与提交一致时退出 0，并真的把 flashcards.html 放进 dist', () => {
    const r = withFixture();
    expect(r.out).toContain('CLEAN');
    expect(r.status).toBe(0);
    expect(r.distHasFlashcards).toBe(true);
  }, 30000);

  it('已跟踪生成物被改动时退出 1', () => {
    const r = withFixture((dir) => appendFileSync(join(dir, 'term/demo/index.html'), '<!-- drift -->\n'));
    expect(r.status).toBe(1);
    expect(r.out).toContain('生成物与提交不一致');
  }, 30000);

  it('新生成的页面未 add（untracked）时退出 1', () => {
    const r = withFixture((dir) => {
      mkdirSync(join(dir, 'term/new-term'), { recursive: true });
      writeFileSync(join(dir, 'term/new-term/index.html'), '<html>new</html>\n');
    });
    expect(r.status).toBe(1);
  }, 30000);

  it('已暂存未提交时退出 1', () => {
    const r = withFixture((dir, git) => {
      appendFileSync(join(dir, 'sitemap.xml'), '<!-- staged only -->\n');
      git('add', 'sitemap.xml');
    });
    expect(r.status).toBe(1);
  }, 30000);
});