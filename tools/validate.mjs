/**
 * 数据校验器
 * 检查 data/terms.json 和 data/categories.json 的一致性与完整性。
 * 发现错误时输出到 stderr 并 exit 1。
 */
import { readFileSync } from 'node:fs';
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
  const { categories } = loadJSON('data/categories.json');

  const errors = [];

  // 建立索引
  const termIds = new Set(terms.map(t => t.id));
  const termNames = new Set(terms.map(t => t.name.toLowerCase()));
  const validCategories = new Map();
  for (const cat of categories) {
    validCategories.set(cat.id, new Set(cat.subcategories.map(s => s.id)));
  }

  // 1. 检查 category / subcategory 是否合法
  for (const term of terms) {
    if (!validCategories.has(term.category)) {
      errors.push(`[category] 词条 "${term.name}" (${term.id}) 的分类不存在: ${term.category}`);
      continue;
    }
    const subcats = validCategories.get(term.category);
    if (!subcats.has(term.subcategory)) {
      errors.push(`[subcategory] 词条 "${term.name}" (${term.id}) 的子类不存在: ${term.subcategory}`);
    }
  }

  // 2. 检查 id 唯一性
  const idCounts = new Map();
  for (const term of terms) {
    idCounts.set(term.id, (idCounts.get(term.id) || 0) + 1);
  }
  for (const [id, count] of idCounts) {
    if (count > 1) {
      errors.push(`[duplicate-id] id "${id}" 出现 ${count} 次`);
    }
  }

  // 3. 检查 related 中的悬空引用
  const dangling = [];
  for (const term of terms) {
    for (const relatedId of term.related || []) {
      if (!termIds.has(relatedId)) {
        dangling.push({ from: term.id, to: relatedId });
      }
    }
  }
  if (dangling.length > 0) {
    for (const { from, to } of dangling) {
      errors.push(`[dangling-related] 词条 "${from}" 引用了不存在的 "${to}"`);
    }
  }

  // 4. 检查别名冲突
  // 规则：同一个别名不应被多个词条使用，否则会导致歧义
  const aliasToTerms = new Map();
  for (const term of terms) {
    for (const alias of term.aliases || []) {
      const key = alias.toLowerCase();
      if (!aliasToTerms.has(key)) {
        aliasToTerms.set(key, []);
      }
      aliasToTerms.get(key).push(term.id);
    }
  }
  const aliasConflicts = [];
  for (const [alias, ids] of aliasToTerms) {
    if (ids.length > 1) {
      for (const id of ids) {
        aliasConflicts.push({ termId: id, alias });
      }
    }
  }
  if (aliasConflicts.length > 0) {
    for (const { termId, alias } of aliasConflicts) {
      errors.push(`[alias-conflict] 词条 "${termId}" 的别名 "${alias}" 与其他词条重复`);
    }
  }

  // 输出统计
  console.log(`词条总数: ${terms.length}`);
  console.log(`分类数: ${categories.length}`);
  console.log(`悬空 related: ${dangling.length}`);
  console.log(`别名冲突: ${aliasConflicts.length}`);
  console.log(`其他错误: ${errors.length - dangling.length - aliasConflicts.length}`);
  console.log(`总错误: ${errors.length}`);

  if (errors.length > 0) {
    console.error('\n--- 详细错误 ---');
    for (const err of errors) {
      console.error(err);
    }
    process.exit(1);
  }

  console.log('\n校验通过 ✓');
}

main();
