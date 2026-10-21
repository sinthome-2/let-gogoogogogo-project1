/**
 * 内容缺口报告生成器
 * 扫描 data/terms.json，统计每个 id 被 related / related_reading 引用的次数，
 * 输出 gaps.csv（按引用次数降序、id 字母序升序）。
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadJSON(filename) {
  const path = join(root, filename);
  return JSON.parse(readFileSync(path, 'utf8'));
}

function main() {
  const { terms } = loadJSON('data/terms.json');

  const existingIds = new Set(terms.map(t => t.id));
  const refCounts = new Map();

  function countId(id) {
    refCounts.set(id, (refCounts.get(id) || 0) + 1);
  }

  for (const term of terms) {
    for (const id of term.related || []) countId(id);
    for (const id of term.related_reading || []) countId(id);
  }

  // 合并现有词条与悬空 id
  const rows = [];
  for (const id of existingIds) {
    rows.push({ id, status: 'exists', refCount: refCounts.get(id) || 0 });
  }
  for (const [id, count] of refCounts) {
    if (!existingIds.has(id)) {
      rows.push({ id, status: 'missing', refCount: count });
    }
  }

  // 排序：引用次数降序，次数相同按 id 字母序升序
  rows.sort((a, b) => {
    if (b.refCount !== a.refCount) return b.refCount - a.refCount;
    return a.id.localeCompare(b.id);
  });

  const outDir = join(root, 'data', '_todo');
  mkdirSync(outDir, { recursive: true });

  const csvLines = ['id,status,refCount'];
  for (const row of rows) {
    csvLines.push(`${row.id},${row.status},${row.refCount}`);
  }

  const outPath = join(outDir, 'gaps.csv');
  writeFileSync(outPath, csvLines.join('\n') + '\n', 'utf8');

  const missingCount = rows.filter(r => r.status === 'missing').length;
  console.log(`生成内容缺口报告: ${outPath}`);
  console.log(`- 现有词条: ${existingIds.size}`);
  console.log(`- 悬空 id: ${missingCount}`);
  console.log(`- 总行数（含表头）: ${csvLines.length}`);
}

main();
